# Pre-render check of a song range: seconds, read-only, no track toggled, no render. Run after state.py, right before StartRendering. Exit 1 on any FAIL.
# Catches: a render set off with the look in the wrong state (Mustang Sally 2026-11-05), a missed fade (API fades are lost on reopen), offline media, black pan bands,
# a disabled track or look node, a missing plugin, an In/Out off the song. It prints the sheet path: read the card credit on it, because no check can.
# Halation is the exception: the API can't read that switch, so --flc exports the timeline and decodes it.
# Usage: RR_TIMEOUT=300 rr.sh resolve/preflight.py <in_abs> <out_abs> <outdir> [--look on|off] [--open-end] [--no-scan] [--flc] [--halation-off]
#   --look off for a measuring render; --open-end when the song doesn't fade to black; --no-scan skips the frame per cut; --halation-off when Dean wants it off.
import json, os, subprocess, sys, time, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; flag = lambda s: s in a and not a.remove(s)
OPEN_END, NO_SCAN, FLC, HAL_OFF = flag("--open-end"), flag("--no-scan"), flag("--flc"), flag("--halation-off"); LOOK = "on"
if "--look" in a: i = a.index("--look"); LOOK = a[i + 1]; del a[i:i + 2]
IN, OUT, D = int(a[0]), int(a[1]), a[2]; os.makedirs(D, exist_ok=True)
r = d.scriptapp("Resolve"); pm = r.GetProjectManager(); p = pm.GetCurrentProject(); pix.rendering(p); tl = p.GetCurrentTimeline(); S = tl.GetStartFrame(); T0 = time.time()
fails, warns = [], []
def fail(m): fails.append(m); print("FAIL  " + m)
def warn(m): warns.append(m); print("WARN  " + m)
def ok(m): print("ok    " + m)
def in_range(i): return i.GetEnd() > IN and i.GetStart() <= OUT
print("preflight %s  %d-%d  %s-%s  look %s" % (tl.GetName(), IN, OUT, pix.tc(IN), pix.tc(OUT), LOOK))
if "multicam" in tl.GetName().lower(): fail("a multicam is open in the timeline: %s" % tl.GetName())
mio = tl.GetMarkInOut().get("video", {})
if not mio: warn("no In/Out set on the timeline")
elif (mio.get("in", 0) + S, mio.get("out", 0) + S) != (IN, OUT): warn("timeline In/Out %d-%d is not this range" % (mio["in"] + S, mio["out"] + S))
else: ok("In/Out matches the range")
# tracks
MID = IN + (OUT - IN) // 2; lt = pix.look_track(tl, MID)
for t in range(1, tl.GetTrackCount("video") + 1):
    its = [i for i in tl.GetItemListInTrack("video", t) or [] if in_range(i)]; on = tl.GetIsTrackEnabled("video", t); name = tl.GetTrackName("video", t)
    if not its: continue
    want = (LOOK == "on") if t == lt else True
    if t != lt and LOOK == "off" and any("card" in i.GetName().lower() for i in its): want = False  # a measuring render has cards off
    if on != want: fail("V%d %s is %s with %d items in range; want %s" % (t, name, "on" if on else "off", len(its), "on" if want else "off"))
    else: ok("V%d %s %s, %d items" % (t, name, "on" if on else "off", len(its)))
for t in range(1, tl.GetTrackCount("audio") + 1):
    its = [i for i in tl.GetItemListInTrack("audio", t) or [] if in_range(i)]
    if its and tl.GetIsTrackEnabled("audio", t): print("      A%d %s: %s" % (t, tl.GetTrackName("audio", t), [i.GetName() for i in its][:3]))
# look nodes and timeline nodes
it0 = pix.look_item(tl, MID)
if LOOK == "on" and not it0: fail("no Adjustment Clip over the middle of the range")
elif it0:
    g = it0.GetNodeGraph(); ns = [(n, g.GetNodeLabel(n), g.GetNodeEnabled(n)) for n in range(1, g.GetNumNodes() + 1)] if g else []
    off = [x for x in ns if not x[2]]
    print("      look version %s, %d nodes, off: %s" % ((it0.GetCurrentVersion() or {}).get("versionName"), len(ns), off))
    if off and LOOK == "on": warn("look nodes off: %s" % off)
