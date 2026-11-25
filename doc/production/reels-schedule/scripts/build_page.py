#!/usr/bin/env python3
"""Build report/reels-proposal.html from data/, report/frames/ and scripts/page_content.py. Run from the project directory."""
import base64, csv, glob, html, json, statistics as st, sys
from datetime import datetime

sys.path.insert(0, "scripts")
from page_content import REELS, HEAD, TAIL, FACTS, MIX

BANDS = [("08:00 to 12:00", lambda h: 8 <= h < 12), ("13:00 to 17:00", lambda h: 13 <= h < 17), ("17:00 to 19:00", lambda h: 17 <= h < 20), ("21:00 to 01:00", lambda h: h >= 21 or h < 2)]
NOW = datetime(2026, 11, 7, 9, 0)


def b64(path):
    return "data:image/jpeg;base64," + base64.b64encode(open(path, "rb").read()).decode()


def strip():
    rows = list(csv.DictReader(open(sorted(glob.glob("data/meta_video_90d_*.psv"))[-1]), delimiter="|"))
    ig = [r for r in rows if r["platform"] == "IG"]
    W, L, R, ROW, TOP = 720, 128, 20, 44, 14
    X = lambda v: L + (W - L - R) * v / 2200
    H = TOP + ROW * len(BANDS) + 34
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Instagram video views by publishing hour, Brisbane time" class="chart">']
    for v in range(0, 2201, 500):
        s.append(f'<line x1="{X(v):.1f}" x2="{X(v):.1f}" y1="{TOP}" y2="{H-28}" class="grid"/><text x="{X(v):.1f}" y="{H-10}" class="tick" text-anchor="middle">{v:,}</text>')
    for i, (name, f) in enumerate(BANDS):
        y = TOP + ROW * i + ROW / 2
        pts = [r for r in ig if f(int(r["published_brisbane_time"][11:13]))]
        old = [int(r["views"]) for r in pts if (NOW - datetime.strptime(r["published_brisbane_time"], "%Y-%m-%d %H:%M")).days >= 7]
        s.append(f'<text x="{L-12}" y="{y+4:.1f}" class="lab" text-anchor="end">{name}</text>')
        for j, r in enumerate(sorted(pts, key=lambda r: int(r["views"]))):
            v = int(r["views"])
            young = (NOW - datetime.strptime(r["published_brisbane_time"], "%Y-%m-%d %H:%M")).days < 7
            cy = y + (-7 if j % 2 else 7)
            cls = "pt young" if young else "pt"
            s.append(f'<circle cx="{X(v):.1f}" cy="{cy:.1f}" r="5" class="{cls}"><title>{html.escape(r["label"])}: {v:,} views, {r["published_brisbane_time"]}{" (under 7 days old)" if young else ""}</title></circle>')
        m = st.median(old)
        s.append(f'<line x1="{X(m):.1f}" x2="{X(m):.1f}" y1="{y-16:.1f}" y2="{y+16:.1f}" class="med"/><text x="{X(m)+6:.1f}" y="{y-11:.1f}" class="medt">{m:.0f}</text>')
    s.append("</svg>")
    return "".join(s)


FIELDS = [("Facebook", "fb"), ("Instagram", "ig"), ("YouTube Shorts", "yt"), ("TikTok", "tt"), ("LinkedIn first comment", "li_comment"), ("LinkedIn", "li")]


def field(title):
    return next(k for prefix, k in FIELDS if title.startswith(prefix))


def block(key, title, text):
    area = f'<textarea data-field="{key}" rows="6" aria-label="{html.escape(title)}">{html.escape(text)}</textarea>'
    return f'''<div class="cap"><div class="caphead"><h4>{html.escape(title)}</h4><span class="edited" hidden>Edited</span></div>{area}<p class="lint"></p><div class="capfoot"><span class="count"></span><button type="button" class="reset" hidden>Back to my draft</button></div></div>'''


def title_block(text):
    return f'''<div class="cap"><div class="caphead"><h4>YouTube Shorts title</h4><span class="edited" hidden>Edited</span></div><input data-field="yt_title" value="{html.escape(text, quote=True)}" aria-label="YouTube Shorts title"><p class="lint"></p><div class="capfoot"><span class="count"></span><button type="button" class="reset" hidden>Back to my draft</button></div></div>'''


def fact(fid, text, options):
    opts = options or ("Right", "Wrong", "Unsure")
    buttons = "".join(f'<button type="button" data-answer="{html.escape(o, quote=True)}" aria-pressed="false">{html.escape(o)}</button>' for o in opts)
    return f'''<div class="fact" data-fact="{fid}"><p>{html.escape(text)}</p><div class="answers">{buttons}</div><input type="text" placeholder="Note for me (optional)" aria-label="Note"></div>'''


