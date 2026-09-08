# Backdrop screen flicker — investigation and Resolve treatment recipe

**BOTTB Brisbane 2026 · written 2026-09-07 · analysis done offline on proxies + full-res spot checks; no project changes made**

## TL;DR

- The backdrop is not an LED wall — the Triffid spec says **200″ projection screen, Epson 3LCD projector, 1920×1080 over HDMI** (see `triffid-tech-spec.md`). Fed at 60 Hz, its light output is periodic at 30 Hz; against our 25p cameras that aliases to **exactly 5 Hz — a 5-frame cycle** (plus a 10 Hz harmonic from the 60 Hz component).
- Measured on all three static cameras, at five times across the night: the alias sits at **5.000 ± 0.02 Hz, all night, luma and chroma**. The pattern repeats every 5 frames almost perfectly.
- That makes the fix mechanical: **any temporal window spanning a whole number of 5-frame cycles nulls the flicker exactly.** The Deflicker default window is 7 frames (Frames Either Side = 3) — 7 is not a multiple of 5, which is precisely why Fluoro Light only got ~46% on the wide and almost nothing on the CAM C close-ups.
- Offline prototype (numpy, 5-frame temporal mean = what Deflicker/TNR approximates with the right window): **96–98% band removal**, banding metric 0.54 → 0.03 (CAM D), 0.17 → 0.07 (CAM C). The "moiré" is the flicker's own sawtooth spatial texture, not a scaling artifact — it dies with the same treatment because the kill is per-pixel temporal.
- Recipe in one line: screen-windowed node, **Deflicker → Advanced Controls → Frames Either Side = 2** (or Temporal NR, Number of Frames = 5), chroma treated too, on every camera group.

---

## 1. What was measured

Method: decoded short segments (4–20 s) from the half-res proxies (full-res originals for spatial/chroma spot checks), per-pixel temporal high-pass, FFT at 25 fps, plus a coherent 5 Hz demodulation to map flicker amplitude and phase across the frame. Screen regions located automatically from the temporal-spectral peak maps; banding metric is the one used so far (high-passed row-mean profile, mean |frame-to-frame delta|, 8-bit levels).

### Temporal signature (the load-bearing fact)

| Segment (proxy frame)             | Y peak         | Y mod (hp-rms % of screen level) | 5 Hz amp p95 (8-bit) | U / V mod % | banding metric |
| --------------------------------- | -------------- | -------------------------------- | -------------------- | ----------- | -------------- |
| B C8817 @ 39100 (The Chain)       | 5.00 Hz        | 4.3%                             | 2.9                  | 1.4 / 1.2   | 0.30           |
| B C8817 @ 43700                   | 5 Hz + content | 8.6%                             | 2.7                  | 6.1 / 4.7   | 0.48           |
| B C8816 @ 30000 (earlier set)     | 5 Hz + content | 10.8%                            | 3.1                  | 2.6 / 3.3   | 0.97           |
| B C8820 @ 20000 (later set)       | 5 Hz + content | 12.4%                            | 3.1                  | 9.6 / 3.5   | 0.76           |
| B C8821 @ 25000                   | 5 Hz + content | 11.7%                            | 1.8                  | 2.6 / 2.3   | 0.42           |
| C 4162 @ 39250 (The Chain)        | 5.00 Hz        | 4.6%                             | 2.5                  | 2.0 / 2.0   | 0.22           |
| C 4162 @ 41100 (close-up cut 528) | 5.00 Hz        | 9.6%                             | 3.2                  | 3.1 / 2.3   | 0.17           |
| C 4161 @ 30000                    | 5.00 Hz        | 7.2%                             | 2.5                  | 2.0 / 3.8   | 0.52           |
| C 4164 @ 20000                    | 5 Hz + content | 11.2%                            | 2.8                  | 7.1 / 3.8   | 0.72           |
| C 4165 @ 25000                    | 5.00 Hz        | 13.4%                            | 2.7                  | 1.5 / 2.3   | 0.58           |
| D C3778 @ 39500 (The Chain)       | 5.00 Hz        | 2.7%                             | 2.1                  | 1.2 / 1.3   | 0.36           |
| D C3778 @ 43500                   | 5 Hz + content | 5.5%                             | 1.6                  | 2.9 / 2.8   | 0.36           |
| D C3777 @ 30000                   | 5.01 Hz        | 4.1%                             | 2.9                  | 2.3 / 4.9   | 0.58           |
| D C3781 @ 20000                   | 5 Hz + content | 3.8%                             | 1.3                  | 3.6 / 2.6   | 0.18           |
| D C3782 @ 25000                   | 5.00 Hz        | 4.9%                             | 3.9                  | 4.2 / 2.0   | 0.16           |

