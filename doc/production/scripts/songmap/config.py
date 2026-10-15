"""Paths, time bases and per-band facts for the Sydney 2026 song maps.

Everything is in REF seconds = file seconds of the Logic take `#02` desk multitrack.
Band facts come from `prep/SYDNEY-2026-PREP.md` and the stage plots
(`doc/production/sydney-2026-stage-plots/*.pptx`); what was confirmed by looking at camera
frames is marked `seen`.
"""
from __future__ import annotations

from pathlib import Path

SHOW = Path("/Volumes/BOTTB/Sydney - 2026")
AUDIO_DIR = SHOW / "Project.logicx/Media/Audio Files"
SYNC_AUDIO = SHOW / "video/sync_audio"
OUT = SHOW / "video/song_maps"
PLACEMENTS = Path.home() / "src/personal/gigstills/runs/sydney26_firstpass/placements_plan.json"
CLOG3_LUT = Path.home() / "src/personal/gigstills/runs/sydney26_firstpass/luts/clog3_push1_view.cube"
SLOG3_LUT_DIR = Path.home() / "src/personal/gigstills/runs/sydney26_firstpass/luts"
MEDIA = Path("/Volumes/BOTTB SYD26")  # read-only camera media

SR = 48000
HOP = 2400  # 20 frames per second for the spectral features
NFFT = 4096
FPS = HOP and SR / HOP
ENV_HOP = 480  # 100 Hz for drum / onset envelopes

TC_FPS = 25
REF_AT_TC0 = 2.8025625  # REF second at timeline 01:00:00:00 (frame 90000)

TRACKS = [
    "Kick", "Snare", "HH", "T1", "T2", "FT", "OH L", "OH R", "Bass", "GTR SR", "GTR SL",
    "BASS Q", "GTR Q1", "GTR Q2", "ACC 1", "ACC 2", "KEYS 2L", "KEYS 2R",
    "RX1", "RX2", "RX3", "RX4", "RX5", "RX6", "Senn", "SM58", "TRAX",
]
DRUMS = ["Kick", "Snare", "HH", "T1", "T2", "FT", "OH L", "OH R"]
VOCAL_MICS = ["RX1", "RX2", "RX3", "RX4", "RX5", "RX6", "Senn", "SM58"]


def ref_to_frame(ref_s: float) -> int:
    return int(round(90000 + (ref_s - REF_AT_TC0) * TC_FPS))


def ref_to_tc(ref_s: float) -> str:
    f = ref_to_frame(ref_s)
    ff = f % TC_FPS
    s = f // TC_FPS
    return f"{s // 3600:02d}:{(s // 60) % 60:02d}:{s % 60:02d}:{ff:02d}"


# --------------------------------------------------------------------------- bands
# Who-names use HOUSE sides (the audience's / cameras' view): "guitar:HL" = house left = stage right =
# the left of the wide (STATIC DESKCAM) frame; "guitar:HR" = house right = stage left; "guitar:C" = centre.
# `instruments`: tracks that carry this band's instruments (the song/talk detector and the
# featured-instrument logic use them). `vocals`: mic -> who. `guitars`: track -> position.
# Positions are on stage as the audience sees them: "HL" = house left (= stage right),
# "HR" = house right (= stage left). Stage-left/right names follow the stage convention.

