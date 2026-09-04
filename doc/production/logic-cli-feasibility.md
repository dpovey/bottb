# `logic-cli` — feasibility and utility assessment

Status: **decision-support draft, 2026-09-04.** The bulk was written while Logic Pro 12.2 was
mid-bounce, so **almost nothing here was tested against a running Logic**. Every claim is tagged
as either **[verified]** (I ran it on this machine, on real project files, and show the result),
**[verified hands-on]** (someone at the machine confirmed it in Logic's UI),
**[cited]** (someone else's published work — URL given), or **[inference]** / **[UNTESTED]**
(needs hands-on time to settle).

---

## 1. Executive summary and recommendation

**Recommendation: build a narrow tool, in two halves, and do not replace the MCP.**

Specifically:

1. **Build `logic-cli read` — an offline reader of the `.logicx` bundle.** This is the
   surprise of the investigation. Logic's `ProjectData` is *not* the opaque wall the
   learnings log assumes ("undocumented binary — never edit it"). It is a flat, walkable
   chunk list. I walked two real BOTTB projects end-to-end and pulled the complete mixer
   channel list in project order — including buses and the Stereo Out — in about 25 lines of
   Python, with Logic untouched. **[verified, §5]** This half is zero-risk (read-only, no GUI,
   no AX, no process left running), can't be starved by a render, works on projects that
   aren't even open, and reaches things the MCP structurally cannot.

   One of those things has since moved from "more convenient" to **"the only route that
   exists"**: hands-on testing established that **AX does not publish a fader's dB value at
   all.** Every `AXSlider` in Logic's main window returns no `AXValueDescription`; the
   "−15.8 dB" on screen is drawn, not exposed. **[verified hands-on]** The MCP can therefore
   only ever return a raw 0..1 float sitting on a taper that cannot be fitted (§5.6). Reading
   dB out of `ProjectData` is not an optimisation of the AX route — there is no AX route.

2. **Build `logic-cli export` — a run-act-exit export driver, with real completion
   detection.** This is the one operation the MCP genuinely fails at, and I found the reason
   in its own shipped source: it polls for the output file for **25 seconds** and then gives
   up, and it copies the file the moment it appears rather than waiting for the write to
   finish. **[verified, §4]** Both are fixable in an afternoon. I also found that every bounce
   and every *All Tracks as Audio Files* setting lives in `com.apple.logic10.plist` as plain,
   readable keys — `BounceFileType`, `BounceBitSize`, `BounceOffline`, `defaultBouncePath`,
   `TrackExportFileTypeIndex`, `TrackExportBitsSampleIndex` — so most of the dialog-poking can
   be replaced by setting preferences offline. **[verified, §6.3]**

   Hands-on testing since has made this phase both **more necessary and better specified**.
   More necessary, because an export can finish clean and still be garbage: a 12-minute render
   produced a correct-length, correct-format, size-stable 556 MB file containing **only the two
   soloed channels**, with nothing in the response or the metadata to say so (§6.5). Better
   specified, because the manual workaround — ignore the MCP's error, watch the file for size
   stability — has now succeeded on three long bounces, so Phase 2 automates a known-good
   procedure rather than inventing one.

3. **Do not rebuild mixer writes.** Faders, pans, mutes, solos, renames, markers and slot-0
   inserts already work through the MCP's MCU path. Reimplementing MCU-over-CoreMIDI to get
   back to parity would be days of work for zero new capability. (Mixer *reads* are a
   different matter — see §6.2, where the MCP's two inventory surfaces disagree with each
   other.)

4. **Do contribute upstream — five concrete bugs, all small.** Hands-on testing grew this list
   from two to five (§8); the export path is more broken than a code reading alone suggested,
   and the most important one is that the helper looks for the finished file in the wrong
   directory under the wrong name. The project is MIT-licensed with a public repo, but ships as a
   42 MB prebuilt Swift binary via a Homebrew tap; a fix means building from source and
   waiting on a maintainer. Not the critical path. **[verified, §8]**

5. **Fix the process-lifecycle problem with a wrapper, not a rewrite.** The MCP's CPU
   starvation is a *lifecycle* bug, not an architecture problem you can only escape by
   rewriting. A `pkill` in a session-end hook solves 90 % of it today.

**What not to build:** a long-lived `logic-cli serve`, an MCP surface of its own, a general
mixer-write API, or anything that writes into `ProjectData`.

**Honest bottom line on effort.** Phase 1 is roughly a day and is worth it on its own merits.
Phase 2 is one to two days and removes the single biggest daily friction. Phase 3 (fader/pan
byte offsets) is genuinely open-ended — §5.6 records real progress *and* a real dead end, and
should be read before anyone commits to it. Everything beyond that has a poor ratio and should
stay in the MCP or stay manual.

---

## 2. Method note, and one thing I got wrong

I read files, parsed binaries, read the MCP's own shipped helper scripts, and did web
research. I did not call any `mcp__logic-pro__*` tool, did not run osascript, and did not
touch Logic's UI.

One slip worth recording, because it produced a useful datum: I ran
`sdef "/Applications/Logic Pro.app"` to dump the AppleScript dictionary, not realising `sdef`
falls back to sending a `kASGetSdef` **AppleEvent** to the app when the bundle carries no
static `.sdef`. It sat for 120 s and returned `error -1712` (AppleEvent timed out). Logic
carried on rendering with no visible effect.

The datum: **while Logic is rendering a long bounce it does not service AppleEvents inside
120 seconds.** That is a single observation, not a controlled test, but it is consistent with
everything else here — AppleScript, System Events AX and direct AX all ultimately queue work
onto Logic's main thread, so *every* live control channel except CoreMIDI degrades or stalls
exactly when a render is running. Offline file reading is the only channel that doesn't.

---

## 3. What is actually broken today

### 3.1 Background AX polling starves Logic — mechanism confirmed

The learnings log records the symptom (Logic at 97 % CPU, main thread stuck in
`_AXXMIGCopyAttributeValue` → `accessibilityWindowsAttribute` → SkyLight `run_query`). Reading
the MCP's shipped helpers explains the mechanism exactly.

`/opt/homebrew/Cellar/logic-pro-mcp/3.14.0/share/logic-pro-mcp/logic_ui_jxa.py` probes Logic's
UI with a **recursive System Events JXA tree walk to depth 6**, calling `node.role()`,
`node.name()`, `node.value()` and `node.uiElements()` on every node. **[verified]** Each of those
is a separate AppleEvent → AX → synchronous IPC round trip that Logic must service on its own
main thread. On a mixer with 37 channel objects and hundreds of plugin views, a single
depth-6 walk is thousands of round trips.

Two things follow, and it matters which is which:

- **The per-query cost is inherent to AX**, whoever writes the client. Every
  `AXUIElementCopyAttributeValue` is serviced *inside the target process*. Apple's own
  `AXUIElementSetMessagingTimeout` exists precisely because these are IPC requests that can
  hang. **[cited — Apple `AXUIElement.h`; medium confidence on the "main thread" specific]**
- **The continuous polling is not inherent.** It is a design choice of this server, made
  worse by a lifecycle bug: every Claude session spawns its own `LogicProMCP` and it does not
  exit when the session ends. Observed mid-render: `LogicProMCP` pid 34345, **12 h 23 m
  elapsed, 9.3 % CPU**, while Logic sat at 34 %. **[verified]** That one belonged to a live
  session — the two-day-nineteen-hour orphan from the incident log was the same shape, just
  abandoned.

**Can AX be made event-driven?** Yes, partially, and this was the question worth answering.
`AXObserverCreate` / `AXObserverAddNotification` / `AXObserverGetRunLoopSource` let you
subscribe to `kAXValueChangedNotification`, `kAXWindowCreatedNotification`,
`kAXUIElementDestroyedNotification`, `kAXFocusedUIElementChangedNotification` and friends;
callbacks then arrive on *your* run loop when the target pushes them. **[cited]** But:

- The notification tells you *that* something changed, not the new value — reading it is still
  a synchronous round trip, just triggered by a change instead of a timer.
- Subscription is per-element per-notification, so watching 37 faders means 37 registration
  round trips up front.
- `AXUIElementCopyMultipleAttributeValues` batches N reads into one round trip and should be
  used everywhere the MCP currently issues serial reads. **[cited]**

So observers turn "poll forever" into "one read per real change", which is a large win for
rare events (a dialog appearing, a bounce window closing) and no win at all for "give me every
fader right now". **This is the correct mechanism for bounce-completion detection** (§6.4) and
the wrong thing to build a mixer-state cache on.

**And the structural point stands: a CLI that runs, acts and exits cannot orphan.** A
long-lived server can, and this one does. That is a genuine architectural advantage of the CLI
shape — but it is worth being precise that it fixes the *accumulation*, not the *per-query
cost*. A CLI that did the same depth-6 walk would hurt Logic just as much for the seconds it
ran.

### 3.2 Export is underpowered — and the reason is in their source

`logic_project.export_run` drives Cmd+B. Reading `logic_bounce.py` **[verified]**:

- It opens the Bounce dialog, clicks OK on the settings sheet, then drives the **save panel by
  hardcoded pixel offsets** computed from the panel frame: name field at
  `(x + 0.591·w, y + 54)`, the Downloads sidebar row at `(x + 86, y + 184)`, the Bounce button
  at `(x + w − 60, y + h − 32)`. Its own comment says these were "calibrated live against the
  standard Logic 12.2 bounce save panel".
- It bounces to a **staging folder** (`~/Downloads`) because ⌘⇧G "Go to Folder" can't be
  confirmed by automation, then moves the file.
- **The completion check is `for _ in range(25): ... time.sleep(1.0)`.** Twenty-five seconds,
  total. A 28-minute set bounced offline will not have produced a file in the staging folder
  in 25 s, and the helper returns `artifact_not_produced_in_staging` — which is exactly the
  false failure recorded in the brief.
- Worse: as soon as the file *appears* it is copied with `shutil.copyfileobj` and the source
  unlinked. Nothing waits for the write to finish. **A long bounce that does appear inside 25 s
  will be copied while still being written**, yielding a truncated file that reports success.
  I have not observed this happen, but the code path is unambiguous. **[verified by reading;
  UNTESTED in the wild]**

It cannot do *File > Export > All Tracks as Audio Files* at all — a different menu item and a
different dialog, which the helper has no code for.

**Confirmed in practice, three times.** `bounce_fired: true` together with
`artifact_not_produced_in_staging` has now been observed on three long bounces that were all
running perfectly. **[verified hands-on]**

**And there is a second, independent root cause underneath the timeout.** The observed staging
path is **`/private/tmp/<Project Name>.wav`**. The helper globs
`~/Downloads/<name>--lpmcp-<uuid8>.*`. Two things are therefore wrong at once:

- **Wrong directory.** The file lands in `/tmp`, which is exactly what the
  `defaultBouncePath = /tmp` preference found in §6.3 specifies. The helper's sidebar click at
  `(x + 86, y + 184)` — meant to select Downloads — is not taking effect.
- **Wrong filename.** The file is named after the *project*, not the
  `<name>--lpmcp-<uuid8>` staging name the helper types into the Save As field. So the
  click-select-all-delete-type sequence at `(x + 0.591·w, y + 54)` is not taking effect
  either.

In other words the save panel is falling through to Logic's own defaults for both destination
and name, and the helper is then looking for a file that was never going to exist under that
name in that folder. **Even with an unlimited timeout the current code would still fail.**
**[inference from two verified observations — the staging path and the shipped source; the
precise reason the clicks miss is UNTESTED]** This considerably strengthens the case in §10
that hardcoded pixel offsets are the most fragile thing in the system: they are already
missing on this machine, silently, and the resulting error message points at the wrong thing.

### 3.3 Statefulness

Focus stealing, `target_ref` tokens to survive index shifts, 25 s timeouts, the `state: A/B/C`
honesty protocol. All of it is downstream of the same thing: the server is inferring project
state by interrogating a GUI that is simultaneously being edited by a human. **Reading the
saved file instead removes most of that class of problem** — at the cost of only ever seeing
the last save.

---

## 4. Control channels

| Channel | Reaches | Cost to Logic | Verdict |
|---|---|---|---|
| **Offline `.logicx` parsing** | Track/channel names & order, insert chains, regions, audio file refs, tempo, markers, alternatives, sample rate | **Zero** | **Best available. Underused.** Read-only, last-save-accurate |
| **Logic prefs plist** | Every bounce/export setting; key command bindings | Zero to read | **High value, needs a write test** |
| **CoreMIDI / MCU** | Faders, pans, mutes, solos, transport, V-pot params, bank of 8 | Low — survives a render | Already covered by the MCP |
| **AX via `AXObserver`** | Dialog/window lifecycle events | Low if event-driven | **Right tool for bounce completion** |
| **AX by polling / System Events JXA** | Anything on screen — *but not fader dB* | **High — this is the 97 % CPU** | Use sparingly, never in a loop |
| **CGEvent synthetic input** | Menus, save panels, typing | Low, but blind | Necessary evil for export |
| **AppleScript dictionary** | `open`, `quit`, `renderpreview`. That's it | n/a | **Dead end** |
| **Scripter** | MIDI within its own channel strip | n/a | **Dead end for host control** |
| **Logic Remote** | Unknown | n/a | **Dead end** — transport reverse-engineered, command layer not |
| **OSC** | TouchOSC's fixed namespace only | n/a | **The learnings log is wrong here** |

Detail on the ones where the answer is not obvious:

**AppleScript.** There is **no `.sdef` anywhere in the Logic Pro 12.2 bundle** — I searched it.
`Info.plist` sets `NSAppleScriptEnabled = true` with no scripting terminology, which means
what Script Editor shows is Cocoa's auto-generated Standard Suite plus Logic's single custom
verb, `renderpreview`. **[verified — bundle inspection; cited — Apple Developer Forums thread
115355]** There is no `bounce`, no `export`, no mixer access. Anyone who tells you to
"just AppleScript it" has not looked.

**OSC — correcting a note in the learnings log.** `live-mix-logic-learnings.md` lists "OSC
control surface (Control Surfaces › Setup › New › OSC)" as the *best* scripting option, with
"faders, pans, sends, mutes, transport, markers, selected-strip plugin params; ~20 lines of
`python-osc`". I can find no evidence a generic, user-addressable OSC surface type exists.
What does exist in `Logic Pro.app/Contents/PlugIns/MIDI Device Plug-ins/` is
**`TouchOSC.bundle`** — a closed, fixed-namespace integration for Hexler's TouchOSC app, whose
own documentation says "it is not possible at this time to use customized Layouts or to learn
OSC commands". **[verified — bundle listing; cited — Hexler setup docs]** Third-party bridges
like OSCulator present themselves to Logic as ordinary control-surface plugins and translate
OSC↔MCU on their side; Logic is still speaking MCU. **Treat the OSC line in the learnings log
as unconfirmed and probably a misreading.** If someone has actually seen an "OSC" entry in the
New/Install list, that would change the picture materially and is worth 5 minutes to check.

**Mackie Control.** Well documented by two independent open-source implementations. Faders are
14-bit pitch-bend, one MIDI channel per strip; V-pots are CC 16–23 relative with CC 48–55 LED
rings; scribble strips are 7 characters per channel over SysEx `F0 00 00 66 14 12 …`; VU is
poly aftertouch; buttons are note on/off. Bank size is 8 and **there is no addressing by
name** — the host decides which 8 tracks are under the strips. **[cited]** This is why the
MCP's fader readback is quantised into detents and why track indices shift under it. Nothing a
rewrite would fix; it is the protocol. Note also that MCU carries fader *position*, never dB —
the dB text lives only in Logic's own drawing code.

**Key commands.** The `.logikcs` files are XML plists wrapping an opaque
`LogicBinaryPreferences` blob — not editable. **[verified]** But the *live* bindings are in
`~/Library/Preferences/com.apple.logic10.plist` under `KeyCommands`, and that is a **plain,
readable dict of 870 entries**, `"<commandId>" → {Modifier, Flags, Key, CharCode}`.
**[verified]** Modifier is a 4-bit field (observed values compose from 1, 4, 8, 32).

That is a more useful finding than it first looks: it means a CLI could *bind a key command by
writing a preference*, rather than by driving the Key Commands window. The catch is that
command IDs are numeric and unpublished — `KeyCommandShortNames` names only 33 of them. You'd
recover the ID for "Export All Tracks as Audio Files" by diffing the plist before and after
assigning it by hand once. Cheap experiment, big payoff. **[UNTESTED]** Note this also
contradicts the MCP's own installer script, which asserts "Logic Pro 12.2+ no longer accepts
plist-based Key Commands Import" — true of the *import menu*, apparently not true of the
underlying preference.

---

## 5. Offline parsing of `.logicx` — the finding

This is the part the brief guessed might be the biggest win. It is.

### 5.1 The plists are free

Inside the bundle, several files are ordinary plists, no reverse engineering required
**[verified on `ShipReX - Full Set.logicx` and `Epsilon - Whole Set.logicx`]**:

`Resources/ProjectInformation.plist`
```
ActiveVariant   => 0
LastSavedFrom   => "Logic Pro 12.2 (6644)"
VariantNames    => { 0: "0 - Master", 1: "1 - Careless Whisper - Uprising",
                     2: "2 - Espresso", 3: "3 - Dumb Things",
                     4: "4 - Everlong", 5: "5 - Covered in Chrome" }
```
That is the entire **Project Alternatives** list plus which one is active — the backbone of the
per-song workflow — for free.

`Alternatives/NNN/MetaData.plist`
```
SampleRate 48000 · BeatsPerMinute 120 · NumberOfTracks 25 · isTimeCodeBased false
FrameRateIndex 1 · SongSignature 4/4 · SongKey C
AudioFiles[20] · UnusedAudioFiles[11] · QuicksamplerFiles[1]
```
Note `SampleRate 48000`. The MCP reports `sampleRate: 44100` for this project — the learnings
log already flags that field as a placeholder. **The plist has the real value.** One line of
Python replaces a known-wrong field.

Also present per alternative: `DisplayState.plist` (window/editor layout — screensets, list
column widths, mixer scroll position; *not* markers), `DisplayStateArchive` (NSKeyedArchiver),
`WindowImage.jpg` (a saved screenshot of the arrange window — a free visual sanity check
without touching Logic), and `Project File Backups/00…04` (five prior saves — a ready-made
corpus for diff-based reverse engineering).

### 5.2 `ProjectData` is a flat chunk list, and it walks cleanly

Prior art exists and is good. **[cited]**

- **[jonkubis/LogicProFormatWriter](https://github.com/jonkubis/LogicProFormatWriter)** (Python,
  MIT) — a 1051-line byte-level spec `PROJECTDATA_FORMAT.md`, reverse-engineered against Logic
  11.2.2 by differential analysis, with claims tagged "Logic-validated". Reads *and writes*.
- **[CraigStuntz/LogicFiles](https://github.com/CraigStuntz/LogicFiles)** (Swift, MIT) — full
  byte-level specs for `.cst`, `.pst`, `.patch`, `.aupreset`, plus the `.logicx` layout;
  fuzz-tested, round-trip tests.
- **[rhydlewis/lpx-toolkit](https://github.com/rhydlewis/lpx-toolkit)** /
  **[lpx-explorer](https://github.com/rhydlewis/lpx-explorer)** — a shipping read-only
  inspector over hundreds of projects. Author's stated gaps: track names don't parse uniformly,
  **track row order doesn't match Logic's UI order**, and region↔channel-strip linkage is
  unresolved.
- **[geoffmyers/logicx-analyzer](https://github.com/geoffmyers/logicx-analyzer)** — the
  foundational chunk-tag work both of the above cite.

**I verified the format independently on this machine, on Logic 12.2 output**, before reading
any of that. The header at offset 0 is `23 47 C0 AB D0 09`, with `uint32 @0x10 = filesize − 24`.
Records start at `0x18`; each is a reversed-FourCC tag, `uint32 payload_size @ +0x1c`, and
`record_size = 0x24 + payload_size`.

Walking that rule over two independent projects consumed each file **exactly to EOF with no
resync** **[verified]**:

| Project | Bytes | Records | Ends at |
|---|---|---|---|
| `ShipReX - Full Set` alt 000 | 1,303,051 | 951 | `0x13e20b` = EOF |
| `Epsilon - Whole Set` alt 001 | 1,013,928 | 845 | `0xf78a8` = EOF |

Tag census for ShipRex:

```
307 OCuA   channel-strip objects       55 qeSM   MIDI sequences
164 UCuA   plug-in instances           55 qSvE   event sequences
113 karT   tracks                      40 lFuA   audio file refs
 40 gRuA   audio regions               40 MneG
 37 ivnE   environment (mixer) objects 32 tSxT / 32 lytS
 13 nCuA    6 qSxT   3 OgnS   3 rpyH   2 MroC   2 vEuA
  1 gnoS (song root)  1 tSnI  1 snrT  1 ryaL  1 tScS  1 ediV  1 dlFA
```

Tags match the published tables exactly. **The format is real, stable across 11.2.2 → 12.2 at
the container level, and trivially walkable.** **[verified]**

### 5.3 What I got out of it in 25 lines

Names are `uint16` length-prefixed, NUL-terminated ASCII at fixed offsets within a record.
The offsets differ from the 11.2.2 spec (which puts the track name at payload `+0x34`; on 12.2
that returns nothing), so a small amount of per-version offset-hunting is needed — exactly the
work already done successfully for `.exs` in `scripts/build_exs.py`.

`ivnE` name at record `+0xC4` gives **the complete mixer, in order**, on both projects
**[verified]**:

```
ShipRex:  Not Assigned, MIDI Click, (Folder), Sequencer Input, Physical Input, Input View,
          Input Notes, Preview, Click, Stereo Out, Master, Drums, Kick In, Kick Out,
          Snare Top, Gtr 2 R, Hi-Hats, Tom 1, Tom 2, Floor Tom, OH, Bass DI, Gtr 1 L, Keys,
          Vox 2 Lead, Vox 3, Vox 1, Vox 4, Acoustic, Erhu, Room, GTRS, VOX, Vocal Reverb,
          Room Verb, MIDRANGE, Snare Bottom

Epsilon:  … Stereo Out, Master, Aux 7, Drums, Kick In, Kick Out, Snare Top, Snare Bottom,
          Hi-Hats, Tom 1, Tom 2, Floor Tom, OH, MIDRANGE, Keytar, GTRS, Gtr 2 DI, Keys,
          Bass DI, VOX, Vox 1, Vox 2 Lead, Vox 3, Vox 4, Room, Master, Vocal Reverb, Room Verb
```

Every audio channel, every bus, the summing-stack parents, Stereo Out and Master. That is a
strictly better mixer inventory than the MCP's track list, which cannot see past a bank of 8
without banking and reports pan as 0 for everything once a stack exists.

`gRuA` name at `+0x70` gives all 40 regions with their names (both the old `01_Kck IN` set and
the current `01 Kick In` set — the file remembers superseded material). `lFuA` records carry
the audio filenames as UTF-16LE, extractable with a plain regex. **[verified]**

**Insert chains are visible in record order.** The file lays out an `OCuA` (channel strip)
followed immediately by its run of `UCuA` (plugin instance) records, and `UCuA` payload sizes
are stable per plugin type (292, 468, 708, 376, 1811, 1317 recur across strips). Plugin display
names appear inside `UCuA` — `Channel EQ` at `+0x9c` in 32 records, `Compressor`, `Noise Gate`,
`Gain`, `Pitch Correction`, `Ozone`, `Quick Sampler`. **[verified]** Turning "record adjacency"
into "channel X, slot N, plugin Y" is the main remaining reverse-engineering task and is
**[UNTESTED]** — but the `OCuA`-then-`UCuA` grouping is unmistakable, and `lpx-toolkit`'s
author flags exactly this linkage as their unsolved problem, so budget real time for it.

**137 embedded `bplist00` NSKeyedArchiver blobs parse for free** with `plistlib` once you find
their extent by trailer-consistency scanning (140 KB of the 1.3 MB). They turn out to be Smart
Controls / `MAPlugInParameterMapping` data, not mixer state — useful to know so nobody wastes
a day expecting the fader values to be in there. **[verified]**

### 5.4 How hard is this compared to `.exs`?

Honestly: **the same kind of work, roughly 3–5× the volume**, and §5.6 shows the tail is
longer than the head.

`.exs` was one chunk type family, 84-byte headers, and a handful of fields verified against
hand-set UI values. `ProjectData` is ~20 chunk types and ~950 records, but the container is
*easier* (a clean size-chained walk with no offset table to corrupt), there is a published
spec to start from, and the project ships five timestamped saves per alternative plus several
alternatives of the same project — an unusually rich diff corpus.

The method that worked for `.exs` transfers directly: change one thing in the UI, save, diff
the bytes, confirm. The `.exs` write-up in the learnings log also carries the right warning —
*"Don't infer a binary field from a single sample of the file"* — which applies with more
force here, in two distinct ways now documented in §5.6.

**Legal note.** Logic's EULA clause G prohibits reverse engineering "the Apple Software"; the
community disagrees about whether analysing a *data file it writes* is covered, and there is no
resolution either way. The three repos above proceed anyway under MIT/GPL. Flagging it as
unresolved risk, not settled fact, and noting that the read-only half of this proposal carries
much less of whatever risk exists than a writer would. **[cited]**

### 5.5 `.cst` / `.pst` — where they live

`~/Music/Audio Music Apps/Channel Strip Settings/{Track,Bus,Instrument,Master}/` and
`~/Music/Audio Music Apps/Plug-In Settings/<PluginName>/` (39 plugin folders present here:
Channel EQ, Compressor, Noise Gate, Gain, DeEsser 2, Pitch Correction, Sampler, Quick Sampler,
Sample Delay, Adaptive Limiter, Mastering Assistant, …). **[verified]**

`.pst` is fully specced by LogicFiles: 24-byte `GAMETSPP` header then a flat float array with
`0xcaf24971` marking unused slots. **[cited]** Robert Heaton's independent ES M write-up
reaches a slightly different float width, so **per-plugin parameter encoding is not uniform**
even though the container is — don't assume one decoder fits all plugins.

Practical consequence: **writing a `.pst`/`.cst` on disk and loading it in Logic is a far more
reliable way to set a whole plugin's parameters than poking V-pots or AX fields.** It's the
same trick as `build_exs.py`. Worth remembering, though it still needs a human (or a key
command) to load the setting.

### 5.6 Fader and pan storage — one lead, two dead ends, and a trap

**[verified, offline, on `Epsilon - Whole Set.logicx` alternatives 000 and 001]**

Because AX publishes no dB (§1), `ProjectData` is the only candidate source. I spent the time
to probe it and the result is genuinely mixed — recorded here so nobody repeats the negatives.

**Dead end 1 — it is not stored as dB in an IEEE float.** Scanning the whole 1 MB file for
`float32` and `float64` values matching the six confirmed anchors (−23.7, −18.0, −15.8, −6.0,
0.0, +1.0 dB) found **nothing** at −18.0, −15.8 or −23.7 as float64, and only incidental hits
elsewhere. If dB were stored directly, `-15.8` and `-23.7` are distinctive enough that they
would have lit up. They don't.

**Dead end 2 — it is not the 0..1 raw the AX/MCU layer reports.** Same scan for 0.27556,
0.32444, 0.37333, 0.60000, 0.75789, 0.78421 as `float32` (tolerance 5×10⁻⁴): **zero hits** on
all six except the unremarkable 0.6. The 0..1 float is a normalisation applied by the MCU
readback path, not a stored quantity.

So the fader is very likely an integer in some internal unit, and finding it needs the
set-one-fader-save-diff cycle, not a scan.

**The trap — diffing two alternatives does not find it.** This is the important corrective.
Alternatives 000 ("Whole Set") and 001 ("Mixed from reference") are the same project with a
different mix, so the obvious move is to diff them. Doing that on the 310 aligned `OCuA`
records: **295 records differ, and a single byte offset `+0x7e` accounts for 286 of them.**
That looks exactly like the fader field until you check its distribution — `+0x7e` takes only
**two values across all 310 records, 0 and 2**. It is a boolean flag that flipped almost
project-wide. The loudest signal in the diff is a red herring, and a less careful pass would
have "found the fader" and been confidently wrong.

**The one real lead — `OCuA +0x7d` is a strong pan candidate.** Across the 310 `OCuA` records
it takes values 34, 44, 54, 63, 64, 74, 79, 84 — a spread tightly clustered on **64**, which is
exactly Logic's pan centre on its ±64 scale (the learnings log already records that Logic's
±64 pan maps to −1…+1 over MCU). It is *identical* between the two alternatives, consistent
with pans not having been changed between them. **[UNTESTED against a known per-channel pan]** —
one hand-set pan, one save, one diff would confirm or kill it in minutes.

`ivnE` records also differ between the alternatives, clustered in a contiguous run at
`+0x1a2 … +0x1ab`. Unidentified. **[UNTESTED]**

**Correcting the scoping.** It was suggested that having six channels at known dB values in
one saved project makes this question *cheaper* than a set-save-diff cycle per point — six
simultaneous knowns instead of one. That is true for **calibrating** the field once found, and
it is a real saving. It does not help **locate** it: the scan for both plausible encodings came
back empty, and the diff's loudest signal is a flag. The set-save-diff cycle is still needed
for the locate step. Realistically: one controlled experiment (move exactly one fader by a
known amount, save, diff a single `OCuA`) locates it; the six anchors then calibrate it in one
pass instead of six. Budget accordingly — this is the phase most likely to overrun.

**A second instance of the two-sample-inference trap, worth recording next to the `.exs` one.**
The fader law itself was fitted twice from too few points and was wrong both times:
`0.758 + 0.026·dB` was ~1 dB out at −16, and a refit on two points
(`0.7388 + 0.02313·dB`) was **3.7 dB out at −23.7**. The fader is a taper, not a line — travel
per dB runs 0.0263 from −6 up, then 0.0231, 0.0222, and **collapses to 0.0086 below −18 dB**,
which is exactly where drum spot mics, room mics and sampler layers sit. **Interpolate between
anchors; never fit.** **[verified hands-on]** The `.exs` warning was about inferring a *byte
field* from one sample; this is the same error applied to a *value scale*, and it cost more.
Any `logic-cli` that reports dB must ship the anchor table, interpolate, and return "unknown"
outside the anchor range rather than extrapolating.

---

## 6. Capability matrix

Reliability is my judgement of what happens on the tenth run, unattended, with Logic busy.

| Operation | Best channel | Feasible? | Reliability | Notes |
|---|---|---|---|---|
| **Export All Tracks as Audio Files** | Menu via CGEvent + prefs + AXObserver | Yes | Medium | Menu item exists; no scriptable verb anywhere. §6.3–6.4 |
| **Bounce project / section** | Same, plus prefs for format | Yes | Medium-high | MCP already 80 % there; fix the poll |
| **Reliable completion detection** | `AXObserver` on progress window + file-stability | Yes | High | The one place AX is clearly right. Manual version validated ×3 |
| **Knowing an export is *correct*** | Loudness check against expected range | Yes | High | **Structural checks all pass on a soloed bounce — §6.5** |
| **Export preflight (focus, solo)** | `AXRaise` + one mixer read | Yes | High | Both failures observed; §6.5–6.6. Detect and refuse, never auto-fix |
| **Read track/channel names + order** | **Offline `ProjectData`** | **Yes — done** | **High** | §5.3, verified on two projects |
| **Read bus/send routing** | Offline `ProjectData` | Probably | Medium | Bus objects visible by name; routing fields unmapped **[UNTESTED]** |
| **Read insert chains per channel** | Offline `ProjectData` | Probably | Medium | `OCuA`→`UCuA` adjacency clear; slot indices unmapped |
| **Read fader dB** | **Offline only — no other route exists** | Unresolved | — | AX publishes no dB at all. Storage not yet located (§5.6) |
| **Read fader raw position** | MCU readback (MCP has it) | Yes | Medium | Detented; needs the anchor table to become dB, never a fit |
| **Read pan** | Offline `OCuA +0x7d` (candidate) | Probably | Unknown | Strong candidate, one experiment from confirmed (§5.6) |
| **Read sample rate** | **`MetaData.plist`** | **Yes — done** | **High** | Fixes a known-wrong MCP field |
| **Read project alternatives** | **`ProjectInformation.plist`** | **Yes — done** | **High** | Names + active index |
| **Read tempo / signature / key** | `MetaData.plist` (+ `ProjectData` for the map) | Yes | High / medium | Single tempo free; tempo *map* needs the `qSvE` walk |
| **Read markers** | Offline `qSvE` + `qSxT` | Probably | Medium | Published method; names are RTF in a linked chunk **[UNTESTED here]** |
| **Read SMPTE offset ("Plays at SMPTE")** | Offline `gnoS` | Probably | Unknown | Not located. **[UNTESTED]** |
| **Read region positions** | Offline `gRuA` | Probably | Medium | Names verified; position fields unmapped |
| **Identify which plugin is in which slot** | **Offline `UCuA`** | Probably | Medium | **MCP is unreliable here — see §6.2** |
| **Set plugin parameters** | MCU V-pots / write a `.pst` | Partly | Low / medium | MCP reaches Compressor threshold only; and see §6.2 |
| **Bypass / enable a plugin** | AX click, or MCU | Yes | Low-medium | Small, focused, verifiable — a fair candidate |
| **Set channel format mono/stereo** | AX click on the format button | Yes | Low | MCP can't. One click by hand. **Leave it manual** |
| **Rename / reorder / mute / solo** | MCU (MCP has it) | Yes | Medium-high | Don't rebuild |
| **Save / Save As / new alternative** | ⌘S via CGEvent; alternatives via menu | Yes | Medium | ⌘S is safe; Save As means a save panel again |
| **Import audio / place regions** | FCPXML import (`make_fcpxml.py`) | Yes | Medium | Already solved outside the MCP |
| **Anything writing `ProjectData`** | — | Technically yes | **Unacceptable** | See §9 |

### 6.2 The MCP's two inventory surfaces disagree with each other

**[verified hands-on]** On the same channel (Hi-Hats), `get_inventory` reports **six occupied
insert slots** while `logic://mixer` reports **four plugins**. Only `logic://mixer` returns
plugin names at all; `get_inventory` returns every occupied slot as `audioPlugIn` with a
**null `plugin_id`**.

Two consequences, and both matter more than they first look:

1. **Do not write plugin parameters through the MCP by slot index.** If the two surfaces
   disagree about how many slots are occupied, an index-addressed write can land on the wrong
   plugin — the same class of failure as the track-index shift already recorded in the
   learnings log (a rename that hit Rack 2 instead of Floor), but harder to notice because a
   wrong parameter change makes a sound rather than an obviously wrong label.
2. **Plugin identification is a genuine capability gap, not a convenience gap.** The offline
   `UCuA` records carry plugin display names directly and in file order (§5.3), and the
   learnings log already notes the MCP's `get_inventory` lists inserts *bottom-up*, needing
   reversal before you can reason about chain order. An offline reader has no bank limit, no
   null IDs, no ordering surprise, and no disagreement with itself.

This moves "read insert chains" up the priority list for Phase 1: it is not duplicating
something the MCP does adequately, it is replacing something the MCP does inconsistently.

### 6.3 The export-settings discovery

`~/Library/Preferences/com.apple.logic10.plist` (534 top-level keys) contains, as plain
readable values **[verified]**:

```
BounceFileType 2         BounceBitSize 24        BounceOffline 1
BounceStereoType 2       BounceDitherType 0      BounceAddEffectTail False
BounceNormalizeOverloadProtectionOnly False      BounceAutoNormalize False
BounceIncludeTempoInformation False              defaultBouncePath /tmp
NSWindow Frame Bounce  2136 333 671 475 …        bounceAddToiTunes 0
TrackExportFileTypeIndex 2   TrackExportBitsSampleIndex 3
BTIP_NormalizeMode 2  BTIP_AsAdditionalTracks  BTIP_IncludeAutomation
ExportAACBitRate 128  ExportAACSampleRate 0  ExportM4AAppleLossless False
```

`TrackExport*` are the *All Tracks as Audio Files* settings. `BTIP_*`/`BRIP_*` are Bounce Track
/ Region In Place. `NSWindow Frame Bounce` even gives the dialog's saved geometry, which is a
far better source for click coordinates than the MCP's hardcoded fractions.

**If these are writable and re-read, most of the export dialog collapses to a `defaults write`
plus one menu keystroke.** That would remove the majority of the brittle pixel-poking in one
step. It is the highest-leverage untested question in this document.

The caveat is real: the plist's mtime was **10:28 while Logic had been running since 09:17**,
so Logic flushes preferences *while running*, not only at quit. **[verified]** So a naive
`defaults write` mid-session will very likely be clobbered, and Logic may not re-read it
anyway. The safe pattern is to write with Logic quit; whether a running Logic can be made to
pick up a change is **[UNTESTED]**.

### 6.4 Completion detection that actually works

Four signals, in increasing order of trustworthiness. Use all four — and note that §6.5 shows
the first three can *all* pass on a file that is garbage.

1. **File stability, not file existence.** Wait for the expected output to appear, *then* for
   its size and mtime to hold steady for N seconds. The learnings log already records the
   related trap: *"Logic appends `_1` to exported stem names when the export finishes, which
   pulls files out from under a running analysis — wait for the rename, not just for the size
   to stop growing."* **[verified, from our own log]** So for a multi-file export the terminal
   event is the *rename*, not the size plateau.
2. **`AXObserver` on the progress window.** Register
   `kAXWindowCreatedNotification` + `kAXUIElementDestroyedNotification` on Logic's application
   element before firing the export, and treat destruction of the progress sheet as the
   completion edge. Event-driven, so it costs Logic nothing while waiting. **[inference from
   cited AX docs — UNTESTED against Logic's actual bounce window]**
3. **No fixed timeout.** Budget by material: a 28-minute set bounced offline is minutes of
   wall clock. Any cap should be derived from project length, with a floor of several minutes,
   and should report "still running" rather than "failed".
4. **A content check.** Integrated loudness against an expected range. This is the only signal
   in the list that can tell a correct bounce from the failure in §6.5, and it is the reason
   the list has four entries instead of three.

And do not copy, rename or report the file until all four agree.

**The manual version of this is already validated.** Ignoring the MCP's error and watching the
file at `/private/tmp/<Project Name>.wav` for size stability has now worked reliably on three
long bounces. **[verified hands-on]** That is signals 1 and 3 done by hand, end to end, on real
material — which is the strongest evidence in this document that Phase 2 is buildable, because
the algorithm has already been executed successfully by a human. The tool's job is to add
signals 2 and 4 and stop requiring someone to sit there.

### 6.5 An export can be complete, well-formed, and wrong

**[verified hands-on]** This is the most dangerous finding in the document and the one Phase 2
must be designed around from the start.

**A bounce respects solo.** A full 12-minute render produced a file that was:

- the correct length,
- the correct format,
- the correct sample rate,
- 556 MB, size-stable,

and contained **only the two soloed channels**. Nothing in the tool response flagged it.
Nothing in the file metadata flagged it. Every structural check passed.

The tell was **loudness: −43.6 LUFS against −20.0 for the real mix.** A ~24 LU gap — not
subtle, but invisible to anything that only looks at existence, size, duration and format.

Three design consequences:

1. **§6.4's first three signals are insufficient, and I had them wrong.** The original draft of
   this document proposed file-stability plus an `AXObserver` edge plus a generous timeout and
   called that "completion detection that actually works". It would have declared this bounce a
   success. **Verification of an export is not complete without a content check.** Signal 4
   above exists because of this.
2. **`logic-cli export` needs a preflight that reads solo and mute state** from the mixer and
   **refuses** — or at minimum warns very loudly — when anything is soloed. Cheap: this is
   exactly the kind of state the offline reader will already be parsing, though for a
   *preflight* it must come from the live session, not the last save (see the caveat below).
3. **Refuse, do not remediate.** `logic_tracks.solo` routes through MCU, and with MCU
   unregistered it returns `channels_exhausted` with no key-command fallback — so the tool can
   *detect* a stray solo but cannot *clear* it. **[verified hands-on]** Attempting to clear it
   and silently failing would be worse than refusing, because it would produce the same
   garbage file with an added claim that the problem was handled.

There is a real wrinkle in (2) worth stating plainly: **solo state is live-session state, and
the offline reader by definition sees only the last save.** A user who solos a channel and
bounces without saving is invisible to a `ProjectData` parse. So the preflight has to read solo
from the live session — MCU or a narrow AX query — which means Phase 2 cannot be purely
offline. That is acceptable (it is one small read, not a tree walk), but it should be a
deliberate choice rather than a discovery made later.

The generalisation worth carrying beyond this one bug: **for any long unattended operation, ask
what a plausible wrong result would look like, and check for that specifically.** Structural
checks confirm the operation ran; only a content check confirms it ran on the right thing. This
is the same lesson the mix-scan work already learned twice — *"use an absolute threshold
whenever 'did X respond to Y' is the question"*, and the snare-bleed correction — arriving now
in the export path.

### 6.6 The Arrange window must be frontmost

**[verified hands-on]** With the Mixer window on top, `export_run` returns
`bounce_dialog_did_not_appear` with `bounce_fired: false`. The Bounce dialog simply does not
open. The fix is one `AXRaise` on the first window whose name does not contain "Mixer", then
retry — which worked first time.

`logic-cli export` should do this **unconditionally** before triggering anything. It costs one
AX call, it is idempotent, and the failure it prevents is otherwise completely opaque — the
error names the dialog, not the focus.

This is also a datum for open question 3: a KeyCommands-triggered export would presumably hit
the same window-focus constraint, so whichever command ID turns out to be *Export All Tracks as
Audio Files*, **the raise still has to happen first**. Finding the ID does not remove the need
for a focus preflight.

---

## 7. Proposed architecture, if built

**Language: Python.** The consistency argument for TypeScript is weak here — this tool never
touches the Next.js app, never ships to Vercel, and shares nothing with `src/`. Everything it
must talk to is already Python-shaped: `doc/production/scripts/` is Python with a venv,
`build_exs.py` is the direct precedent for the binary parsing, `plistlib` and `struct` are
stdlib, `ctypes` reaches CoreFoundation/ApplicationServices for AX and CGEvent without a
build step, and `ffprobe`-based QA is already scripted there. Put it in
`doc/production/scripts/logic_cli/` and reuse the existing venv.

**Shape: one binary, subcommands, always exits.**

```
logic-cli read project   <project.logicx> [--alternative N]   # offline, no Logic
logic-cli read mixer     <project.logicx> [--json]            # offline
logic-cli read inserts   <project.logicx>                     # offline
logic-cli export stems   --out DIR [--format wav --depth 24]  # drives Logic
logic-cli export bounce  --out FILE [--from BAR --to BAR]     # drives Logic
logic-cli watch bounce   --expect DIR                         # AXObserver + file stability
logic-cli doctor                                              # permissions, orphans, versions
```

Three hard rules:

1. **No daemon, no server, no MCP surface.** The whole point is a process that exits. Exposing
   MCP would reintroduce exactly the lifecycle bug being escaped. If an agent needs it, it can
   shell out — Claude Code already runs Bash.
2. **`read` never talks to Logic.** Not "prefers not to" — cannot. It takes a path to a
   `.logicx` and parses bytes. That is what makes it usable while a render is in flight, and
   what makes it impossible for it to starve anything.
3. **`export` holds Logic's attention for the shortest possible window**, then hands off to
   `watch`, which waits event-driven. Never poll the AX tree in a loop; never walk children
   recursively; use `AXUIElementCopyMultipleAttributeValues` for anything multi-field; set
   `AXUIElementSetMessagingTimeout` explicitly.

**The export preflight, in order.** Every step here exists because of an observed failure, not
a hypothetical one:

```
1. AXRaise the first window whose name lacks "Mixer"      # §6.6 — else the dialog never opens
2. read solo + mute state from the live session           # §6.5 — refuse if anything soloed
3. resolve the real staging path from defaultBouncePath   # §3.2 — /tmp, not ~/Downloads
4. set format/depth via prefs (if question 1 says yes)    # §6.3
5. trigger, then hand off to `watch`
6. post-export: loudness against an expected range        # §6.5 — the only garbage detector
```

Steps 1 and 3 are unconditional and nearly free. Step 2 is the one that forces `export` to
touch the live session rather than the last save, and it should be a single narrow read, never
a tree walk. Step 6 is what separates "the bounce finished" from "the bounce is usable" — see
§6.5 for the 556 MB file that passed every other check.

**Refuse rather than remediate.** When the preflight finds a stray solo, stop and say so. The
tool cannot clear it (`logic_tracks.solo` returns `channels_exhausted` without MCU registered),
and a remediation that silently fails is worse than no remediation, because it produces the
same bad file plus a false claim that the problem was handled. This is the general rule for
the whole tool: **refuse loudly in preference to acting unreliably.**

**Version guarding.** `ProjectInformation.plist` carries `LastSavedFrom: "Logic Pro 12.2 (6644)"`.
Record the build the offsets were calibrated against and **refuse to parse, loudly, when the
build differs** — with a `--force` for the operator who wants to find out. Silent
mis-parsing of a binary is the failure mode that costs days.

**Anchor table, not a formula.** Any dB the tool reports comes from interpolating the confirmed
anchor table (§5.6) and returns `null` outside its range. No fitted curve, ever.

**Orphan hygiene, independent of any of this.** `logic-cli doctor` should report stray
`LogicProMCP` processes with their elapsed time and parent, and offer to kill them. And a
`SessionEnd` hook that runs `pkill -f LogicProMCP` would have prevented the whole incident.
That is a five-minute fix available *today*, with or without this tool.

---

## 8. Should the effort go upstream instead?

Partly, but it is not the main path.

**What I established.** `logic-pro-mcp` 3.14.0 is a 42 MB universal Swift binary linking
CoreMIDI, ApplicationServices, CoreGraphics and AVFoundation, installed from the
`monglong0214/logic-pro-mcp` tap, licence declared MIT, sources at
`github.com/MongLong0214/logic-pro-mcp` with `swift build -c release` documented. The Python
helpers ship in plaintext in `share/logic-pro-mcp/`. **[verified]**

**What is worth sending upstream** — two concrete, self-contained bugs in `logic_bounce.py`:

1. The 25-second completion poll, which false-fails every long bounce. **Now observed three
   times in practice**, so the report can carry evidence rather than a code reading.
2. Copying the staged artifact as soon as it appears, with no wait for the write to complete —
   a silent-truncation risk that reports success.
3. **The helper looks for the artifact in the wrong place under the wrong name** (§3.2). It
   globs `~/Downloads/<name>--lpmcp-<uuid8>.*`; the file actually lands at
   `/private/tmp/<Project Name>.wav`, i.e. at `defaultBouncePath` under Logic's own default
   name, because the sidebar click and the Save As typing are both missing. This is arguably
   the *primary* bug — fixing the timeout alone would not make the current code work.
4. **`export_run` fails opaquely when the Mixer window is frontmost** (§6.6), reporting
   `bounce_dialog_did_not_appear`. A one-line `AXRaise` before triggering fixes it.
5. **No guard against bouncing with channels soloed** (§6.5). Given the server already reads
   mixer state, a preflight warning would cost little and prevents a whole class of
   plausible-looking wrong output.

All five are small and self-contained, and all are worth reporting whatever else gets built.
Bugs 1, 3, 4 and 5 now have hands-on reproductions behind them rather than only a code
reading. Two further notes worth raising as issues even if nobody fixes them soon:
`logic_ui_jxa.py`'s depth-6 recursive JXA tree walk is what pegs Logic's main thread and the
server should not outlive its client; and `get_inventory` disagreeing with `logic://mixer`
about the same channel's insert count (§6.2) is a correctness bug, not a cosmetic one.

**Why upstream isn't the plan.** Turnaround depends on a maintainer; the parts we most need
(All Tracks export, insert chains past slot 0, sends, strip format, fader dB) are *new
features* in someone else's roadmap, not bug fixes; and none of the offline-parsing value
belongs in an MCP server at all. Do both: file the bugs, build the reader.

---

## 9. Do not attempt

- **Writing anything into `ProjectData`.** Reading is cheap and safe; writing risks a mix
  session with hours of work in it. `lpx-toolkit` made read-only a CI-enforced invariant for
  exactly this reason, and they were only inspecting other people's archives. We would be
  editing the live project.
- **A long-lived server, an MCP surface, or any background watcher.** The failure being
  escaped is a process that outlives its purpose.
- **Any continuous AX poll**, at any interval, for any reason.
- **Fitting a curve to the fader taper.** Interpolate between anchors or return unknown. Two
  people have now fitted lines to it and both were wrong, the second by 3.7 dB (§5.6).
- **Writing plugin parameters through the MCP by slot index** until §6.2 is resolved.
- **Auto-clearing a stray solo before an export.** Detect and refuse. The MCU path can't clear
  it reliably, and a silent failure here produces a plausible-looking wrong file (§6.5).
- **Reporting an export as successful on structural checks alone.** No content check, no
  success claim.
- **Channel strip mono/stereo format.** One click, and the MCP already can't reach it.
- **Track icons, summing stacks, screensets, plugin GUI layout.** Fast by hand, brittle to
  automate, low value.
- **Surgical pan/width via MCU.** Detented; placement-grade only, as the learnings log says.
- **Reimplementing MCU for mixer writes.** Parity work, zero new capability.
- **Rewriting bindings by patching `.logikcs`.** The payload is opaque. If key-command
  assignment is wanted, go via the `KeyCommands` preference dict — and only with Logic quit.
- **Trusting any parse across a Logic point release without re-verifying.** See §10.

---

## 10. What breaks on a Logic point release

Ranked by fragility, worst first:

1. **Hardcoded save-panel pixel offsets.** The MCP's `(x + 0.591·w, y + 54)` will break on any
   dialog relayout, and gives no error — it clicks the wrong thing. `NSWindow Frame Bounce`
   from prefs is a better anchor; AX-located fields better still where they're exposed.
2. **Record field offsets in `ProjectData`.** Already demonstrated: the 11.2.2 spec's track
   name at payload `+0x34` does not hold on 12.2. Chunk *tags* and the size-chained walk look
   stable across that gap; *offsets within* payloads do not. Guard on `LastSavedFrom`.
3. **The fader anchor table.** Tied to Logic's taper, which is unlikely to change but is
   unversioned and unpublished. Re-check one anchor after any upgrade.
4. **Preference key names.** Historically stable across Logic X's life, but unversioned and
   undocumented. Cheap to re-verify.
5. **AX role/title strings**, including the localisation traps the MCP already carries
   (`"OK"`/`"확인"`, `"bounce"`/`"바운스"`).
6. **MCU protocol.** Effectively frozen; a 20-year-old protocol Apple has no reason to touch.
7. **The plists** (`ProjectInformation`, `MetaData`) — versioned, self-describing, lowest risk
   of the lot.

The design consequence: **put everything that can break into the smallest possible surface, and
make it fail loudly.** Every offset in one table, keyed by Logic build. A `logic-cli doctor`
that re-verifies known values against a fixture project.

---

## 11. Open questions — most untested, most cheap to settle

Ordered by value-per-minute. Question 1 has since picked up partial evidence; the
rest are open.

1. **Do `defaults write com.apple.logic10 BounceFileType/BounceBitSize/TrackExportFileTypeIndex`
   actually take effect?** Test with Logic quit, relaunch, open the dialog, look. If yes, most
   of the export fragility disappears. *Highest value question in this document.*

   **Partial evidence in favour, arrived at sideways.** The observed staging path for a bounce
   is `/private/tmp/<Project Name>.wav`, and the preference `defaultBouncePath` reads `/tmp`.
   Logic is demonstrably *honouring* that key. **[verified hands-on + verified]** That is not
   proof that *writing* the key takes effect — the value may have been set through the UI long
   ago — but it moves the question from "does Logic use these preferences at all" (yes) to
   "does it re-read them after an external write" (still open, question 2).
2. **Does Logic re-read those prefs while running?** Almost certainly not, but worth knowing —
   it decides whether `export` must quit and relaunch Logic or can work in-session.
3. **Which `KeyCommands` numeric ID is "Export All Tracks as Audio Files"?** Assign it by hand
   once, diff the plist. Gives a keystroke-triggerable export with no menu walking. **Note it
   does not remove the focus preflight** — a keystroke route would hit the same
   Arrange-window-frontmost constraint as the menu route (§6.6), so the `AXRaise` happens
   first either way.
4. **Does the bounce progress window emit a usable `AXObserver` edge?** Register
   window-created/destroyed on Logic's app element, fire a short bounce, log what arrives.
   Settles §6.4 signal 2.
5. **Where is the fader stored in `OCuA`?** **Re-scoped by §5.6, and harder than it looked.**
   Two encodings are eliminated (dB float, 0..1 raw) and the alternative-diff route is
   poisoned by a project-wide boolean at `+0x7e`. Needs one *controlled* change: move exactly
   one fader by a known amount, save to a new alternative, diff that one `OCuA` record. The six
   confirmed anchors then calibrate the scale in a single pass rather than six.
6. **Is `OCuA +0x7d` pan?** Values cluster on 64 across 310 records, which is Logic's pan
   centre. One hand-set pan, one save, one diff confirms or kills it. Cheapest open question
   here, and it would be the first *value* field located.
7. **`OCuA` → `UCuA` slot mapping**, and reconciling it against the §6.2 disagreement. Insert a
   distinctive plugin in a known slot, save, diff. `lpx-toolkit`'s author didn't solve this;
   budget accordingly.
8. **What is the `ivnE +0x1a2…+0x1ab` run?** It is the only other thing that changed between
   the two Epsilon alternatives. Unidentified.
9. **Why do the MCP's save-panel clicks miss?** The staging evidence in §3.2 says both the
   sidebar click and the Save As typing are failing silently — the file lands at
   `defaultBouncePath` under the project name, not at `~/Downloads` under the generated staging
   name. Is the panel geometry different from the "calibrated" frame, is the click landing
   before the panel is interactive, or is focus elsewhere? Worth ten minutes because it decides
   whether `logic-cli export` can reuse *any* of the coordinate approach or must locate fields
   through AX. Also the difference between a good upstream bug report and a vague one.
10. **Does a generic OSC control surface actually exist in Setup › New?** Thirty seconds to
    look. If yes, §4 changes materially and much of §7 should be reconsidered.
11. **Does `karT` record order match Logic's visible track order?** `lpx-toolkit` says no.
    Verify before any tool reports "track 7".
12. **Where is "Plays at SMPTE" stored?** Probably in `gnoS`. Set it to a known TC, save, diff.
13. **Do the MCP's `_1` rename and the copy-on-appear race actually corrupt a long bounce?**
    Worth reproducing once so the upstream bug report carries evidence.

---

## 12. Phased plan

**Phase 0 — free, do today (30 minutes).** A `SessionEnd` hook running `pkill -f LogicProMCP`,
plus `ps -eo pid,ppid,etime,command | grep LogicProMCP` added to the pre-mix checklist. This
alone removes the failure that started the conversation, and it does not depend on anything
below.

**Phase 1 — `logic-cli read` (about a day).** Offline only. `ProjectInformation.plist` +
`MetaData.plist` + the `ProjectData` chunk walk. Ships: alternatives with names and active
index, real sample rate, tempo/signature/key, the full mixer channel list in order (buses and
outputs included), region and audio-file inventory, and the plugin-instance inventory by name —
which per §6.2 is a *correctness* improvement on the MCP, not just a convenience. Build guard
on `LastSavedFrom`. **This is worth doing even if nothing else on this list ever gets built.**

**Phase 2 — `logic-cli export` + `watch` (one to two days, gated on question 1).** Set format
and depth via prefs; run the preflight in §7 (raise the Arrange window, refuse on stray solo,
resolve the real staging path); trigger; hand off to event-driven completion detection with
file-stability confirmation, no fixed timeout, and a loudness sanity check. Covers both *All
Tracks as Audio Files* and stereo bounce. If question 1 comes back negative, this phase gets
meaningfully harder and should be re-scoped before starting, not pushed through.

**The core of this phase has already been validated by hand.** Ignoring the MCP's spurious
error and watching `/private/tmp/<Project Name>.wav` for size stability has worked on three
long bounces. **[verified hands-on]** Phase 2 is therefore not speculative engineering — it is
automating a procedure that is already known to work, and adding the two checks (window focus,
content sanity) that the manual procedure discovered the hard way.

**Phase 3 — values: pan, then faders (open-ended, start with the cheap one).** Do question 6
(pan at `+0x7d`) first — it is one experiment and would be the first confirmed value field. Only
then attempt question 5. Ship the anchor-table interpolation alongside, since a located fader
field is useless without it. **Stop at any point where the marginal field stops earning its
keep; §5.6 is honest that this phase can overrun.**

**Never — mixer writes, a server, a `ProjectData` writer.**

---

## 13. The critical read

The case *against* building anything:

- The MCP plus the ad-hoc Python already covers most of the daily need. Mixer writes work.
  Region placement is solved by `make_fcpxml.py`. Analysis is solved by the `scripts/` suite.
- GUI automation of a DAW is genuinely brittle, and the MCP's hardcoded save-panel fractions
  are proof of how brittle. Formalising more of it means owning more of it.
- The line between "worth automating" and "just click it" is roughly: **operations repeated per
  band per song, or that must be verifiable after the fact, are worth automating; one-off
  configuration is not.** Stem export for five bands × six alternatives crosses that line
  easily. Setting a channel to mono does not.

The case *for* survives that scrutiny, and got stronger during the investigation:

- **The offline reader is not GUI automation at all.** It has none of the brittleness the
  argument above is about. Same category of work as `build_exs.py`, which paid off.
- **Two capabilities turn out to have no alternative implementation.** Fader dB is not
  published by AX at any level, and plugin slot identification is inconsistent between the
  MCP's own two surfaces. Those are gaps, not preferences.
- **The export gap is real, recurring, and larger than a 25-second constant.** Hands-on
  testing found the helper searching the wrong directory under the wrong filename, an opaque
  failure whenever the Mixer window is frontmost, and — worst — a 12-minute render that passed
  every structural check while containing only the soloed channels. That last one is not a
  convenience problem. It is the kind of failure that ships.
- **The lifecycle fix is nearly free** and independent of everything else.

So: build the reader, fix the export, kill the orphans, file the upstream bugs, and leave the
mixer writes alone. Anything more ambitious than that is a tool-building project wearing a
mixing project's clothes.

---

## Appendix — reproduction notes

§5 came from
`/Volumes/Extreme SSD/bottb/events/2026/Brisbane/02_Production/The ShipRex/ShipReX - Full Set.logicx`
(25 tracks, 6 alternatives) and
`…/Epsilon/Epsilon - Whole Set.logicx` (2 alternatives), both last saved from Logic Pro 12.2
build 6644.

Chunk walk:

```python
import struct
d = open('Alternatives/000/ProjectData', 'rb').read()
assert d[:6] == bytes.fromhex('2347c0abd009')
assert struct.unpack_from('<I', d, 0x10)[0] == len(d) - 24
off, recs = 0x18, []
while off + 0x24 <= len(d):
    tag  = d[off:off+4].decode('latin1')          # reversed FourCC
    size = 0x24 + struct.unpack_from('<I', d, off+0x1c)[0]
    recs.append((off, tag, size))
    off += size
assert off == len(d)                              # consumed exactly
```

Names are `uint16` length-prefixed ASCII, NUL-terminated, at fixed offsets **for Logic 12.2**
(re-verify on any other build):

| Chunk | Offset | Contents | Confidence |
|---|---|---|---|
| `ivnE` | `+0xC4` | mixer/environment object name (channels, buses, outputs) | verified, 2 projects |
| `gRuA` | `+0x70` | audio region name | verified |
| `qeSM` | `+0x36` | sequence name (the project name lives here) | verified |
| `UCuA` | `+0x9C` | plug-in display name | verified, not universal |
| `lFuA` | — | audio filename as UTF-16LE, findable by regex | verified |
| `OCuA` | `+0x7D` | **pan?** — clusters on 64 across 310 records | **candidate, untested** |
| `OCuA` | `+0x7E` | boolean flag, values {0,2} — **not the fader** | verified negative |
| `ivnE` | `+0x1A2…+0x1AB` | changes between alternatives; unidentified | unknown |

Embedded `bplist00` blobs: locate by searching for the magic, then find the extent by scanning
candidate lengths `L` for a self-consistent 32-byte trailer
(`offsetTableOffset + numObjects × offsetSize == L − 32`), then `plistlib.loads`. All 137 in
the ShipRex file parse; all are Smart Controls data, none are mixer state.

Confirmed fader anchors (raw 0..1 → dB), for interpolation only — **never fit a curve**:

```
0.27556 -> -23.7    0.32444 -> -18.0    0.37333 -> -15.8
0.60000 ->  -6.0    0.75789 ->   0.0    0.78421 ->  +1.0
```