("5 Hz + content" = the 5 Hz spike is present but broadband screen-content motion carries more total energy in that segment; the coherent 5 Hz amplitude column is the flicker itself.)

- **Frequency lock:** phase-drift measurement over 20 s windows puts the alias at **4.982–5.005 Hz** (drift of a full cycle takes ~1–6 minutes). Same value on all three cameras and at every time sampled — one common optical source, stable all night.
- **Harmonic at 10.00 Hz** everywhere (≈ 60–80% of the 5 Hz amplitude).
- **Chroma flickers too:** U/V 5 Hz amplitude p95 up to ~2.9 (proxy) and 1.4 (full-res CAM C U plane). A luma-only treatment would leave a coloured shimmer — part of the "moiré" complaint.
- **On vs off screen:** control regions beside the screen show banding metric ~0.13 vs 0.30+ on-screen (CAM B), i.e. the screen dominates; but on CAM D the 5 Hz phase map shows the flicker spilling as light onto the whole back wall around the screen — the window should be drawn generously.

### Spatial signature (why it looked like moiré)

- **Rolling bands, not a global pulse.** The 5 Hz phase advances with row: CAM D (A7 IV, slowest readout) shows clean rolling bands, wavelength ≈ 166 UHD rows, rolling ≈ 33 UHD rows/frame — i.e. exactly 1/5 wavelength per frame, consistent with the 5-frame cycle. CAM B/C (A7S III, faster readout) show broader bands (≈ 350–500 UHD rows on the CAM C full-res check) with patchier phase.
- **Sawtooth microstructure.** The full-res 5 Hz amplitude map on CAM C shows the band edges as a sharp triangular zigzag lattice (~25–30 px pitch at UHD). This _is_ the "moiré-like pattern": it is the spatial texture of the flicker field itself. When Deflicker removes the flicker only partially, this lattice is what remains half-visible and reads as moiré. It is not a scaling/resampling artifact, and it disappears when the temporal cycle is fully cancelled (verified in the prototype — see §3).

## 2. Physical cause chain (with confidence)

1. **High confidence:** The backdrop projector (Epson 3LCD, 1080p, HDMI direct from a laptop) ran at **60 Hz**, the laptop default. A 3LCD projector's light output is periodic at 30 Hz (LCD polarity inversion at half the refresh) with strong content at 60 Hz and at high-order panel-drive multiples. Every component of a 30 Hz-periodic signal aliases onto multiples of 5 Hz at 25 fps (30→5, 60→10, 480→5, …), and 5 frames at 25p = 200 ms = exactly 6 cycles of 30 Hz — hence the exact 5-frame repeat. The measured 5.000 ± 0.02 Hz means the projector clock was within 0.07% of nominal. This explains the frequency, the harmonic, the all-night stability, and its presence on every camera including the FX3 (CAM A full-frame 5 Hz amp p95 ≈ 4.8 during The Chain).
2. **High confidence:** Rolling shutter converts the temporal ripple into rolling bands; the different band spacing on the A7 IV (slow readout) vs the A7S IIIs (fast readout) is consistent with this.
3. **Moderate confidence:** The fine multi-band structure and its ~166-row spacing on CAM D imply a strong optical component in the few-hundred-Hz range (consistent with 3LCD sub-field panel drive, e.g. ~480 Hz = 16 × 30 Hz, which also aliases to 5 Hz). The exact internal drive frequency can't be pinned from the footage and doesn't matter for treatment.
4. **Low confidence (cosmetic only):** the sawtooth x-structure is plausibly the LCD inversion pattern or screen surface texture; treatment-irrelevant.
5. **Shutter:** 1/50 s integrates 0.6 of a 30 Hz cycle (non-integer) → residual ripple survives integration. _Prevention note for next time: at 25p in front of a 60 Hz projector, shoot 1/30 s shutter (integrates exactly one cycle → no bands), or have the projector/laptop output 50 Hz._

