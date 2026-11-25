"""Words of the reels proposal page. Slots, evidence and copy all live here so the method can be reused for Brisbane."""
import glob, json
from datetime import datetime

CREDIT_FB = "Video shot by Nicole Ainsworth and Adam Davis-Powell. Photos and video sponsored by V2 AI."
CREDIT_IG = "Video shot by @sailornicole and @demonrace, photos and video sponsored by V2 AI."
CREDIT_YT = "Video shot by Nicole Ainsworth (@sailornicole) and Adam Davis-Powell (@demonrace). Photos and video sponsored by V2 AI."
CREDIT_TT = "Video shot by Nicole Ainsworth and Adam Davis-Powell. Photos and video sponsored by V2 AI. All proceeds to Youngcare."
CHARITY = "All proceeds to Youngcare, supporting young Australians with high care needs to live with more choice, freedom and dignity."
CHARITY_IG = "All proceeds to @youngcareoz, supporting young Australians with high care needs to live with more choice, freedom and dignity."
POWER = "Proudly powered by Jumbo Interactive. "
BASE = "#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #sydneymusic #livemusicsydney "
BNE_FB = "Video shot by Aaron Griffiths and Kurt Boldy. Live audio by Nick Forrester."
BNE_IG = "Video shot by @quirkylikethat and @kurtboldy, live audio by Nick Forrester."
BNE_YT = "Video shot by Aaron Griffiths (@quirkylikethat) and Kurt Boldy (@kurtboldy). Live audio by Nick Forrester."
BNE_TT = "Video shot by Aaron Griffiths and Kurt Boldy. All proceeds to Youngcare."
BNE_BASE = "#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #LiveMusicBrisbane #TheTriffid "
BNE_TT_TAGS = "#BattleOfTheTechBands #BotTB26 #brisbanemusic #livemusic #techbands "


def go(link, placement):
    return f"https://www.battleofthetechbands.com/go/{link.rsplit('/', 1)[-1]}/{placement}"


def copies(hook, rest, rest_ig, tt, link, tags, yt_title, li_lead, li_tags, brisbane=False):
    credit_fb, credit_ig, credit_yt, base = (BNE_FB, BNE_IG, BNE_YT, BNE_BASE) if brisbane else (CREDIT_FB, CREDIT_IG, CREDIT_YT, BASE)
    credit_li = BNE_FB if brisbane else "Video shot by Nicole Ainsworth and Adam Davis-Powell. Photos and video sponsored by @V2 AI."
    fb = f"{hook}\nFull song: {go(link, 'fb-caption')}\n\n{rest}\n\n{credit_fb}\n\n{POWER}{CHARITY}\n\n{base}{tags}"
    ig = f"{hook} {rest_ig}\n\nFull song on our page.\n\n{credit_ig}\n\n{POWER}{CHARITY_IG}\n\n{base}{tags}"
    yt = f"{hook} {rest}\n\nFull song on our channel.\n\n{credit_yt}\n{POWER}{CHARITY}\n\n{base}{tags} #Shorts"
    li = f"{li_lead}\n\nFull song in the first comment.\n\n{credit_li}\n\nProudly powered by @Jumbo Interactive Limited. All proceeds to @Youngcare, supporting young Australians with high care needs to live with more choice, freedom and dignity.\n\n{base}{li_tags}"
    return [
        ("Facebook", fb),
        ("Instagram", ig),
        (f"YouTube Shorts · {yt_title}", yt),
        (f"TikTok · location {'The Triffid' if brisbane else 'Manning Bar'}", tt),
        ("LinkedIn, if you add it", li),
        ("LinkedIn first comment, added after it publishes", f"Full song: {go(link, 'li-comment')}"),
    ]


def frames(d):
    return [(i, f"{5.5 + (d - 7) * (i - 1) / 9:.0f} s") for i in range(1, 11)]


