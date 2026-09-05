# Live-mix toolbox — reusable commands

Commands that proved useful mixing BOTTB Brisbane 2026. Paths assume the SSD layout
(`/Volumes/Extreme SSD/bottb/events/2026/Brisbane/…`). Python scripts need the venv:
`python3 -m venv venv && venv/bin/pip install numpy scipy` (see README.md in this folder).

## Media prep (once per event)

```bash
# 1. Build every band's stem set from the desk's Direct-to-USB FLACs, verify vs Reaper renders
venv/bin/python build_media.py                      # all bands (edit BANDS/paths at top)
venv/bin/python build_media.py "Total Loss"         # one band

# 2. Find a band's show timecode from the Zoom recording (two probes must agree)
venv/bin/python find_start.py                       # edit stem + zooms at top

# 3. Drum polarity + close-mic lag vs overheads (expects the 01_Media naming: "01 Kick In.wav" …)
venv/bin/python drum_polarity.py "/Volumes/Extreme SSD/.../01_Media/Epsonics"
#   read: |corr| < 0.1 → ignore that row (hat, room). lag < 0 → Delay › Sample Delay of |lag|
#   samples as the last insert on that mic. lag > 0 (desk latency) → polarity check only.
#   corr sign negative → Gain plugin › Phase Invert. Snare Top has been inverted + 12 smp late
#   on every band so far (desk snare channel).
#   Brisbane 2026 results — ShipRex: KI 145, KO 118, T1 105, T2 92, FT 97, snare flip.
#                             Epsonics: KI 125, KO 82, T1 107, T2 97, FT 105, snare flip.

# 4. Generate an FCPXML that places all stems at show TC on named tracks in one import
python3 make_fcpxml.py "/Volumes/Extreme SSD/.../01_Media/Epsonics" --file-start-tc 2823.692s -o Epsonics.fcpxml
```

## Stem measurement (loudness / peaks / clipping) — feeds the Gain-trim table

```bash
cd "/Volumes/Extreme SSD/.../01_Media/<Band>"
for f in *.wav; do printf "%-22s " "$f"; ffmpeg -nostats -v info -i "$f" \
  -af "ebur128=peak=true,astats=measure_overall=Peak_level+RMS_level:measure_perchannel=0" -f null - 2>&1 \
  | grep -E "^\s+(I:|LRA:|Peak:)|RMS level dB|Peak level dB" | tr -s ' \n' ' '; echo; done

# clipped samples on one file
ffmpeg -nostats -hide_banner -i "$f" -af "pan=mono|c0=c0,astats=measure_overall=Peak_count+Flat_factor+Peak_level:measure_perchannel=0" -f null - 2>&1 | grep -E "Peak count|Flat factor"
```

Trim rule: `trim = min(targetLUFS − LUFS, ceiling − truePeak)`; targets −26 close drums,
−28 OH/room/hat, −22 bass/vox, −26 rest; ceiling −3 drums / −4 vox.

## Sample-accurate cuts / merges

```bash
S=218225954; E=$((S+210*48000))     # sample numbers, not seconds
ffmpeg -i in.wav -af "atrim=start_sample=${S}:end_sample=${E}" -c:a pcm_s24le -ar 48000 out.wav
ffmpeg -i L.flac -i R.flac -filter_complex "[0:a][1:a]amerge=inputs=2" -c:a pcm_s24le out_stereo.wav
```

## Bounce QA

```bash
F=".../03_Delivery/<Band>/<Band>_mix_vN_at_HH-MM-SS-FF.wav"
ffprobe -v error -show_entries stream=sample_rate,channels,bits_per_sample,duration_ts -of csv=p=0 "$F"
ffmpeg -nostats -hide_banner -i "$F" -af "ebur128=peak=true,astats=measure_overall=Peak_level+Peak_count:measure_perchannel=0" -f null - 2>&1 \
  | grep -E "^\s+(I:|LRA:|Peak:)|Peak level dB|Peak count"
```

Targets: rough = no limiter, peak ≤ −3 dBFS; final = −14 LUFS, TP ≤ −1 dBTP. Length must be
the end-marker bar × seconds-per-bar. Alignment check: cross-correlate the bounce against the
_Keys_ stem in 200–2000 Hz (±1 sample expected); never against a pitch-corrected vocal.

## Placing a mix on the Resolve timeline (scripted, works)

Resolve Studio's Python API (External scripting must be enabled in Resolve prefs):

```bash
export RESOLVE_SCRIPT_API="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting"
export RESOLVE_SCRIPT_LIB="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
export PYTHONPATH="$RESOLVE_SCRIPT_API/Modules"
python3 - <<'EOF'
import DaVinciResolveScript as dvr
r=dvr.scriptapp("Resolve"); p=r.GetProjectManager().GetCurrentProject(); tl=p.GetCurrentTimeline(); mp=p.GetMediaPool()
WAV="/path/to/Band_S5_..._at_01-54-09-12.wav"; h,m,s,f=1,54,9,12; rec=((h*3600+m*60+s)*25)+f   # timeline starts 00:00:00:00, 25 fps
item=mp.ImportMedia([WAV])[0]; tl.AddTrack("audio","stereo"); n=tl.GetTrackCount("audio"); tl.SetTrackName("audio",n,"Band S5 MIX")
mp.AppendToTimeline([{"mediaPoolItem": item, "recordFrame": rec, "trackIndex": n, "mediaType": 2}])
EOF
```