BANDS = {
    "shiprex": {
        "name": "ShipReX",
        "dir": "ShipReX",
        "set_intro": "silence before the erhu's first note",
        "set": (471, 2145),
        "songs": [
            ("Careless Whisper / Uprising", 473),
            ("Espresso", 884),
            ("Dumb Things", 1094),
            ("Mustang Sally", 1296),
            ("Everlong", 1600),
            ("Covered in Chrome", 1954),
        ],
        "instruments": {
            "Bass": "bass", "GTR SR": "guitar:HL", "GTR SL": "guitar:HR", "KEYS": "keys",
            # ACC 2 is the erhu (measured: a single-note melody, chroma entropy 1.5, ~1 kHz, on 98 % of the
            # Careless Whisper intro the run sheet gives to the erhu; ACC 1 sits at -70..-75 dB all set).
            # The prep doc says ACC 1 = erhu: flagged for Dean.
            "ACC 2": "erhu", "ACC 1": "acc1",
        },
        "lead_instruments": ["ACC 2"],
        "overrides": {
            "Careless Whisper / Uprising": {"seen_features": [
                (790, 830, "guitar:HR", "tracking holds on Thiago 790-830 (frames 790/800/808/820/830); "
                                        "his amp's level/flux don't separate it from the riff")]},
        },
        "vocals": {
            "RX1": "Scott W (Vox 1, lead songs 3-4): seen singing at 1120/1174, the singer just house right of the erhu player",
            "RX2": "Hamish (Vox 2, lead songs 1, 2, 5, 6): the other front singer (house left of the erhu, by elimination)",
            "RX3": "Mindy / Elle (Vox 3, backing)",
            "RX4": "Lil (Vox 4, backing)",
            "RX5": "female backing (front mic)",
        },
        "players": {
            "guitar:HL": "Scotty, far house left (joins from song 2; seen with a red acoustic at 917-1174)",
            "guitar:HR": "Thiago (Vox AC30, GTR SL)",
            "bass": "Kirra (pirate hat), house right", "keys": "Daniel (red bandana), house left",
            "erhu": "Sophie (erhu; ACC 2 by measurement), left of centre", "drums": "Simon",
            "acc1": "ACC 1 (near silent all set)",
            "guitar:HR": "Thiago (gold sequin jacket, AC30, GTR SL), far house right",
        },
        "stage_x": {  # seen in the wide at 600 / 917 / 1120
            "guitar:HL": 0.06, "keys": 0.12, "vocal:RX2": 0.25, "erhu": 0.36, "vocal:RX1": 0.45, "drums": 0.5,
            "vocal:RX3": 0.6, "vocal:RX4": 0.68, "vocal:RX5": 0.74, "bass": 0.8, "guitar:HR": 0.9,
        },
    },
    "bandlassian": {
        "name": "Bandlassian",
        "dir": "Bandlassian",
        "set_intro": "walk-on, quick band intro (laptop audio is not on the desk inputs)",
        "set": (2434, 3604),
        "songs": [
            ("good 4 u", 2456),
            ("Still into You", 2678),
            ("Life Is a Highway", 2912),
            ("I'm a Believer", 3190),
            ("Pokémon Theme", 3393),
        ],
        # Seen (wide 2952-3052): house left -> right: keys (Kronos) | Fender guitarist | Lesley (RX2,
        # handheld) | Luke (RX3, cap, handheld) | Linda (bass) | AC30 guitarist far house right.
        "instruments": {"Bass": "bass", "GTR SR": "guitar:HL", "GTR SL": "guitar:HR", "KEYS": "keys"},
        "vocals": {"RX2": "Lesley (Vox 2, lead songs 1-2)", "RX3": "Luke (Vox 3, lead songs 4-5)"},
        "players": {
            "guitar:HL": "Eren (songs 1, 3, 5) / Kazuki (songs 2, 4) on the Fender (GTR SR)",
            "guitar:HR": "Steve (songs 1-3) / Josh (songs 4-5) on the AC30 (GTR SL)",
            "bass": "Linda", "keys": "Josh (songs 1, 3) / Mendel (songs 2, 4, 5)", "drums": "Ethan",
        },
        "stage_x": {"keys": 0.12, "guitar:HL": 0.32, "vocal:RX2": 0.47, "drums": 0.5, "vocal:RX3": 0.6,
                    "bass": 0.77, "guitar:HR": 0.9},
        "overrides": {
            # 2434-2448 is walk-on talk (RX3) over scattered bass/keys noodles, then GTR SL alone
            # 2448-2456: not clearly the song, so the grid's first downbeat stands
            "good 4 u": {"no_head_music": True},
        },
        "song_players": {  # from the run sheet's changeovers
            "good 4 u": {"guitar:HL": "Eren (Fender, GTR SR)", "guitar:HR": "Steve (AC30, GTR SL)", "keys": "Josh"},
            "Still into You": {"guitar:HL": "Kazuki (Fender, GTR SR)", "guitar:HR": "Steve (AC30, GTR SL)",
                               "keys": "Mendel"},
            "Life Is a Highway": {"guitar:HL": "Eren (Fender, GTR SR; solo with boost)",
                                  "guitar:HR": "Steve (AC30, GTR SL)", "keys": "Josh"},
            "I'm a Believer": {"guitar:HL": "Kazuki (Fender, GTR SR)", "guitar:HR": "Josh (AC30, GTR SL)",
                               "keys": "Mendel"},
            "Pokémon Theme": {"guitar:HL": "Eren (Fender, GTR SR)",
                              "guitar:HR": "Josh (AC30, GTR SL; solos with boost)", "keys": "Mendel"},
        },
    },
    "canvanauts": {
        "name": "Canvanauts",
        "dir": "Canvanauts",
        "set_intro": "the guitar's first note (Joker starts on GTR Q2 alone)",
        "set": (4059, 5632),
        "songs": [
            ("The Joker and the Thief", 4061),
            ("Thnks fr th Mmrs", 4391),
            ("So Easy (To Fall in Love)", 4622),
            ("Beggin'", 4827),
            ("Smooth Criminal", 5063),
            ("Welcome to the Black Parade", 5274),
        ],
        # Seen (wide 4140, tracking/pit at exclusive moments 4066-4078, 4130-4156, 4296):
        # house left -> right: keys (Simone, RX1) | curly-haired guitarist, purple guitar (GTR Q1) |
        # blond singer in sunglasses (RX2) | singer in black hat (RX3, centre) | guitarist in bandana
        # (GTR Q2) | bassist (Bass DI) | guitarist far house right (BASS Q, by elimination).
        "instruments": {
            "Bass": "bass", "GTR Q1": "guitar:HL", "GTR Q2": "guitar:C", "BASS Q": "guitar:HR",
            "KEYS": "keys",
        },
        "vocals": {
            "RX1": "Simone (Vox 1, at the keys, far house left; lead song 3)",
            "RX2": "blond singer in sunglasses, house left of centre (Vox 2 = Ollie per stage plot)",
            "RX3": "singer in the black hat, centre (Vox 3 = Melad per stage plot)",
        },
        "players": {
            "bass": "Jeremy (Bass DI), right of centre", "keys": "Simone (Kronos), far house left",
            "drums": "Gerónimo",
            "guitar:HL": "curly-haired guitarist, purple guitar, house left (GTR Q1)",
            "guitar:C": "guitarist in a bandana, right of centre in front of the riser (GTR Q2; plays the Joker intro)",
            "guitar:HR": "guitarist far house right (BASS Q track; by elimination, not seen soloing)",
        },
        "overrides": {
            # 5049-5056 is a steady BASS Q tone under RX3 talking; the run sheet says "drums start"
            "Smooth Criminal": {"no_head_music": True},
        },
        "stage_x": {  # 0 = house-left edge of the wide (STATIC DESKCAM) frame, 1 = house right
            "keys": 0.09, "vocal:RX1": 0.09, "guitar:HL": 0.24, "vocal:RX2": 0.37, "vocal:RX3": 0.49,
            "drums": 0.45, "guitar:C": 0.59, "bass": 0.73, "guitar:HR": 0.87,
        },
    },
    "amakazaam": {
        "name": "Amakazaam!",
        "dir": "Amakazaam",
        "set_intro": "Alexa intro: laptop voice-over (TRAX), band already on stage",
        "set": (6163, 7766),
        "songs": [
            ("Valerie", 6180),
            ("Superstition", 6410),
            ("Under Pressure", 6670),
            ("Are You Gonna Go My Way", 6888),
            ("You Oughta Know", 7111),
            ("Killing in the Name", 7431),
        ],
        "instruments": {
            "Bass": "bass", "GTR SR": "guitar:HL", "GTR SL": "guitar:HR", "KEYS": "keys",
            "TRAX": "playback",
        },
        "vocals": {
            "Senn": "Keira (lead, wireless at centre)",
            "RX1": "Aaron (Vox 1 at the keys; backing song 6; Andrew's cowbell spot song 4)",
            "RX4": "Tyler, guitar + vox (measured: RX4 carries the Under Pressure co-lead; the stage plot said Vox 3)",
            "RX5": "Vox 5 at the drums: Andrew's spoken line; Keira sings song 4 from the kit",
        },
        "players": {
            "guitar:HL": "Tim (sleeveless, Fender, GTR SR, rhythm), left of centre",
            "guitar:HR": "Tyler (plaid, beard, AC30, GTR SL, lead + vox on RX4), far house right",
            "bass": "Sam (plaid), right of centre", "keys": "Aaron, far house left",
            "drums": "Andrew (Keira on song 4 until the guitar solo)",
        },
        "stage_x": {"keys": 0.08, "vocal:RX1": 0.08, "guitar:HL": 0.25, "vocal:Senn": 0.5, "drums": 0.5,
                    "vocal:RX5": 0.5, "bass": 0.66, "guitar:HR": 0.87, "vocal:RX4": 0.87},
    },
    "v2voyagers": {
        "name": "V2 Voyagers",
        "dir": "V2-Voyagers",
        "set_intro": "walk-on: intro video + backing track, band in silhouette",
        "set": (8271, 9612),
        "songs": [
            ("Venus", 8301),
            ("Cosmic Girl", 8468),
            ("Drops of Jupiter", 8717),
            ("All Star", 9032),
            ("Starships / UFO", 9276),
        ],
        "instruments": {
            "Bass": "bass", "GTR SR": "guitar:HL", "ACC 2": "acoustic", "TRAX": "playback",
        },
        "vocals": {
            "SM58": "Holly (lead; measured: SM58 carries the lead in every song), centre",
            "RX1": "Milly? (light backing)",
            "RX4": "Milly (Vox 4, backing, per stage plot)",
        },
        "players": {
            "guitar:HL": "Taz (Fender, GTR SR), far house left", "acoustic": "Milly (acoustic DI), right of centre",
            "bass": "Cam, house right", "drums": "Jai (songs 1-3) / Shane (songs 4-5)",
        },
        "stage_x": {"guitar:HL": 0.1, "vocal:SM58": 0.42, "drums": 0.45, "acoustic": 0.62, "vocal:RX4": 0.62,
                    "bass": 0.85},
    },
}

ORDER = ["shiprex", "bandlassian", "canvanauts", "amakazaam", "v2voyagers"]