tg = tl.GetNodeGraph()
if tg:
    on = [(n, tg.GetNodeLabel(n)) for n in range(1, tg.GetNumNodes() + 1) if tg.GetNodeEnabled(n)]
    (warn if on else ok)("timeline nodes on: %s" % on)  # the look moved to the Adjustment Clip; a timeline node on doubles it, and it reaches the item frame too
# plugins
known = {e.get("id") for e in r.GetEffectsList() or []}; miss = []; fx = 0
for t in range(1, tl.GetTrackCount("video") + 1):
    for i in tl.GetItemListInTrack("video", t) or []:
        if not in_range(i): continue
        for e in i.GetEffects("ofx") or []:
            fx += 1; inf = e.GetInfo() or {}
            if inf.get("id") not in known: miss.append((t, i.GetName(), i.GetStart(), inf.get("id")))
if miss: fail("%d effects aren't installed: %s" % (len(miss), miss[:5]))
else: ok("%d clip OFX effects, all installed" % fx)
# colour groups (RiP'd clip out of its group)
cuts = pix.v1_cuts(tl, IN, OUT); ng = [(i.GetName(), i.GetStart()) for i in cuts if pix.src_type(i) != "Multicam" and not i.GetColorGroup()]  # a live multicam clip's group sits on its source, so it reads none here
if ng: warn("%d of %d cuts are RiP'd or plain clips with no colour group: %s" % (len(ng), len(cuts), ng[:4]))
else: ok("%d cuts, none out of a colour group" % len(cuts))
# the last frame
last = "%s/last.png" % D; lc = cuts[-1] if cuts else None; fd = lc.GetFades() if lc else {}
if not OPEN_END:
    if not pix.export(tl, OUT - S, last, maxDimension=960): fail("couldn't export the last frame, so the fade isn't checked")
    elif pix.kind(last) != "black": k, y = pix.kind(last), pix.level(last); fail("last frame isn't black (Y %.1f, %s). Last cut %s reads FadeOut %s; API fades are lost on a reopen: re-run last_fade.py, in this session" % (y, k, lc and lc.GetName(), fd.get("FadeOut")))
    else: ok("last frame black (Y %.1f), last cut FadeOut %s" % (pix.level(last), fd.get("FadeOut")))