REELS = [
    dict(key="canvanauts", name="Canvanauts, Welcome to the Black Parade", d=59.32, frames=frames(59.32),
         meta="Mon 9 Nov · 59.32 s · 104.9 MB · IG collaborators sailornicole, demonrace, canva · full song youtu.be/AT4kyKuBRlQ",
         copy=copies(
             "One minute of the song that closed Sydney's winning set.",
             "The Canvanauts from Canva head into the \"We'll carry on\" chorus of My Chemical Romance's \"Welcome to the Black Parade\" at the Manning Bar, black hat and bow tie centre stage.",
             "The Canvanauts from @canva head into the \"We'll carry on\" chorus of My Chemical Romance's \"Welcome to the Black Parade\" at the Manning Bar, black hat and bow tie centre stage.",
             "One minute of the song that closed Sydney's winning set 🖤 The Canvanauts from Canva with \"Welcome to the Black Parade\" at the Manning Bar. Full song on our page. " + CREDIT_TT + " #BattleOfTheTechBands #BotTB26 #sydneymusic #livemusicsydney #Canva #MyChemicalRomance #BlackParade",
             "https://youtu.be/AT4kyKuBRlQ", "#Canva #MyChemicalRomance",
             "Canvanauts - Welcome to the Black Parade (Cover) - BotTB Sydney 2026 #Shorts",
             "One minute of the song that closed Sydney's winning set. The Canvanauts from @Canva head into the \"We'll carry on\" chorus of My Chemical Romance's \"Welcome to the Black Parade\" at the Manning Bar, black hat and bow tie centre stage.",
             "#Canva #MyChemicalRomance")),
    dict(key="v2voyagers", name="V2 Voyagers, Starships / UFO", d=50.24, frames=frames(50.24),
         meta="Fri 20 Nov · 50.24 s · 93.3 MB · IG collaborators sailornicole, demonrace, youngcareoz · full song youtu.be/4UhnRsKcvKc",
         copy=copies(
             "Silver spacesuits on stage and VOYAGERS across the kick drum.",
             "Fifty seconds of V2 Voyagers from V2 AI in their medley of Nicki Minaj's \"Starships\" and Sneaky Sound System's \"UFO\" at the Manning Bar. Third place and best Crowd Vibe at Sydney 2026.",
             "Fifty seconds of V2 Voyagers from V2 AI in their medley of Nicki Minaj's \"Starships\" and Sneaky Sound System's \"UFO\" at the Manning Bar. Third place and best Crowd Vibe at Sydney 2026.",
             "Silver spacesuits on stage and VOYAGERS across the kick drum 🚀 V2 Voyagers from V2 AI with their \"Starships\" and \"UFO\" medley. Third place and best Crowd Vibe. Full song on our page. " + CREDIT_TT + " #BattleOfTheTechBands #BotTB26 #sydneymusic #livemusicsydney #V2AI #NickiMinaj #SneakySoundSystem #Starships",
             "https://youtu.be/4UhnRsKcvKc", "#V2AI #NickiMinaj #SneakySoundSystem",
             "V2 Voyagers - Starships / UFO (Cover) - BotTB Sydney 2026 #Shorts",
             "Silver spacesuits on stage and VOYAGERS across the kick drum. Fifty seconds of V2 Voyagers from @V2 AI in their medley of Nicki Minaj's \"Starships\" and Sneaky Sound System's \"UFO\" at the Manning Bar. Third place and best Crowd Vibe at Sydney 2026.",
             "#V2AI #NickiMinaj #SneakySoundSystem")),
    dict(key="amakazaam", name="Amakazaam!, Under Pressure", d=59.48, frames=frames(59.48),
         meta="Fri 27 Nov · 59.48 s · 99.4 MB · IG collaborators sailornicole, demonrace, youngcareoz · full song youtu.be/kLqqB-fR9yU",
         copy=copies(
             "One minute of the vocal that won Amakazaam! from Amazon judges' choice of the night at Sydney 2026.",
             "Queen and David Bowie's \"Under Pressure\" at the Manning Bar, from the breakdown up into the big run.",
             "Queen and David Bowie's \"Under Pressure\" at the Manning Bar, from the breakdown up into the big run.",
             "One minute of the vocal that won Amakazaam! from Amazon judges' choice of the night 🎤 \"Under Pressure\" at the Manning Bar. Full song on our page. " + CREDIT_TT + " #BattleOfTheTechBands #BotTB26 #sydneymusic #livemusicsydney #Amazon #Queen #DavidBowie #UnderPressure",
             "https://youtu.be/kLqqB-fR9yU", "#Amazon #Queen #DavidBowie",
             "Amakazaam! - Under Pressure (Cover) - BotTB Sydney 2026 #Shorts",
             "One minute of the vocal that won Amakazaam! from @Amazon judges' choice of the night at Sydney 2026. Queen and David Bowie's \"Under Pressure\" at the Manning Bar, from the breakdown up into the big run.",
             "#Amazon #Queen #DavidBowie")),
    dict(key="g4u", name="Bandlassian, good 4 u", d=59.92, frames=frames(59.92),
         meta="Date · 59.92 s · 83.9 MB · straight through, hard cut at the loop · IG collaborators sailornicole, demonrace, youngcareoz · full song youtu.be/yUPYr-OgmzI",
         copy=copies(
             "Bandlassian opened their Sydney set with a heavier \"good 4 u\".",
             "A minute of Atlassian's band taking on Olivia Rodrigo at the Manning Bar, Lesley on lead vocals with Luke alongside.",
             "A minute of Atlassian's band taking on Olivia Rodrigo at the Manning Bar, Lesley on lead vocals with Luke alongside.",
             "Bandlassian opened their Sydney set with a heavier \"good 4 u\" 🎸 A minute of Atlassian's band at the Manning Bar. Full song on our page. " + CREDIT_TT + " #BattleOfTheTechBands #BotTB26 #sydneymusic #livemusicsydney #Atlassian #OliviaRodrigo #good4u",
             "https://youtu.be/yUPYr-OgmzI", "#Atlassian #OliviaRodrigo",
             "Bandlassian - good 4 u (Cover) - BotTB Sydney 2026 #Shorts",
             "Bandlassian opened their Sydney set with a heavier \"good 4 u\". A minute of the band from @Atlassian taking on Olivia Rodrigo at the Manning Bar, Lesley on lead vocals with Luke alongside.",
             "#Atlassian #OliviaRodrigo")),
    dict(key="otr", name="Off the Record, It's All Coming Back to Me Now", d=59.48, frames=frames(59.48),
         meta="Date · 59.48 s · 81.8 MB · rotated loop · IG collaborators quirkylikethat, kurtboldy, youngcareoz · full song youtu.be/AUjRxVFrMnc",
         copy=copies(
             "Off the Record from For The Record have two lead singers, and this one is Fay's.",
             "She was nervous about taking on Celine Dion's \"It's All Coming Back to Me Now\" in front of a room that full at The Triffid, and she killed it.",
             "She was nervous about taking on Celine Dion's \"It's All Coming Back to Me Now\" in front of a room that full at The Triffid, and she killed it.",
             "Off the Record have two lead singers, and this one is Fay's 🎤 Celine Dion's \"It's All Coming Back to Me Now\" at The Triffid. Full song on our page. " + BNE_TT + " " + BNE_TT_TAGS + "#ForTheRecord #CelineDion",
             "https://youtu.be/AUjRxVFrMnc", "#CelineDion",
             "Off the Record - It's All Coming Back to Me Now (Cover) - BotTB Brisbane 2026 #Shorts",
             "Off the Record from @For The Record (FTR) have two lead singers, and this one is Fay's. She was nervous about taking on Celine Dion's \"It's All Coming Back to Me Now\" in front of a room that full at The Triffid, and she killed it.",
             "#CelineDion", brisbane=True)),
    dict(key="nok", name="Epsonics, No One Knows", d=59.60, frames=frames(59.60),
         meta="Date · 59.60 s · 74.3 MB · rotated loop · IG collaborators quirkylikethat, kurtboldy, youngcareoz · full song youtu.be/E2yeRiHRUlw",
         copy=copies(
             "Epsonics opened their Brisbane set with this early 2000s banger.",
             "A minute of Epsilon's band in their Severance suits with Queens of the Stone Age's \"No One Knows\" at The Triffid. Highest judges' score of the night, second overall.",
             "A minute of Epsilon's band in their Severance suits with Queens of the Stone Age's \"No One Knows\" at The Triffid. Highest judges' score of the night, second overall.",
             "Epsonics opened their Brisbane set with this early 2000s banger 🔴 \"No One Knows\" at The Triffid, in their Severance suits. Full song on our page. " + BNE_TT + " " + BNE_TT_TAGS + "#Epsilon #QueensOfTheStoneAge #NoOneKnows",
             "https://youtu.be/E2yeRiHRUlw", "#Epsilon #QueensOfTheStoneAge",
             "Epsonics - No One Knows (Cover) - BotTB Brisbane 2026 #Shorts",
             "Epsonics opened their Brisbane set with this early 2000s banger. A minute of the band from @Epsilon in their Severance suits with Queens of the Stone Age's \"No One Knows\" at The Triffid. Highest judges' score of the night, second overall.",
             "#QueensOfTheStoneAge", brisbane=True)),
    dict(key="sos", name="Total Loss, Sultans of Swing", d=51.88, frames=frames(51.88),
         meta="Date · 51.88 s · 98.8 MB · rotated loop, see the loop note · IG collaborators quirkylikethat, kurtboldy, youngcareoz · full song youtu.be/8YIPtpb5-0s",
         copy=copies(
             "The closing guitar run of \"Sultans of Swing\".",
             "Total Loss from Suncorp take Dire Straits home at The Triffid, red Strat out front. They'd been playing together for 12 years, and this was their first Battle of the Tech Bands.",
             "Total Loss from Suncorp take Dire Straits home at The Triffid, red Strat out front. They'd been playing together for 12 years, and this was their first Battle of the Tech Bands.",
             "The closing guitar run of \"Sultans of Swing\" 🎸 Total Loss from Suncorp at The Triffid. Full song on our page. " + BNE_TT + " " + BNE_TT_TAGS + "#Suncorp #DireStraits #SultansOfSwing",
             "https://youtu.be/8YIPtpb5-0s", "#Suncorp #DireStraits",
             "Total Loss - Sultans of Swing (Cover) - BotTB Brisbane 2026 #Shorts",
             "The closing guitar run of \"Sultans of Swing\". Total Loss from @Suncorp Group take Dire Straits home at The Triffid, red Strat out front. They'd been playing together for 12 years, and this was their first Battle of the Tech Bands.",
             "#DireStraits", brisbane=True)),
    dict(key="chain", name="Epsonics, The Chain", d=59.92, frames=frames(59.92), no_oct=True,
         meta="Date · 59.92 s · 79.8 MB · straight through, hard cut at the loop · IG collaborators quirkylikethat, kurtboldy, youngcareoz · full song youtu.be/wM7hSnZJn0A",
         copy=copies(
             "Epsonics saved \"The Chain\" for last.",
             "A minute of the run-out from Epsilon's band at The Triffid, Severance suits on and Fleetwood Mac's harmonies stacked across three voices. They finished second overall.",
             "A minute of the run-out from Epsilon's band at The Triffid, Severance suits on and Fleetwood Mac's harmonies stacked across three voices. They finished second overall.",
             "Epsonics saved \"The Chain\" for last ⛓️ Epsilon's band with the Fleetwood Mac run-out at The Triffid. Full song on our page. " + BNE_TT + " " + BNE_TT_TAGS + "#Epsilon #FleetwoodMac #TheChain",
             "https://youtu.be/wM7hSnZJn0A", "#Epsilon #FleetwoodMac",
             "Epsonics - The Chain (Cover) - BotTB Brisbane 2026 #Shorts",
             "Epsonics saved \"The Chain\" for last. A minute of the run-out from the band at @Epsilon at The Triffid, Severance suits on and Fleetwood Mac's harmonies stacked across three voices. They finished second overall.",
             "#FleetwoodMac", brisbane=True)),
    dict(key="everlong", name="ShipReX, Everlong", d=49.80, frames=frames(49.80),
         meta="Date · 49.80 s · 78.2 MB · rotated loop · IG collaborators quirkylikethat, kurtboldy, youngcareoz · full song youtu.be/gzcyKjD8IJA",
         copy=copies(
             "Fifty seconds of \"Everlong\" from the pirates who won Brisbane 2026.",
             "ShipReX, the crew from Rex Software and URBAN X, head for the end of the Foo Fighters song at The Triffid.",
             "ShipReX, the crew from @rex_software and @urbanx.io, head for the end of the Foo Fighters song at The Triffid.",
             "Fifty seconds of \"Everlong\" from the pirates who won Brisbane 2026 🏴‍☠️ ShipReX from Rex Software and URBAN X at The Triffid. Full song on our page. " + BNE_TT + " " + BNE_TT_TAGS + "#ShipReX #FooFighters #Everlong",
             "https://youtu.be/gzcyKjD8IJA", "#ShipReX #FooFighters",
             "ShipReX - Everlong (Cover) - BotTB Brisbane 2026 #Shorts",
             "Fifty seconds of \"Everlong\" from the pirates who won Brisbane 2026. ShipReX, the crew from @Rex Software and @URBAN X, head for the end of the Foo Fighters song at The Triffid.",
             "#FooFighters", brisbane=True)),
    dict(key="cic", name="ShipReX, Covered in Chrome", d=59.88, frames=frames(59.88), no_oct=True,
         meta="Date · 59.88 s · 120.5 MB · straight through, hard cut at the loop · IG collaborators quirkylikethat, kurtboldy, youngcareoz · full song youtu.be/rPeTKW3QWQo",
         copy=copies(
             "ShipReX closed their winning Brisbane set with a Brisbane song.",
             "The pirates from Rex Software and URBAN X take on Violent Soho's \"Covered in Chrome\" at The Triffid.",
             "The pirates from @rex_software and @urbanx.io take on Violent Soho's \"Covered in Chrome\" at The Triffid.",
             "ShipReX closed their winning Brisbane set with a Brisbane song 🏴‍☠️ Violent Soho's \"Covered in Chrome\" at The Triffid. Full song on our page. " + BNE_TT + " " + BNE_TT_TAGS + "#ShipReX #ViolentSoho #CoveredInChrome",
             "https://youtu.be/rPeTKW3QWQo", "#ShipReX #ViolentSoho",
             "ShipReX - Covered in Chrome (Cover) - BotTB Brisbane 2026 #Shorts",
             "ShipReX closed their winning Brisbane set with a Brisbane song. The pirates from @Rex Software and @URBAN X take on Violent Soho's \"Covered in Chrome\" at The Triffid.",
             "#ViolentSoho", brisbane=True)),
    dict(key="sias", name="Jumbo Band, Say It Ain't So", d=59.76, frames=frames(59.76),
         meta="Date · 59.76 s · 81.0 MB · straight through, hard cut at the loop · IG collaborators quirkylikethat, kurtboldy, youngcareoz · full song youtu.be/cPSjftEzPFI",
         copy=copies(
             "Jumbo Band, monks' robes still on, five songs into their Brisbane set.",
             "A minute of Weezer's \"Say It Ain't So\" at The Triffid from the band at Jumbo Interactive, who finished third with the judges' highest performance score of the night.",
             "A minute of Weezer's \"Say It Ain't So\" at The Triffid from the band at Jumbo Interactive, who finished third with the judges' highest performance score of the night.",
             "Jumbo Band, monks' robes still on, five songs into their Brisbane set 🎤 Weezer's \"Say It Ain't So\" at The Triffid. Full song on our page. " + BNE_TT + " " + BNE_TT_TAGS + "#JumboInteractive #Weezer #SayItAintSo",
             "https://youtu.be/cPSjftEzPFI", "#Weezer",
             "Jumbo Band - Say It Ain't So (Cover) - BotTB Brisbane 2026 #Shorts",
             "Jumbo Band, monks' robes still on, five songs into their Brisbane set. A minute of Weezer's \"Say It Ain't So\" at The Triffid from the band at @Jumbo Interactive Limited, who finished third with the judges' highest performance score of the night.",
             "#Weezer", brisbane=True)),
]

