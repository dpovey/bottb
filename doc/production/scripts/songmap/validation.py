"""What was checked by looking at camera frames (songmap.frames) or by reading curves, and the result.

Each row: (band, REF s, claim from the map / config, result, how). `ok` = the picture agrees, `no` =
it doesn't, `?` = the picture can't tell. Camera operators' framing is evidence, not ground truth:
they follow solos and singers most of the time.
"""

CHECKS = [
    # ---- Canvanauts (pilot)
    ("canvanauts", 4070, "Joker intro: GTR Q2 plays alone (guitar:C)", "ok",
     "tracking + pit at 4066/4078 frame the bandana guitarist, nobody else playing"),
    ("canvanauts", 4130, "RX3 = singer in the black hat (centre)", "ok",
     "RX3-only 4127-4139: tracking 4136 hat singer mic at mouth"),
    ("canvanauts", 4150, "RX2 = blond singer in sunglasses (house left of centre)", "ok",
     "RX2-only 4146-4158: pit 4156 blond singer mic at mouth"),
    ("canvanauts", 4140, "stage order HL->HR: keys, Q1, RX2, RX3, Q2, bass, BASS Q", "ok",
     "wide 4140 at 1600 px; BASS Q's player by elimination"),
    ("canvanauts", 4296, "GTR Q1 = curly-haired guitarist house left", "ok",
     "tracking + pit both frame him during Q1's single-note run 4290-4300"),
    ("canvanauts", 4302, "Joker 4297-4308 featured keys", "no",
     "tracking on Q1 + blond singer, pit on Q2: keys not framed; likely a guitar section"),
    ("canvanauts", 4322, "Joker 4319-4325 featured keys", "no", "tracking on Q1, pit on Q2"),
    ("canvanauts", 4453, "Thnks 4449-4455 featured keys (string hook)", "?",
     "operators on the singers and Q2; keys player not framed"),
    ("canvanauts", 4424, "Thnks chorus 4424-4441 (hook)", "ok",
     "Whisper: 'one night and one more time, thanks for the memories' at 4425-4440"),
    ("canvanauts", 4746, "So Easy 4742-4757 solo by BASS Q (guitar:HR)", "ok",
     "tracking 4746/4752 frames the far house-right guitarist (confirms BASS Q's player too)"),
    ("canvanauts", 4815, "Beggin' starts 4810 with an unaccompanied vocal (RX2)", "ok",
     "tracking + pit 4815: blond singer singing, band holding; run sheet 'Vox 2 starts'"),
    ("canvanauts", 4952, "Beggin' bass solo 4942-4957", "ok",
     "tracking/pit 4952-4960 on the bassist; run sheet 'bass solo at ~2:15'; guitars drop 15-25 dB"),
    ("canvanauts", 5210, "Smooth Criminal 5195-5206 featured GTR Q1", "ok",
     "tracking + pit 5210 both frame the curly-haired guitarist"),
    ("canvanauts", 5302, "Black Parade piano intro 5299-5306 (keys alone)", "?",
     "audio certain (only KEYS on); operators framed the singers"),
    ("canvanauts", 5484, "Black Parade 5472-5496: singing, Q2 lead line under it", "ok",
     "tracking: both singers mic at mouth; pit 5478-5490 on the bandana guitarist (Q2)"),
    # ---- Bandlassian
    ("bandlassian", 2952, "stage order HL->HR: keys, Fender gtr, Lesley RX2, Luke RX3, bass, AC30 gtr", "ok",
     "wide 2952/2990/3052"),
    ("bandlassian", 3080, "Life Is a Highway 3074-3087 solo by GTR SR (Eren, boost)", "ok",
     "run sheet: 'Eren's solo: boost'; GTR SR lead score 1.0-1.3, flux 0.25 vs 0.14"),
    ("bandlassian", 3540, "Pokemon 3534-3551 solo by GTR SL (Josh, ME-70 boost)", "ok",
     "run sheet: 'Josh's solos: boost'; flux 0.33 vs 0.19"),
    ("bandlassian", 3296, "I'm a Believer organ ~3296-3300", "ok", "pit 3296 frames the keyboard player"),
    ("bandlassian", 2510, "RX5 exclusive moments in good 4 u", "no",
     "artefact of a set-wide reference; per song RX5 is not live, Lesley is on RX2"),
    # ---- ShipReX
    ("shiprex", 1120, "RX1 = Scott W, the singer just house right of the erhu player", "ok",
     "RX1-only 1120/1174 (Dumb Things, his lead): tracking + pit, mic at mouth"),
    ("shiprex", 600, "Scotty (far house left) absent in song 1", "ok", "wide 600: no guitarist at house left"),
    ("shiprex", 485, "Careless Whisper intro: erhu melody on ACC 2 (not ACC 1)", "ok",
     "ACC 2 mono melody, on 98 %; ACC 1 at -75 dB; run sheet: 30 s of Careless Whisper on erhu"),
    ("shiprex", 780, "Uprising 765-781 erhu feature", "ok", "tracking + pit 780 frame the erhu player"),
    ("shiprex", 810, "Uprising 790-830 Thiago (GTR SL) feature", "ok",
     "tracking holds on Thiago at 790/800/808/820/830; no audio term separates it: set by override (seen)"),
    ("shiprex", 836, "Uprising 836-843 keys feature", "ok", "pit 830/838 frames the keyboard player"),
    # ---- Amakazaam
    ("amakazaam", 6760, "stage order HL->HR: keys, Tim, Keira (Senn), bass, Tyler (RX4) far house right", "ok",
     "wide 6760; RX4 carries the Under Pressure co-lead (stage plot said Vox 3)"),
    ("amakazaam", 6960, "AYGGMW: Keira sings from the kit on RX5", "ok", "wide 6960: Keira on the kit"),
    ("amakazaam", 7070, "AYGGMW 7066-7086 guitar solo by Tyler (guitar:HR)", "ok",
     "pit 7070 on Tyler; run sheet: Andrew takes the kit back at the guitar solo"),
    ("amakazaam", 7668, "Killing in the Name 7661-7676 solo by Tyler (guitar:HR)", "ok", "tracking 7668 on Tyler"),
    ("amakazaam", 6478, "Superstition 6476-6480 guitar:HR (4 s)", "no", "tracking + pit on Keira singing"),
    ("bandlassian", 3545, "Pokemon solo is Josh on the AC30 (guitar:HR)", "ok",
     "tracking 3545 on the floral-shirt player (Josh, keys in songs 1-3, AC30 in 4-5)"),
    ("v2voyagers", 8937, "Drops of Jupiter 8934-8940 acoustic feature", "?", "tracking on Holly + drummer"),
    ("v2voyagers", 9514, "Starships/UFO 9507-9521 guitar:HL (Taz)", "ok", "tracking 9514 on Taz"),
    # ---- V2 Voyagers
    ("v2voyagers", 9100, "stage order HL->HR: Taz gtr, Holly (SM58) centre, Milly acoustic, Cam bass", "ok",
     "wide 8400/9100; SM58 carries the lead in every song"),
]