## 3. Offline removal prototype (numpy, on the actual worst segments)

Tested on CAM C close-up (4162 @ 41080, the cut-528 framing) and CAM D wide (C3778 @ 39450), screen crops, proxies:

| Method                                    | 5 Hz amp p95 reduction | 10 Hz reduction | banding metric        | detail change              |
| ----------------------------------------- | ---------------------- | --------------- | --------------------- | -------------------------- |
| **5-frame mean (= 1 full cycle)**         | **96% (C) / 98% (D)**  | 98% / 99%       | 0.17→0.07 / 0.54→0.03 | −28% / −33% Laplacian\*    |
| 7-frame mean (= Deflicker default window) | 77% / 77%              | 91%             | 0.17→0.07 / 0.54→0.08 | similar loss, worse result |
| 5-frame median                            | 70% / 90%              | 83% / 93%       | 0.17→0.11 / 0.54→0.07 | −4% / −8% (gentlest)       |
| Sliding 5+10 Hz notch                     | 95% / 98%              | 97%             | 0.17→0.09 / 0.54→0.05 | −13% / −17%                |

\* The Laplacian "detail loss" on the screen crop is mostly _removal of the band lattice itself plus sensor noise_, not content smear: the same 5-frame mean on a static off-screen wall region loses only 2%. Screen-content motion does smear slightly under a plain mean — which is exactly what Resolve's motion estimation compensates for.

Conclusions:

- The **7-frame window leaves ~23% of the fundamental** — matching the partial improvement Dean already sees with Fluoro Light (its analysis window defaults to Frames Either Side = 3). The instrument isn't wrong, the window is.
- A **5-frame window nulls both 5 and 10 Hz exactly** (a 5-frame average at 25 fps has zeros at 5, 10 Hz) and works regardless of band phase — no tracking of the rolling pattern needed, and the slow ±0.02 Hz drift is irrelevant.
- Chroma must be treated: 5-frame mean on U/V takes their 5 Hz amplitude from ~1.4–2.8 to ~0.1.
- Windows of 15 or 25 frames (3 or 5 cycles) also null exactly, with more smoothing power but more motion-compensation risk.

## 4. Resolve recipe (Colour page, per camera group)

Notes first: Resolve's Deflicker OFX has **no Frequency/Time Cycle parameter** (that belongs to other tools) — its only temporal-window control is **Frames Either Side** under Advanced Controls (window = 2N+1 frames). Deflicker and Temporal NR are both Studio-only; both are per-node, so a screen-windowed node confines either to the screen.