Placement is frame-accurate only; sub-frame remainder (e.g. +14 ms) is a Fairlight nudge.

## Mix analysis with mix-assist (`~/src/personal/mix-assist`)

Export post-fader stems for the song's cycle range: Logic ⇧⌘E — WAVE 24-bit 48 k, Bypass
Effect Plug-ins **off**, Include Volume/Pan Automation **on**, Normalize **Off**, Audio Tail
on, one file per track → `02_Production/<Band>/analysis/<Sn>/stems/`. Then:

```bash
cd ~/src/personal/mix-assist
uv run mix-analyser --pretty analyse ".../analysis/S5/stems" --mode live \
  --bounce ".../03_Delivery/<Band>/<Band>_S5_..._v1_at_....wav"
uv run mix-analyser --pretty findings <sid> --limit 10
uv run mix-analyser explain <finding_id> --level intermediate
uv run mix-analyser export <sid> --format logic          # channel-strip recipe
```

Aux returns don't export with "All Tracks"; the `--bounce` print-check catches what the stems
miss (bus comps, sidechains).

## Verify a project's "Plays at SMPTE" (do this before the first delivery bounce)

A project copied from another band silently keeps that band's offset, and only the ruler
shows it. Cross-correlate the band's lead-vocal stem against the picture-true reference at
three probes for each candidate TC; the right one agrees within a few ms with a real
correlation, a wrong one sits at the noise floor (~0.02) with lags disagreeing by seconds.

```bash
venv/bin/python - <<'EOF'
import subprocess, numpy as np
from scipy.signal import correlate, butter, sosfiltfilt
SR=48000; W=2
REF="/Volumes/BOTTB/Audio/BOTTB_reference_48k.wav"
STEM="/Volumes/Extreme SSD/.../01_Media/<Band>/<lead vocal>.wav"
CANDIDATES={"documented":2822.441, "what the project says":5495.48}   # seconds = TC at bar 1
def load(p,s,d):
    return np.frombuffer(subprocess.check_output(["ffmpeg","-v","error","-ss",str(s),"-t",str(d),
        "-i",p,"-af","pan=mono|c0=c0","-f","f32le","-ac","1","-ar",str(SR),"-"]),dtype=np.float32).astype(float)
bp=lambda x: sosfiltfilt(butter(4,[300,3000],btype="band",fs=SR,output="sos"),x)
for name,T0 in CANDIDATES.items():
    print(name,T0)
    for st in (300,900,1500):
        s=bp(load(STEM,st,12)); r=bp(load(REF,T0+st-W,12+2*W)); s/=s.std(); r/=r.std()
        c=correlate(r,s,mode="valid"); i=int(np.argmax(np.abs(c)))
        print(f"  @{st}s lag {(i-W*SR)/48:+8.1f} ms  corr {c[i]/len(s):+.2f}")
EOF
```

Read both columns. Consistent lag + good correlation = the TC is real but offset by that lag
(subtract it). Noise-floor correlation = wrong TC entirely. Fix in _File › Project Settings ›
Synchronization › General_, row "Bar Position 1 1 1 1 plays at SMPTE"; nothing moves. Repeat
per Project Alternative, MCP disconnected.

## Song boundaries → markers

`songs.py`-style: per-second RMS of the bounce (HPF 120 Hz), threshold = 85th percentile −14 dB,
merge gaps < 4 s, keep segments ≥ 40 s. Then per song: MCP `logic_transport.goto_position
{bar}` → `logic_navigate.create_marker {name}` — **one call at a time**, the server refuses
overlapping mutations and a batch leaves half-named markers.

## logic-pro MCP recipes (Logic 12.2)

| Task                          | Call                                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read tracks / mixer / markers | resources `logic://tracks`, `logic://mixer`, `logic://markers` (`refresh_cache` first)                                                                               |
| Insert plugin (slot 0 only)   | `logic_plugins.insert_verified {track, insert:0, plugin:"Gain"\|"Channel EQ"\|"Compressor", expected_name, project_expected_path, mode:"duplicate_applyback"}`       |
| Fader                         | `logic_mixer.set_volume {track, value}` — value ≈ 0.758 + 0.026 × dB                                                                                                 |
| Pan                           | `logic_mixer.set_pan {track, value −1…1}` (±10-unit detents)                                                                                                         |
| Rename track                  | `logic_tracks.rename {name, target_ref}` — use `target_ref`, indices shift                                                                                           |
| Markers                       | `goto_position {bar}` then `create_marker {name}` (works, one pair at a time); `rename_marker` writes but never verifies on 12.2 — rename by hand in the Marker List |
| Health                        | `logic_system.health`; if even this times out, a modal dialog is open in Logic                                                                                       |

Not available: audio import, region moves, insert slots > 0, plugin params except Compressor
threshold, stacks, icons, sends.

Behaviour: every AX/CGEvent call **brings Logic to the front** (steals focus) and needs Logic
idle — while Logic is at 100 % CPU (overview generation after imports) even reads time out.
Batch MCP work into bursts when nobody is editing. MCU/OSC/MIDI paths do not need focus.
The server's ~1 s accessibility poll also **drops focus out of Logic text fields** (marker
names, track names): disconnect the MCP (`/mcp` → disconnect, or kill `LogicProMCP`) while
editing by hand, reconnect for automation bursts. Check `pgrep -fl LogicProMCP` — a second
session/app can leave a duplicate server polling.
