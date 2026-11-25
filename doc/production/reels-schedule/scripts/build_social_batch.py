#!/usr/bin/env python3
"""Build data/social_batch_2026-11-07.json: each reel's file, cover, slots and confirmed copy, with LinkedIn text split into typed chunks and mentions. Run from the project directory."""
import json, os, re
R = os.path.expanduser("~/src/personal/gigstills/runs/sydney26_reels/report/")
COVERS = os.path.abspath("report/covers/")
BAND = {"g4u": "bandlassian-sydney-2026", "otr": "off-the-record-brisbane-2026", "nok": "epsonics-brisbane-2026", "sos": "total-loss-brisbane-2026", "v2voyagers": "v2-voyagers-sydney-2026", "amakazaam": "amakazaam-sydney-2026", "chain": "epsonics-brisbane-2026", "everlong": "the-shiprex-brisbane-2026", "sias": "jumbo-band-brisbane-2026", "cic": "the-shiprex-brisbane-2026"}
GROUP = {"g4u": "sydney-2026-bandlassian-good-4-u-reel", "otr": "brisbane-2026-off-the-record-all-coming-back-reel", "nok": "brisbane-2026-epsonics-no-one-knows-reel", "sos": "brisbane-2026-total-loss-sultans-reel", "v2voyagers": "sydney-2026-v2-voyagers-starships-ufo-reel", "amakazaam": "sydney-2026-amakazaam-under-pressure-reel", "chain": "brisbane-2026-epsonics-the-chain-reel", "everlong": "brisbane-2026-shiprex-everlong-reel", "sias": "brisbane-2026-jumbo-say-it-aint-so-reel", "cic": "brisbane-2026-shiprex-covered-in-chrome-reel"}
NAMES = ["Jumbo Interactive Limited", "For The Record (FTR)", "Suncorp Group", "Rex Software", "URBAN X", "Youngcare", "Epsilon", "Amazon", "V2 AI"]
# Dean, 7 Nov: drop the overlapping second opener from the confirmed All Coming Back post.
LI_FIX = {"otr": "Off the Record from @For The Record (FTR) have two lead singers, and this one is Fay's. She was nervous about taking on Celine Dion's \"It's All Coming Back to Me Now\" in front of a room that full at The Triffid, and she killed it.\n"}
pat = re.compile("@(" + "|".join(re.escape(n) for n in NAMES) + ")")
out = []
for m in json.load(open("data/mix_2026-11-07.json")):
    k = m["key"]
    if k == "canvanauts":
        continue
    d = json.load(open(f"data/review_live_2026-11-08/reviews/{k}.json"))
    d = d.get("data", d)
    assert d["confirmed"], k
    f = d["final"]
    li = f["li"].replace(LI_FIX[k], "") if k in LI_FIX else f["li"]
    assert k not in LI_FIX or LI_FIX[k] not in li
    chunks, pos = [], 0
    for x in pat.finditer(li):
        if li[pos:x.start()]:
            chunks.append({"type": li[pos:x.start()]})
        chunks.append({"mention": x.group(1)})
        pos = x.end()
    chunks.append({"type": li[pos:]})
    assert "@" not in "".join(c.get("type", "") for c in chunks), k
    wd = m["weekday"]
    fb_h = 18 if wd == "Mon" else 19
    out.append({"key": k, "band": m["band"], "song": m["song"], "city": m["city"], "date": m["date"], "weekday": wd,
        "event": "sydney-2026" if m["city"] == "Sydney" else "brisbane-2026", "band_slug": BAND[k], "group": GROUP[k],
        "file": R + m["file"], "bytes": os.path.getsize(R + m["file"]), "cover": f"{COVERS}/{k}.jpg", "tiktok_location": "Manning Bar" if m["city"] == "Sydney" else "The Triffid",
        "slots_brisbane_picker": {"tiktok": "08:00", "linkedin": "12:00 PM", "facebook_instagram": f"{fb_h - 12}:00 PM"},
        "slots_sydney_iso": {"tiktok": f"{m['date']}T09:00:00+11:00", "linkedin": f"{m['date']}T13:00:00+11:00", "facebook": f"{m['date']}T{fb_h + 1}:00:00+11:00", "instagram": f"{m['date']}T{fb_h + 1}:00:00+11:00"},
        "li_arm": m["li_arm"], "tt": f["tt"], "fb": f["fb"], "ig": f["ig"], "li": li, "li_chunks": chunks, "li_comment": f.get("li_comment")})
json.dump(out, open("data/social_batch_2026-11-07.json", "w"), indent=1, ensure_ascii=False)
for r in out:
    print(r["key"], r["date"], r["weekday"], r["slots_brisbane_picker"]["facebook_instagram"], os.path.exists(r["cover"]), r["bytes"], [c["mention"] for c in r["li_chunks"] if "mention" in c])