def reel(r):
    cover = lambda value, inner: f'<button type="button" class="cover" data-cover="{value}" aria-pressed="false">{inner}</button>'
    fig = lambda path, label: f'<figure><img src="{b64(path)}" alt="{label}" loading="lazy"><figcaption>{label}</figcaption></figure>'
    frames = "".join(cover(str(i), fig(f"report/frames/{r['key']}/c{i}.jpg", f"{i} · {t}")) for i, t in r["frames"])
    first = cover("first", fig(f"report/frames/{r['key']}/first.jpg", "First frame"))
    oct_ = "" if r.get("no_oct") else cover("O", fig(f"report/frames/{r['key']}/oct.jpg", "O · Earlier cover"))
    unsure = '<button type="button" class="cover text" data-cover="default" aria-pressed="false">Unsure: leave the platform default</button>'
    caps = []
    for title, text in r["copy"]:
        if title.startswith("YouTube Shorts"):
            caps.append(title_block(title.split(" · ", 1)[1]))
            caps.append(block("yt", "YouTube Shorts description", text))
        else:
            caps.append(block(field(title), title, text))
    facts = FACTS.get(r["key"], [])
    facts_html = f'<h4 class="ch">Facts</h4><div class="caps">{"".join(fact(*f) for f in facts)}</div>' if facts else ""
    return f"""<section class="reel" id="{r['key']}"><h3>{html.escape(r['name'])}</h3><p class="meta">{html.escape(r['meta'])}</p>
<h4 class="ch">Cover</h4><div class="frames">{oct_}{first}{frames}{unsure}</div>{facts_html}
<h4 class="ch">Captions</h4><div class="caps">{"".join(caps)}</div>
<div class="confirmbar"><button type="button" class="confirm" disabled>Confirm this reel</button><span class="confirm-hint"></span></div></section>"""


def review():
    nav = "".join(f'''<li><a href="#{r['key']}" data-nav="{r['key']}"><span>{MIX[r['key']]['weekday']} {int(MIX[r['key']]['date'][8:])} {datetime.strptime(MIX[r['key']]['date'], "%Y-%m-%d").strftime("%b")}, {html.escape(r['name'])}</span><span class="st">To review</span></a></li>''' for r in REELS)
    intro = f"""<section class="review-intro"><h2>Review the reels</h2>
<div class="savebar"><span id="progress"></span><span id="save-state" role="status">Loading...</span></div>
<ul class="plain">
<li><strong>Cover:</strong> click the still you want people to see before they tap, the one you'd want on the grid. The numbers run in file order after the logo. If you're unsure, take "leave the platform default". If you'd like a closer spread around a frame, say so in the session.</li>
<li><strong>Facts:</strong> answer each one. If one's wrong or unsure, fix the caption below or leave me a note.</li>
<li><strong>Captions:</strong> type straight into any box. Instagram can't be edited after it publishes. On LinkedIn every @ becomes a checked mention chip, so keep the names as they are unless you want a different tag. The Fay line in All Coming Back keeps your steer from September, and "early 2000s banger" in No One Knows is yours.</li>
<li><strong>Confirm:</strong> this is your go for that reel, exactly as written. Change anything afterwards and the confirmation comes off. Click a chosen cover or answer again to clear it.</li>
</ul>
<ul class="reelnav">{nav}</ul></section>"""
    return intro + "".join(reel(r) for r in REELS)


def order():
    rows = "".join(f'<tr><td>{r["weekday"]} {int(r["date"][8:])} {datetime.strptime(r["date"], "%Y-%m-%d").strftime("%b")}</td><td><strong>{html.escape(r["band"])}</strong><small>{html.escape(r["company"])}</small></td><td>{html.escape(r["song"])}</td><td>{r["city"]}</td><td>{"Rotated" if r["loop"] == "rotated" else "Hard cut"}</td><td><a href="https://youtu.be/{r["yt"]}">{r["yt"]}</a></td><td>{"In the post" if r["li_arm"] == "post" else "First comment"}</td></tr>' for r in json.load(open(sorted(glob.glob("data/mix_*.json"))[-1])))
    return f'<div class="tablewrap"><table><tr><th>Slot</th><th>Band</th><th>Reel of</th><th>City</th><th>Loop</th><th>Full song</th><th>LinkedIn link</th></tr>{rows}</table></div>'


page = HEAD.replace("{{STRIP}}", strip()).replace("{{ORDER}}", order()).replace("{{REVIEW}}", review()) + TAIL + "<script>" + open("scripts/review.js").read() + "</script>"
open("report/reels-proposal.html", "w").write(page)
print(len(page) // 1024, "KB")