FACTS = {
    "canvanauts": [("hat", "The black hat and bow tie are centre stage in this reel.", None)],
    "amakazaam": [("run", "\"From the breakdown up into the big run\" describes this reel.", None),
                  ("keira", "Name Keira as lead in the caption? The song map names her, but none of the Sydney posts I checked does. If yes, add her in the captions below.", ("Name her", "Leave her out", "Unsure"))],
    "g4u": [("lead", "Lesley on lead with Luke alongside is right. It's from the stage plot and the approved copy, not checked against the video.", None)],
    "nok": [("suits", "\"Severance suits\" is fair: my reading of the frames plus the Severance theme in the shipped copy.", None)],
    "sos": [("run", "\"Closing guitar run\" and \"red Strat out front\" are right. They come from the frames and where the reel sits in the song.", None),
            ("loop", "Listen to the loop point in TotalLoss_SultansOfSwing_Brisbane2026_reel_auto_v2.mp4 by playing it on repeat. Is it OK to ship? It measures as a possible click.", ("It's fine", "It needs fixing", "Haven't listened"))],
    "chain": [("runout", "\"Run-out\" fits where the reel sits in the song, and the harmonies are across three voices, as in the shipped copy.", None),
              ("suits", "\"Severance suits\" is fair: my reading of the frames plus the Severance theme in the shipped copy.", None)],
    "sias": [("robes", "\"Monks' robes still on\" is right: my reading of the frames plus the monks in the shipped copy.", None)],
}