# the look reaches the picture: compare the render view with the look-off view at 3 cuts, skipping any with a title or card above the look
n = max(1, len(cuts) // 4); probe = []
for c in cuts[n // 2::n][:3]:
    rec = max(c.GetStart(), IN) + (min(c.GetEnd() - 1, OUT) - max(c.GetStart(), IN)) // 2; top = pix.picture_item(tl, rec)
    if not top or any(i.GetStart() <= rec < i.GetEnd() for t in range((lt or 0) + 1, tl.GetTrackCount("video") + 1) for i in tl.GetItemListInTrack("video", t) or []): continue
    f, g = "%s/look_%d_tl.jpg" % (D, rec), "%s/look_%d_item.jpg" % (D, rec)
    if not (pix.export(tl, rec - S, f, maxDimension=960, quality=90) and pix.export(top, rec - top.GetStart(), g, maxDimension=960, quality=90)): warn("look probe export failed at %s" % pix.tc(rec)); continue
    if pix.kind(g) == "offline": continue
    probe.append((rec, pix.rgb_diff(f, g), pix.level(f)))
print("      look probes (rec, mean|rgb| render vs look-off, Y): %s" % [(p_, round(e, 1), round(l, 1)) for p_, e, l in probe])
if probe:
    best = max(e for _, e, _ in probe); seen = best > 1.5
    if LOOK == "on" and not seen: fail("the look isn't reaching the picture: the render view equals the look-off view (max %.1f)" % best)
    if LOOK == "off" and seen: fail("the look IS reaching the picture on a look-off render (max %.1f)" % best)
    if (LOOK == "on") == seen: ok("look %s confirmed in pixels (max %.1f)" % (LOOK, best))
else: warn("no online cut to prove the look on")
# every cut: offline, flat, black bands
if not NO_SCAN:
    bad = []; t = time.time()
    for c in cuts:
        rec = max(c.GetStart(), IN) + (min(c.GetEnd() - 1, OUT) - max(c.GetStart(), IN)) // 2; top = pix.picture_item(tl, rec)
        if not top: bad.append((pix.tc(rec), "no clip", "")); continue
        f = "%s/scan.jpg" % D
        if not pix.export(top, rec - top.GetStart(), f, maxDimension=960, quality=90): bad.append((pix.tc(rec), top.GetName(), "export failed")); continue
        kd = pix.kind(f); e = pix.bands(f)
        if kd in ("offline", "flat") or (kd != "black" and pix.banded(e)): bad.append((pix.tc(rec), top.GetName(), kd, e))
    (fail if bad else ok)("%d cuts scanned in %.0f s, %d flagged%s" % (len(cuts), time.time() - t, len(bad), ": %s" % bad[:6] if bad else ""))
# audio on the items covering most of the range, peak and loudness
for t in range(1, tl.GetTrackCount("audio") + 1):
    if not tl.GetIsTrackEnabled("audio", t): continue
    for i in tl.GetItemListInTrack("audio", t) or []:
        cov = min(i.GetEnd() - 1, OUT) - max(i.GetStart(), IN) + 1
        if cov >= (OUT - IN + 1) / 2:
            lv = i.AnalyzeAudioLevels("EBU R128") or {}; print("      audio A%d %s: true peak %.1f dBFS, %.1f LUFS over the item" % (t, i.GetName(), lv.get("TruePeak", 0), lv.get("Integrated", 0)))
            if lv.get("TruePeak", -100) > -0.5: warn("A%d %s true peak %.1f dBFS" % (t, i.GetName(), lv["TruePeak"]))
# what the eye has to read: the card, three looks, the fade
ofs = [IN + 50, IN + 150, IN + (OUT - IN) // 2, OUT - 50, OUT - 1]
sheet = "%s/preflight_sheet.jpg" % D; x = tl.ExportThumbnails([{"frameOffset": o - S, "label": pix.tc(o)} for o in ofs if IN <= o <= OUT], {"outputType": "file", "filePath": sheet, "maxDimension": 1600, "quality": 85})
cards = [i.GetName() for t in range(1, tl.GetTrackCount("video") + 1) for i in tl.GetItemListInTrack("video", t) or [] if in_range(i) and "card" in i.GetName().lower()]
print("      cards in range: %s" % cards)
print("      read the card credit: %s" % sheet)
if FLC:
    def flc_lines():  # a .drt holds this timeline only; backup timelines in a .drp hold the same version names
        drp = "%s/flc_%d.drt" % (D, int(time.time()))
        if not tl.Export(drp, r.EXPORT_DRT): return [], "the timeline export failed"
        try: t = subprocess.run(["python3.14", "-I", os.path.expanduser("~/src/personal/resolve-lab/scripts/drp_flcstate.py"), drp], capture_output=True, text=True)
        except OSError as e: return [], str(e)
        finally: os.remove(drp)
        return (t.stdout.splitlines(), None) if t.returncode == 0 else ([], "the decoder failed: %s" % t.stderr.strip()[-200:])
    ver = (it0.GetCurrentVersion() or {}).get("versionName") if it0 else None; lines, err = flc_lines()
    at = [k for k, l in enumerate(lines) if "version %r" % ver in l]  # the decoder only prints grades holding an FLC node, whatever its label
    if err: fail("couldn't read halation: %s" % err)
    elif not at: fail("no Film Look Creator decoded for look version %r, so halation isn't checked" % ver)
    for k in at[:1]:
        hal = next((l for l in lines[k + 1:k + 3] if "halationIsEnable" in l), ""); node_on = lines[k].rstrip().endswith("ON"); h_on = "\\x18\\x00" not in hal
        if not hal: fail("look version %r: no halation switch decoded" % ver); continue
        m = "look version %r: FLC node %s, halation %s (decoded from an export)" % (ver, "on" if node_on else "OFF", "on" if h_on else "OFF")
        (ok if node_on and h_on != HAL_OFF else fail)(m)
print("%s  %d fails, %d warnings, %.0f s" % ("FAIL" if fails else "PASS", len(fails), len(warns), time.time() - T0))
json.dump(dict(range=[IN, OUT], look=LOOK, fails=fails, warns=warns), open(D + "/preflight.json", "w"), indent=1)
raise SystemExit(1 if fails else 0)