For **each of CAM B, C, D group Pre-Clip** (keep the existing Fluoro Light node — it's doing its job on the corner lights):

1. Add a new node **after** the existing Fluoro node.
2. **Power Window** on that node covering the screen, drawn generously with a soft edge (~10%). On CAM D include the back-wall spill area around the screen — the flicker is in the _light_, not just the screen surface. Static cameras: no tracking needed; verify framing didn't shift between clips with a quick scrub.
3. **OFX → Deflicker** on that node:
   - Deflicker Setting: **Advanced Controls**
   - Temporal NR → **Frames Either Side: 2** (5-frame window = one full flicker cycle — this is the whole trick)
   - Mo.Est. Type: **Better** (performers cross the screen in CAM B/C; the screen content itself also moves). If screen content smears, try Faster before giving up the window size.
   - Motion Range: Medium
   - Luma Threshold / Chroma Threshold: leave **100/100 ganged** — chroma genuinely flickers.
   - Speed Optimization: leave Reduced-Detail Motion on; Limit Analysis Area optional (the Power Window already limits the node — turning Limit Analysis Area on over the same region just speeds it up).
   - Restore Original Detail → **Detail to Restore ~20–40**, tune with Show Detail Restored: you want performer edges and screen-content texture back, without letting the sawtooth lattice through.
4. **If residual bands remain** (check Output → Magnified Flicker to see what it's catching): try **Frames Either Side = 7** (15-frame window = 3 cycles — also an exact multiple, more smoothing power). Do not use 3, 4, 5 or 6 — any window that isn't a multiple of 5 frames leaves a coherent residue (that's the current situation).
5. **Alternative/adjunct on the same windowed node** if Deflicker's model still underperforms on the screen: **Motion Effects palette → Temporal NR**: Number of Frames = **5**, Motion Est. Better, Motion Range Small, Luma/Chroma thresholds start ~30/30 and raise until bands vanish (flicker amplitude is only ~±4/255, so modest thresholds catch it), Motion Threshold default. This is literally the prototype's motion-compensated 5-frame mean, which measured 96–98% removal.
6. **CAM A (FX3, roaming):** carries the same 5 Hz flicker (full-frame amp p95 ≈ 4.8 during The Chain). Group-level Fluoro stays; a fixed screen window is impossible while roaming, so for the handful of CAM A cuts where the screen is prominent, window + track the screen on those clips only (clip-level node), same Deflicker settings. Otherwise accept — motion hides it well on the roaming shots.
7. **Ordering caveat:** anything already baked with Render in Place (the "CAM x Render nn.mov" zoomed cuts in the timeline) was rendered with the old grade — after the group recipe is in and verified, re-render those items or they'll keep the old banding.

**Fallback if Deflicker + TNR both fail** (not expected given the exact cycle): there is no spatial filter that removes rolling bands cleanly without hurting screen content — a mild vertical directional blur inside the screen window can knock the sawtooth edge down and make residue read as "glow" rather than pattern, at obvious cost. Prefer accepting a partial result over that except on the worst close-ups.

## 5. Validation plan

1. **Test range:** The Chain measure range already in use — timeline frames **112126–119600** (matches `/Volumes/BOTTB/Renders/measure_The_Chain.mp4`). It contains the three worst offenders: CAM C close-up at record 115521–115603 (source 4162 ≈ 41091), CAM D at 116387–116651 (C3778 ≈ 41807), CAM B at 116970–117027.
2. Render with the new settings to `measure_The_Chain_v2.mp4`, same render preset as the existing measure render.
3. **Metrics on the rendered file** (screen crops, same code path as before):
   - Banding metric (high-passed row-mean profile, mean |frame-to-frame delta|): untreated ≈ 0.44 on the wide; **target < 0.15**; the offline 5-frame result was 0.03–0.07, so if the render comes in above ~0.10 the window setting isn't being honoured — check Frames Either Side.
   - Coherent 5 Hz amplitude p95 on the screen crop: untreated 2.1–4.3 (8-bit); **target < 0.5**.
4. **Eyeball checks:** step frame-by-frame through 5+ consecutive frames on the CAM C close-up — bands must not crawl; look for (a) sawtooth/moiré residue, (b) coloured shimmer (chroma left untreated), (c) smearing of performer edges where they cross the screen (raise Detail to Restore / lower window feather if so), (d) ghosting on fast screen-content cuts (drop to Frames Either Side = 2 if 7 was used).
5. If both metrics pass on The Chain, the settings are safe to leave on the group for the whole show — the alias was 5.000 Hz at every sampled time of the night on every camera.

---

_Analysis artefacts (scripts, spectra, amplitude/phase maps) were produced in the session scratchpad; the method is reproducible from the descriptions above: per-pixel temporal high-pass → FFT/5 Hz demodulation on proxy screen crops._