MIX = {r["key"]: r for r in json.load(open(sorted(glob.glob("data/mix_*.json"))[-1]))}
REELS.sort(key=lambda r: MIX[r["key"]]["date"])
for r in REELS:
    m = MIX[r["key"]]
    when = datetime.strptime(m["date"], "%Y-%m-%d")
    r["meta"] = f'{m["weekday"]} {when.day} {when.strftime("%b")} · ' + r["meta"].split(" · ", 1)[1]
    url = r["copy"][-1][1].removeprefix("Full song: ").replace("/li-comment", "/li-post")
    title, text = r["copy"][-2]
    if m["li_arm"] == "post":
        r["copy"][-2:] = [("LinkedIn · test arm: link in the post", text.replace("Full song in the first comment.", f"Full song: {url}"))]
    else:
        r["copy"][-2:] = [("LinkedIn · test arm: link in the first comment", text), ("LinkedIn first comment, added after it publishes", "Full song: " + url.replace("/li-post", "/li-comment"))]

HEAD = """<title>Reels Schedule</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Source+Sans+3:wght@400;600&family=JetBrains+Mono:wght@400&display=swap">
<style>
/* Layout: a run sheet. The calendar and decisions first, then why, then copy and covers per reel. */
:root { --bg:#f3f5f8; --panel:#ffffff; --ink:#16202c; --soft:#4a5766; --line:#d3dae2; --gel:#00708a; --gel2:#a3195b; --mark:#e3f1f5;
  --disp:"Barlow Condensed","Arial Narrow",sans-serif; --body:"Source Sans 3","Helvetica Neue",Arial,sans-serif; --mono:"JetBrains Mono",ui-monospace,Menlo,monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#10161d; --panel:#18212b; --ink:#e8edf2; --soft:#a4b0bd; --line:#2d3945; --gel:#4cc3dd; --gel2:#f07fb0; --mark:#17323c; color-scheme:dark } }
:root[data-theme="dark"] { --bg:#10161d; --panel:#18212b; --ink:#e8edf2; --soft:#a4b0bd; --line:#2d3945; --gel:#4cc3dd; --gel2:#f07fb0; --mark:#17323c; color-scheme:dark }
button { font:inherit; color:inherit; }
.review-intro { display:grid; gap:10px; }
.reelnav { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr)); gap:6px; list-style:none; margin:0; padding:0; }
.reelnav a { display:flex; justify-content:space-between; gap:12px; padding:8px 12px; background:var(--panel); border:1px solid var(--line); color:var(--ink); text-decoration:none; font-size:15px; }
.reelnav a:hover { border-color:var(--gel); }
.st { color:var(--soft); font-size:13px; white-space:nowrap; } .st.ok { color:var(--gel); font-weight:600; }
.savebar { position:sticky; top:0; z-index:5; display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; padding:8px 12px; background:var(--mark); border:1px solid var(--line); font-size:14px; }
#save-state.bad { color:var(--gel2); font-weight:600; }
.cover { display:block; width:100%; padding:0; background:none; border:3px solid transparent; cursor:pointer; text-align:left; }
.cover:hover { border-color:var(--line); }
.cover[aria-pressed="true"] { border-color:var(--gel); }
.cover[aria-pressed="true"] figcaption { color:var(--gel); font-weight:600; }
.cover.text { min-height:88px; display:flex; align-items:center; justify-content:center; padding:10px; border:1px solid var(--line); background:var(--panel); text-align:center; font-size:14px; }
.cover.text[aria-pressed="true"] { border:3px solid var(--gel); font-weight:600; }
.fact { display:grid; gap:8px; background:var(--panel); border:1px solid var(--line); padding:12px 14px; }
.answers { display:flex; flex-wrap:wrap; gap:6px; }
.answers button { padding:7px 14px; background:var(--bg); border:1px solid var(--line); cursor:pointer; font-size:14px; min-height:40px; }
.answers button:hover { border-color:var(--gel); }
.answers button[aria-pressed="true"] { background:var(--gel); border-color:var(--gel); color:var(--panel); font-weight:600; }
.fact input, .cap input, .cap textarea { width:100%; box-sizing:border-box; background:var(--bg); color:var(--ink); border:1px solid var(--line); padding:8px 10px; font:400 15px/1.45 var(--body); }
.cap textarea { resize:vertical; overflow:hidden; min-height:80px; }
.fact input:focus, .cap input:focus, .cap textarea:focus { outline:2px solid var(--gel); outline-offset:-1px; }
.capfoot { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px; min-height:24px; font-size:13px; }
.edited { color:var(--gel); font-weight:600; } .lint { color:var(--gel2); font-size:13px; }
.reset { background:none; border:0; padding:0; color:var(--gel); text-decoration:underline; cursor:pointer; font-size:13px; }
.confirmbar { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:12px 14px; background:var(--panel); border:2px solid var(--line); }
.confirm { padding:10px 18px; min-height:44px; background:var(--gel); color:var(--panel); border:0; font-weight:600; cursor:pointer; }
.confirm:disabled { background:var(--line); color:var(--soft); cursor:not-allowed; }
.confirm.done { background:none; color:var(--gel); outline:2px solid var(--gel); outline-offset:-2px; }
.confirm-hint { font-size:14px; color:var(--soft); flex:1 1 240px; }
body { background:var(--bg); color:var(--ink); font:400 16px/1.5 var(--body); }
.wrap { max-width:1000px; margin:0 auto; padding-block:28px 64px; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); display:grid; gap:36px; }
h1,h2,h3 { font-family:var(--disp); font-weight:700; line-height:1.1; text-wrap:balance; margin:0; }
h1 { font-size:44px; letter-spacing:.005em; } h2 { font-size:30px; color:var(--gel); } h3 { font-size:26px; }
h4 { margin:0; font-size:15px; font-weight:600; }
p { margin:0; max-width:68ch; } section { display:grid; gap:14px; min-width:0; }
.lede { font-size:18px; }
ol.dec { margin:0; padding-left:22px; display:grid; gap:8px; max-width:74ch; }
.tablewrap { overflow-x:auto; background:var(--panel); border:1px solid var(--line); }
table { border-collapse:collapse; width:100%; font-size:15px; font-variant-numeric:tabular-nums; }
th,td { text-align:left; padding:9px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
th { font-weight:600; color:var(--soft); font-size:13px; white-space:nowrap; } tr:last-child td { border-bottom:0; }
td small { color:var(--soft); display:block; font-size:13px; white-space:nowrap; }
.pill { display:inline-block; font-size:12px; font-weight:600; padding:1px 8px; border:1px solid currentColor; white-space:nowrap; }
.mod { color:var(--gel); } .weak { color:var(--gel2); } .none { color:var(--soft); }
.chart { width:100%; height:auto; display:block; background:var(--panel); border:1px solid var(--line); }
.chart .grid { stroke:var(--line); } .chart .tick { fill:var(--soft); font:12px var(--body); } .chart .lab { fill:var(--ink); font:600 13px var(--body); }
.chart .pt { fill:var(--gel); stroke:var(--panel); stroke-width:2; } .chart .pt.young { fill:var(--panel); stroke:var(--gel); }
.chart .med { stroke:var(--ink); stroke-width:2; } .chart .medt { fill:var(--ink); font:600 12px var(--body); }
.fig { font-size:14px; color:var(--soft); }
.reel { border-top:3px solid var(--gel); padding-top:16px; }
.meta { font-size:14px; color:var(--soft); }
.caps { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,430px),1fr)); gap:12px; }
.cap { background:var(--panel); border:1px solid var(--line); padding:12px 14px; display:grid; gap:8px; align-content:start; min-width:0; }
.caphead { display:flex; flex-wrap:wrap; justify-content:space-between; gap:8px; } .count { font-size:12px; color:var(--soft); }
pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; font:400 14px/1.45 var(--body); }
.ch { margin-top:6px; }
.frames { display:grid; grid-template-columns:repeat(auto-fill,minmax(112px,1fr)); gap:8px; }
figure { margin:0; } figure img { display:block; width:100%; height:auto; } figcaption { font-size:12px; color:var(--soft); padding-top:3px; }
ul.plain { margin:0; padding-left:20px; display:grid; gap:6px; max-width:74ch; }
code { font:400 13px var(--mono); overflow-wrap:anywhere; }
@media (max-width:520px){ h1{font-size:36px} }
</style>
<div class="wrap">
<header style="display:grid;gap:12px">
<h1>Sydney and Brisbane reels: mix, slots, links and copy</h1>
<p class="lede">Slots, link rules and the LinkedIn test are approved. Nothing is scheduled or live yet. Ten reels are confirmed. Covered in Chrome, on Fri 4 Dec, is new and waits on you: its slot and caption aren't approved yet. I schedule only what you've confirmed.</p>
</header>

<section><h2>What I need from you</h2>
<ol class="dec">
<li><strong>Covered in Chrome:</strong> pick its cover, edit its captions if you like, and confirm it below. Confirming also approves its slot, Fri 4 Dec. It's the only reel left to review.</li>
<li><strong>Tracked links:</strong> review and merge <a href="https://github.com/dpovey/bottb/pull/230">PR 230</a> before the first post with a link, Canvanauts on Facebook at 2026-11-09T19:00+11:00. Without it, that reel uses a plain YouTube link and gets no tracked-link count.</li>
<li><strong>Sign in:</strong> to the BotTB YouTube channel and LinkedIn in this session's browser panel.</li>
</ol></section>

{{REVIEW}}

<section><h2>The shuffled order</h2>
<p>A seeded shuffle with three limits: the same band at least 3 slots apart, the same city at most 3 in a row, Mixing also frees us from one bias in past data: weekday won't be tied to a band or a city, so we can later compare slots fairly.</p>
{{ORDER}}
<p>Covered in Chrome goes on Fri 4 Dec: the first open slot that keeps ShipReX 3 slots after Everlong on Fri 27 Nov. That leaves Wed 2 Dec open, which suits Paint It Black or Barracuda if either is ready. The gap also breaks up a Brisbane run: The Chain, Everlong and Say It Ain't So come just before it. New reels go in the same way, and slots already booked stay put.</p>
</section>

<section><h2>The slots</h2>
<p>Add the time to the reel's date. Sydney is AEDT (+11:00), Brisbane AEST (+10:00). The Business Suite and TikTok pickers run in the browser's zone, Brisbane in this session, so the second line is what gets typed there.</p>
<div class="tablewrap"><table>
<tr><th>Day</th><th>TikTok</th><th>LinkedIn</th><th>YouTube Shorts</th><th>Facebook + Instagram</th></tr>
<tr><td><strong>Monday</strong></td><td>T09:00+11:00<small>08:00 Brisbane</small></td><td>T13:00+11:00<small>12:00 Brisbane</small></td><td>T18:00+11:00<small>17:00 Brisbane</small></td><td>T19:00+11:00<small>18:00 Brisbane, Meta active time</small></td></tr>
<tr><td><strong>Wednesday</strong></td><td>T09:00+11:00<small>08:00 Brisbane</small></td><td>T13:00+11:00<small>12:00 Brisbane</small></td><td>T19:00+11:00<small>18:00 Brisbane</small></td><td>T20:00+11:00<small>19:00 Brisbane, an hour before Meta's 20:00</small></td></tr>
<tr><td><strong>Friday</strong></td><td>T09:00+11:00<small>08:00 Brisbane</small></td><td>T13:00+11:00<small>12:00 Brisbane</small></td><td>T19:00+11:00<small>18:00 Brisbane</small></td><td>T20:00+11:00<small>19:00 Brisbane, Meta active time</small></td></tr>
</table></div>
<p>The first slot in full: TikTok 2026-11-09T09:00+11:00, LinkedIn 2026-11-09T13:00+11:00, YouTube 2026-11-09T18:00+11:00, Facebook and Instagram 2026-11-09T19:00+11:00. WhatsApp list goes after the Facebook and Instagram slot each day. A site <code>videos</code> row (type short) goes in once each Short is public.</p>
</section>

<section><h2>Full-song links</h2>
<p>The answer differs by platform, because only Facebook and LinkedIn will carry one. LinkedIn is the one we test.</p>
<div class="tablewrap"><table>
<tr><th>Platform</th><th>What works</th><th>What I'd do</th><th>Evidence</th></tr>
<tr><td><strong>YouTube Shorts</strong></td><td>Links in descriptions and comments aren't clickable. The "Related video" field is, but it needs the channel's primary owner to verify.</td><td>No link, as you decided. "Full song on our channel" in the description.</td><td><span class="pill mod">Official</span> YouTube's help pages state the rule. They give no effect on reach or clicks.</tr>
<tr><td><strong>Facebook</strong></td><td>A caption link is clickable. I checked on a past reel on the web, not in the app. It sits behind "See more" unless it's near the top.</td><td>Keep it in the caption as a tracked link, moved to the second line so it shows before the cut-off. No comment needed, so it can be fully scheduled.</td><td><span class="pill weak">Weak</span> All 19 videos since 14 Sep had a link, so we have nothing to compare, and I found no reel-specific study. Reports of a Meta test capping Pages at 2 link posts a month are second-hand and conflict. We've posted 34 captions with links since 1 Sep, so we aren't being blocked. I'll switch to first comments if a notice appears.</td></tr>
<tr><td><strong>LinkedIn</strong></td><td>Links work in the post and in comments. Posts can't schedule a comment.</td><td>Test it with tracked links: half in the post, half in the first comment.</td><td><span class="pill weak">Weak</span> Published studies disagree, from about 19% to 60% less reach for a link in the post, against 14% more interactions in one study, and LinkedIn denies a penalty. A first comment seems to lose less, about 11% to 15%, in small tests. None is specific to video. Our own data can't say: LinkedIn metrics stop at 13 Oct and the ledger holds few captions.</td></tr>
<tr><td><strong>Instagram</strong></td><td>Caption and comment links aren't clickable without a paid plan. The bio link goes to the site.</td><td>"Full song on our page." The song is already posted there, so nobody has to leave.</td><td><span class="pill none">No test</span> Comment-to-DM tools exist, but I wouldn't add one at this size.</td></tr>
<tr><td><strong>TikTok</strong></td><td>Caption links aren't clickable. A bio link needs a Business account or, by most reports, 1,000 followers.</td><td>"Full song on our page." No URL.</td><td><span class="pill mod">Moderate</span> Full songs there get a median 696 views against 268 for short clips (p under 0.001), so sending people to the one on TikTok suits it anyway.</td></tr>
</table></div>
<h3>The LinkedIn link test</h3>
<ul class="plain">
<li><strong>The two arms:</strong> the link in the post on one, "Full song in the first comment" on the other. Everything else stays the same: slot, tags and caption wording.</li>
<li><strong>Assignment:</strong> each consecutive pair of slots gets one of each arm, drawn at random in advance and shown in the order table, so the arms stay balanced over time. The 11 reels give 5 in the post and 6 in the first comment.</li>
<li><strong>What gets compared:</strong> impressions and views 7 days after each post, and tracked clicks by arm. If reach drops but more people reach the song, that's still useful, so we need both. I fix this now so the result can't be picked afterwards.</li>
<li><strong>What it can show:</strong> a big difference only. From our 5 measured LinkedIn videos, 6 against 6 would catch a true halving of impressions about 24% of the time, and a 20% drop about 11%; 5 against 5 is a little worse. That estimate is itself rough. If the arms look about equal, the answer is that any difference is too small to see at this size, and I'd keep the link in the post because it needs no live session.</li>
<li><strong>What it needs:</strong> PR 230 merged, LinkedIn signed in to read reach, and a session just after each first-comment slot.</li>
</ul>
<p><strong>Other platforms:</strong> I'm not testing Facebook. Our views vary too much: caption against comment on 6 reels each would catch a true 20% drop only about 17% of the time, and a comment would mean a live session at every slot.</p>
<h3>How we measure YouTube hits</h3>
<ul class="plain">
<li><strong>Daily view counts, running since 7 Nov:</strong> every upload's total views, captured daily. Songs whose reels haven't gone out yet act as the comparison for those that have. This shows the combined lift from all platforms, and it's rough: the numbers are small, and a release or share can move a song's views. Facebook's median is 134 views.</li>
<li><strong>Tracked links:</strong> clicks by song and placement on Facebook and LinkedIn, in PostHog. They count clicks rather than watches, and they're an upper bound because a scanner posing as a browser can't be told apart. The link shows our domain rather than youtu.be, and I'll compare the counts with what LinkedIn and Facebook report.</li>
<li><strong>YouTube Studio traffic sources:</strong> views of each full song by source, such as Shorts, Facebook and LinkedIn. Links opened in phone apps may land under "direct or unknown". I'd read it 7 days after each reel.</li>
</ul>
</section>

<section><h2>Why these slots</h2>
<p>Instagram is where a slot can matter most: its median video got 667 views against Facebook's 134 since 14 Sep. Facebook views before 14 Sep are excluded because the Meta app was unpublished then and hid those reels.</p>
{{STRIP}}
<p class="fig">Instagram video views by publishing hour, Brisbane time, from Business Suite on 7 Nov. Each dot is one post; the bar and number mark the median of posts at least 7 days old. Hollow dots are younger: good 4 u at 23:43 and Mustang Sally at 00:13, which can't yet be compared. Hover a dot for the post.</p>
<div class="tablewrap"><table>
<tr><th>Choice</th><th>Evidence</th><th>Strength</th></tr>
<tr><td>Instagram late afternoon to evening</td><td>13:00 to 19:00 median 794 views (n=16) against 466 for mornings (n=9): 1.7x, 90% interval 1.3x to 3.0x, p about 0.08. Meta's active times for this account agree: Sun 14:00, Mon 18:00, Wed 20:00, Fri 19:00 Brisbane. Mornings were mostly the countdown clips, so content is mixed in.</td><td><span class="pill mod">Moderate</span></td></tr>
<tr><td>Mon, Wed, Fri</td><td>Taken from Meta's active times. Our own posts don't separate weekdays: at most 6 posts on any day, and the best results (Sat, Tue) include a winners' song and a highlights reel.</td><td><span class="pill weak">Weak</span></td></tr>
<tr><td>LinkedIn at midday</td><td>No real hour comparison: 12 of the 16 measured posts went out at 12:00 or 13:00 Brisbane. Five measured full-song videos have a median 399 impressions and 171 views, with a range of 25 to 1,261 impressions. Photos have 297 impressions (n=11). None of the 8 short reels has metrics. I'd read the 28 unmeasured posts before the first slot. The reason to add it is the company tags, not measured reach.</td><td><span class="pill none">None</span></td></tr>
<tr><td>Two days apart</td><td>Instagram views by gap since the previous video: under 1.5 days 575 (n=12), 1.5 to 4 days 846 (n=8), 4 days or more 767 (n=6). Wide overlap. Daily runs look worse; longer gaps gain nothing visible. Mon 9 is 3 days after Mustang Sally.</td><td><span class="pill weak">Weak</span></td></tr>
<tr><td>Facebook with Instagram</td><td>Mornings 88 (n=9), 13:00 to 17:00 134 (n=5), 17:00 to 19:00 185 (n=3). Same direction, tiny numbers, 86 followers. One composer and one drag covers both. Meta's Facebook times (Sat 22:00, Tue 21:00, Sun 08:00) don't match, and I'm not chasing them for this audience.</td><td><span class="pill weak">Weak</span></td></tr>
<tr><td>TikTok at 09:00 Sydney</td><td>Clips of 60 s or less published 07:00 to 11:00 Brisbane: 3 of 3 passed 600 views. Published 17:00 to 21:00: 3 of 14. All three morning clips are from June and August, so it may be the era rather than the hour. TikTok has no activity data under 100 followers, and the 19:00 precedent has no measured support.</td><td><span class="pill weak">Weak</span></td></tr>
<tr><td>YouTube an hour before Instagram</td><td>No measured time effect: mornings 433 (n=4), evenings 389 (n=8). I kept one evening moment so the band has one link to share. The audience tab couldn't be read, because YouTube is signed out here.</td><td><span class="pill none">None</span></td></tr>
</table></div>
<p>Your morning rule from 15 Sep (YouTube 07:30, Facebook 09:00) is not what I propose: the numbers don't favour mornings on Instagram or Facebook. The last two Instagram posts went out around midnight; I'd stop that. Say if you'd still rather keep YouTube in the morning, since it costs nothing there.</p>
<p><strong>Audience:</strong> Instagram followers (252) are 33% Brisbane, 20% Sydney, 13% Melbourne and about 67% aged 25 to 44. Facebook is under Meta's threshold for demographics.</p>
<p><strong>What to expect:</strong> medians for clips of a minute or less are about 640 views on Instagram (n=14), 460 on YouTube Shorts (n=8), 270 on TikTok (n=22) and 85 on Facebook (n=6). TikTok is the weak spot: full songs there get 696 (n=27), with p under 0.001. On YouTube it runs the other way, Shorts 460 against full songs 172. On Instagram length makes no clear difference. All of these views depend far more on the post than the hour: the top of the range is 2,070 on Instagram.</p>
</section>

<section><h2>What it takes each week</h2>
<ul class="plain">
<li><strong>It schedules Reels natively for both Facebook and Instagram from one composer</strong>, with separate captions through "Customize post". That fixes the Instagram slot problem: no session has to be alive at publish time.</li>
<li><strong>You drag each reel in.</strong> Its security rules block our Blob fetch, and this session's browser refuses uploads over 50 MB. The reels are 74 to 105 MB. TikTok and LinkedIn need your drag too. YouTube doesn't: its file comes from our storage. That's 3 drags per reel, 33 for these 11. I fill in everything else.</li>
<li><strong>TikTok only schedules 10 days ahead,</strong> so the first sitting covers it through Mon 16 Nov and later reels follow in weekly sittings. Anything scheduled on TikTok can't be edited. How far ahead Business Suite goes is unchecked, and I'll confirm it on the first reel.</li>
<li><strong>YouTube gets a 2160x3840 render,</strong> and every other platform gets the 1080x1920 file. It's an upscale: each vertical window holds at most 1215x2160 real pixels, so it adds no detail. What it may buy is YouTube's handling, because 4K uploads are widely reported to get a better codec and more bitrate. That's unverified, and a test upload would show it.</li>
<li><strong>One step needs a live session around the slot:</strong> the LinkedIn first comment on the reels in that arm. If nobody's on at that time, I do it later the same day.</li>
<li><strong>Collaborators are unconfirmed on scheduled Reels.</strong> I'll check on the first one. If the composer doesn't offer them, I add them on instagram.com after each post publishes, which needs that session signed in. The web route takes 3.</li>
<li><strong>Whether the Reels composer takes a custom cover</strong> isn't checked yet: it needs a video loaded. If not, I'll tell you before Canvanauts is scheduled.</li>
</ul></section>

<section><h2>The loop</h2>
<ul class="plain">
<li><strong>Six reels are rotated so the loop continues the music:</strong> Canvanauts, Amakazaam!, V2 Voyagers, All Coming Back, No One Knows and Everlong. At the loop point, sample steps in five of them are ordinary for that reel. Canvanauts' is in its top 0.1%, so listen for a tick.</li>
<li><strong>Sultans of Swing measured differently.</strong> It's rotated too, with a step at its loop point larger than all but 0.001% of the reel's, and a 12 dB level change in 10 ms. You listened and marked it fine.</li>
<li><strong>Four play straight through,</strong> so their loop is a hard cut: good 4 u, The Chain, Say It Ain't So and Covered in Chrome.</li>
<li><strong>The logo returns on each loop,</strong> over the first 4.5 s of every replay, because it's burned in. Platforms that auto-replay will show it each time.</li>
<li><strong>Nothing is known yet about the platforms.</strong> Each re-encodes the audio and restarts the player its own way, and I can't hear the result. On the first post I'll report what each player does, and I need your ears on a phone for any gap or click. You chose to stage without waiting for that check, and TikTok's scheduled posts can't be edited. Canvanauts will be the first look at a rotated loop, and good 4 u on Wednesday at a hard cut.</li>
</ul></section>

<section><h2>The queue and what comes next</h2>
<ul class="plain">
<li><strong>Nothing else is queued.</strong> Facebook scheduled posts: none. TikTok drafts: none. Business Suite Planner this month: only Meta's suggested times, no scheduled posts. Mustang Sally went out 6 Nov.</li>
<li><strong>Paint It Black and Barracuda</strong> have no dates. Both are still in audio. Each would take a slot when approved, and its reel would follow its release.</li>
<li><strong>More reels:</strong> Monday, Wednesday and Friday have room for 7 more slots by Fri 18 Dec, including Wed 2 Dec. Past that, either run into January or add Sunday 14:00 Brisbane, a Meta active time but only 28 hours before Monday's slot, which is the kind of gap that did worse (weak evidence).</li>
</ul></section>

"""

TAIL = """
<section><h2>Sources</h2>
<p class="fig">Ledger and metrics collected 7 Nov, Business Suite Content table (last 90 days) and Audience, TikTok Studio content list, Facebook captions from the Graph API. Links: <a href="https://support.google.com/youtube/answer/13748639">YouTube, sharing links</a>, <a href="https://support.google.com/youtube/answer/14075157">YouTube, related video</a>, <a href="https://www.socialmediaexaminer.com/what-facebooks-new-link-rules-mean-for-your-2026-strategy/">Social Media Examiner on Facebook links</a>, <a href="https://www.tryordinal.com/blog/linkedin-link-penalty-study">Ordinal on LinkedIn links</a>, <a href="https://www.feedboss.ai/blog/do-linkedin-links-reduce-reach">Feedboss's summary of the LinkedIn reports</a>, <a href="https://magicpost.in/blog/linkedin-external-links-reach">MagicPost on LinkedIn links</a>. Apart from YouTube's own pages, these are vendor or second-hand sources. Working: <code>~/src/personal/bottb/doc/production/reels-schedule</code>, with findings in <code>notes/findings.md</code>.</p>
</section>
</div>
"""
