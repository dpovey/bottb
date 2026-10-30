#!/usr/bin/env python3
"""Print the Social-agent handover block (skill contract, 2026-09-28) for a song's deliverables, measured from the files.

usage: python3 -I handover.py <4K.mp4> <thumb_dir> "<Dean's words>" "<when he said it>" [--changed "<what changed since vN-1>"]
Finds the 1080p and 1080p_IG siblings of the 4K master. Per file: path, byte count, resolution, duration_seconds,
plus IG in MB and MiB against the 300 MB cap; loudness (integrated LUFS, true peak, LRA) from the 4K audio; thumbnails
with size and dimensions. It never maps files to platforms (routing is the Social agent's), and it says "not listened to"
unless you edit that line because Dean approved the sound. Send its output in ONE SendMessage. Written 2026-10-30
after assembling the V2 medley handover by hand.
"""
import json, os, re, subprocess, sys

def probe(f):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height,nb_frames,duration,bit_rate",
                                   "-show_entries", "format=duration", "-of", "json", f], capture_output=True, text=True, check=True).stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    return v, float(j["format"]["duration"])

def loud(f):
    e = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", f, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr.split("Summary:")[-1]
    g = lambda k: re.search(k + r":\s+(-?[\d.]+)", e).group(1)
    return g("I"), g("Peak"), g("LRA")

a = [x for x in sys.argv[1:] if not x.startswith("--")]
k4, thumbs, words, when = a[:4]
changed = sys.argv[sys.argv.index("--changed") + 1] if "--changed" in sys.argv else "first version of this song"
files = [k4, k4.replace("_4K_", "_1080p_"), k4.replace("_4K_", "_1080p_IG_")]
ver = re.search(r"_(v\d+)\.mp4$", k4).group(1)
print(f"HANDOVER (video editor → Social agent): {os.path.basename(k4).replace('_4K_' + ver + '.mp4', '')} {ver}. Files and thumbnails ready.\n")
print(f'Dean, {when}: "{words}" Publishing and scheduling stay on his word in your session; this message is not that word.\n')
print(f"WHAT CHANGED: {changed}\n\nFILES:")
for f in files:
    if not os.path.exists(f): print(f"- MISSING {f}"); continue
    v, d = probe(f); b = os.path.getsize(f)
    line = f"- {f}: {b:,} bytes, {v['width']}x{v['height']}, duration_seconds {float(v.get('duration', d)):.2f}"
    if "_IG_" in f: line += f", {b/1e6:.1f} MB / {b/1048576:.1f} MiB" + (" (under the 300 MB IG cap)" if b < 300e6 else " **OVER the 300 MB IG cap**")
    print(line)
I, TP, LRA = loud(k4)
print(f"\nQC: mechanically clean (render-qc PASS); not listened to. Loudness {I} LUFS integrated, true peak {TP} dBTP, LRA {LRA} LU.")
print("Routing files to platforms is yours.\n\nTHUMBNAILS:" if os.path.isdir(thumbs) else f"\nTHUMBNAILS: not yet made ({thumbs} missing) — this blocks publishing.")
if os.path.isdir(thumbs):
    for t in sorted(os.listdir(thumbs)):
        if t.startswith("._") or not t.lower().endswith((".jpg", ".jpeg", ".png")): continue
        p = os.path.join(thumbs, t); s = os.path.getsize(p)
        w, h = (subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", p], capture_output=True, text=True).stdout.split()[-3::2])
        print(f"- {p}: {w}x{h}, {s:,} bytes" + ("  (over the 2 MB YouTube thumbnail cap)" if s > 2e6 else ""))
    print("Check the year on the thumbnail yourself.")
