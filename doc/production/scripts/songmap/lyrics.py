"""Chorus anchors from the words: Whisper (small.en) on each song's gated vocal-mic sum, then find
the title / hook phrases. A chorus nearly always carries the title, so sections holding hook words
are chorus evidence (combined with energy/repetition in `analyse.label_sections`).

Two steps, two venvs (the bottb/scratch venv has soundfile; the gigstills venv has torch+transformers):

  python -m songmap.lyrics prep <band>       # writes song_maps/_cache/vox16k/<band>/<stem>.npy (+ .json meta)
  <gigstills venv>/python songmap/lyrics.py asr <dir>   # writes <stem>.words.json next to each .npy

Whisper runs on 30 s windows every 26 s (words kept from each window's middle).
Each mic is gated by its own vocal-activity mask (0.2 s fades) so bleed between phrases is silent;
the gated mics are summed and resampled 48 k -> 16 k. Whisper runs offline from the HF cache on
/Volumes/Supp1Tb (HF_HOME), CPU, 30 s chunks, word timestamps.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import numpy as np

HOOKS = {
    "The Joker and the Thief": ["joker", "thief"],
    "Thnks fr th Mmrs": ["memories", "thanks for the", "one more time"],
    "So Easy (To Fall in Love)": ["so easy", "fall in love"],
    "Beggin'": ["beggin", "begging", "begin"],
    "Smooth Criminal": ["annie", "are you ok", "criminal"],
    "Welcome to the Black Parade": ["carry on", "parade"],
    "good 4 u": ["good for you", "good 4 u", "like a damn sociopath"],
    "Still into You": ["still into you", "into you"],
    "Life Is a Highway": ["highway", "ride it all night"],
    "I'm a Believer": ["believer", "i'm in love"],
    "Pokémon Theme": ["pokemon", "catch them all", "catch 'em all", "gotta catch"],
    "Careless Whisper / Uprising": ["they will not control", "victorious", "rise up"],
    "Espresso": ["espresso", "that's that me", "that me espresso"],
    "Dumb Things": ["dumb things", "i've done all the dumb"],
    "Mustang Sally": ["mustang", "sally", "ride sally"],
    "Everlong": ["breathe out", "so i can breathe", "if everything could ever"],
    "Covered in Chrome": ["covered in chrome", "wasted"],
    "Valerie": ["valerie"],
    "Superstition": ["superstition", "superstitious", "when you believe in things", "writing's on the wall"],
    "Under Pressure": ["under pressure", "pressure", "pressing down"],
    "Are You Gonna Go My Way": ["gonna go my way", "go my way"],
    "You Oughta Know": ["oughta know", "you ought to know"],
    "Killing in the Name": ["killing in the name", "what they told", "won't do what you tell"],
    "Venus": ["venus", "goddess", "fire of her desire"],
    "Cosmic Girl": ["cosmic girl", "cosmic"],
    "Drops of Jupiter": ["jupiter", "drops of", "back in the atmosphere", "did you sail across"],
    "All Star": ["all star", "hey now", "rock star", "get your game on"],
    "Starships / UFO": ["starships", "meant to fly", "ufo", "higher than a"],
}


def drop_loops(words):
    """Whisper loops on music ("I'm down, I'm down, ..."): drop phrases whose tokens are mostly one
    repeated 1-3 word pattern (> 12 tokens, < 30 % distinct)."""
    by = {}
    for w in words:
        by.setdefault((w.get("phrase_start"), w.get("phrase_end")), []).append(w)
    keep = []
    for k, ws in by.items():
        toks = [re.sub(r"[^a-z']", "", w["w"].lower()) for w in ws]
        if len(toks) > 12 and len(set(toks)) / len(toks) < 0.3:
            continue
        keep += ws
    return sorted(keep, key=lambda w: w["t"])


def hook_hits(title, words):
    """[(t_s, phrase)] where a hook phrase appears in the word stream."""
    hooks = HOOKS.get(title, [])
    toks = [(w["t"], re.sub(r"[^a-z' ]", "", w["w"].lower()).strip()) for w in words]
    hits = []
    for h in hooks:
        hw = h.split()
        for i in range(len(toks) - len(hw) + 1):
            if all(toks[i + j][1].replace("'", "") == hw[j].replace("'", "") for j in range(len(hw))):
                hits.append((toks[i][0], h))
    return sorted(hits)


def prep(band):
    from . import analyse as A
    from . import config as C
    from scipy.signal import resample_poly
    import soundfile as sf

    cfg = C.BANDS[band]
    out = C.OUT / "_cache" / "vox16k" / band
    out.mkdir(parents=True, exist_ok=True)
    F = A.Feats(band)
    for f in sorted(p for p in (C.OUT / cfg["dir"]).glob("*.events.json") if not p.name.startswith("._")):
        m = json.loads(f.read_text())
        a, b = m["start_s"], m["end_s"]
        mics = m["live_mics"]
        if not mics:
            continue
        ex = A.vocal_excess(F, mics, a, b)
        act = A.vocal_activity(ex, F.fps, on=8.0, off=5.0)
        n = int((b - a) * C.SR)
        acc = np.zeros(n, np.float32)
        for mic in mics:
            x, _ = sf.read(str(C.AUDIO_DIR / f"{mic} #02.wav"), start=int(a * C.SR), stop=int(a * C.SR) + n,
                           dtype="float32")
            g = act[mic].astype(np.float32)
            g = np.convolve(g, np.ones(4) / 4, mode="same")  # 0.2 s fades
            gi = np.interp(np.arange(len(x)) / C.SR, np.arange(len(g)) / F.fps, g).astype(np.float32)
            acc[: len(x)] += x * gi
        y = resample_poly(acc, 1, 3).astype(np.float32)
        y /= max(1e-6, np.percentile(np.abs(y), 99.9)) * 1.2
        stem = f.name.replace(".events.json", "")
        np.save(out / f"{stem}.npy", y)
        (out / f"{stem}.json").write_text(json.dumps(dict(song=m["song"], start_s=a, end_s=b)))
        print("prepped", stem, f"{len(y) / 16000:.0f} s", flush=True)


def asr(d):
    os.environ.setdefault("HF_HOME", "/Volumes/Supp1Tb/ai-models/hf")
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    import torch
    from transformers import pipeline

    torch.set_num_threads(int(os.environ.get("OMP_NUM_THREADS", "4")))
    asr_p = pipeline("automatic-speech-recognition", model="openai/whisper-small.en", device="cpu")
    W, HOP_S = 30.0, 26.0  # own chunking keeps the peak bounded (pipeline chunking held ~5 GB)
    for p in sorted(Path(d).glob("*.npy")):
        if p.name.startswith("._"):
            continue
        outp = p.with_suffix(".words.json")
        if outp.exists():
            continue
        meta = json.loads(p.with_suffix(".json").read_text())
        y = np.load(p)
        dur = len(y) / 16000
        words, texts = [], []
        t0 = 0.0
        while t0 < dur - 1:
            seg = y[int(t0 * 16000): int(min(dur, t0 + W) * 16000)]
            if np.max(np.abs(seg)) < 1e-4:
                t0 += HOP_S
                continue
            with torch.inference_mode():
                r = asr_p({"raw": seg, "sampling_rate": 16000}, return_timestamps=True)
            lo = 0.0 if t0 == 0 else 2.0
            hi = W if t0 + W >= dur else W - 2.0
            for c in r.get("chunks", []):
                ts = c.get("timestamp") or (None, None)
                if ts[0] is None or not (lo <= ts[0] < hi):
                    continue
                t1 = ts[1] if ts[1] is not None else ts[0] + 2.0
                # phrase-level timestamps: spread the phrase's words evenly over it (word timestamps
                # cost ~10 GB through the cross-attention DTW)
                ws = c["text"].split()
                for k, w in enumerate(ws):
                    words.append(dict(t=round(meta["start_s"] + t0 + ts[0] + (t1 - ts[0]) * k / max(1, len(ws)), 2),
                                      w=w, phrase_start=round(meta["start_s"] + t0 + ts[0], 2),
                                      phrase_end=round(meta["start_s"] + t0 + t1, 2)))
            texts.append(r.get("text", ""))
            t0 += HOP_S
        outp.write_text(json.dumps(dict(meta, text=" | ".join(texts), words=words), indent=0))
        print("asr", p.stem, len(words), "words", flush=True)


if __name__ == "__main__":
    if sys.argv[1] == "prep":
        prep(sys.argv[2])
    else:
        asr(sys.argv[2])
