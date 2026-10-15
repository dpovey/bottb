"""Grab camera frames at REF times (validation by looking).

Maps REF seconds -> timeline frame -> (clip, source frame) through gigstills'
`placements_plan.json`, then decodes one frame per camera with ffmpeg (fast seek), through the
C-Log3 view LUT for the Canon angles 1-4 (the drum cam, S-Log3, gets a plain contrast lift).

Usage: python -m songmap.frames OUT.jpg REF [REF ...] [--angles 1,3,4,5] [--labels "a|b"]
Writes one contact sheet: a row per REF, a column per angle.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from functools import lru_cache
from pathlib import Path

from . import config as C

ANGLE_DIR = {1: "STATIC DESKCAM", 2: "STAGE RIGHT CAM", 3: "SOUNDESK_TRACKED", 4: "PHOTOPIT_ROAMING", 5: "DRUM CAM"}
ANGLE_NAME = {1: "wide", 2: "stage R", 3: "tracking", 4: "pit", 5: "drum"}


@lru_cache(maxsize=1)
def _ops():
    return json.loads(Path(C.PLACEMENTS).read_text())["ops"]


def locate(angle: int, ref_s: float):
    """(clip name, source seconds) for this angle at REF, or None if the camera has no picture."""
    F = 90000 + (ref_s - C.REF_AT_TC0) * C.TC_FPS
    for o in _ops():
        if o["track"] != angle:
            continue
        n = o["endFrame"] - o["startFrame"]
        if o["recordFrame"] <= F < o["recordFrame"] + n:
            return o["name"], (o["startFrame"] + (F - o["recordFrame"])) / C.TC_FPS
    return None


def grab(angle: int, ref_s: float, out: Path, width: int = 640) -> bool:
    loc = locate(angle, ref_s)
    if loc is None:
        return False
    name, src = loc
    path = C.MEDIA / ANGLE_DIR[angle] / f"{name}.MP4"
    vf = f"scale={width}:-2:in_color_matrix=bt709:out_color_matrix=bt709"
    if angle != 5:
        vf += f",lut3d=file='{C.CLOG3_LUT}'"
    else:
        vf += ",eq=contrast=1.35:brightness=0.06:saturation=1.3"
    cmd = ["ffmpeg", "-v", "error", "-threads", "3", "-ss", f"{src:.3f}", "-i", str(path),
           "-frames:v", "1", "-vf", vf, "-q:v", "4", "-y", str(out)]
    return subprocess.run(cmd).returncode == 0 and out.exists()


def sheet(out: Path, refs, angles=(1, 3, 4, 5), labels=None, width=480):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.image import imread

    fig, axs = plt.subplots(len(refs), len(angles), figsize=(4 * len(angles), 2.5 * len(refs)), squeeze=False)
    with tempfile.TemporaryDirectory() as td:
        for r, ref in enumerate(refs):
            for c, ang in enumerate(angles):
                ax = axs[r][c]
                ax.axis("off")
                p = Path(td) / f"{r}_{ang}.jpg"
                if grab(ang, ref, p, width):
                    ax.imshow(imread(p))
                title = f"{ref:.1f} {C.ref_to_tc(ref)} {ANGLE_NAME[ang]}"
                if c == 0 and labels:
                    title = f"{labels[r]} | " + title
                ax.set_title(title, fontsize=7)
    plt.tight_layout()
    fig.savefig(out, dpi=80)
    plt.close(fig)


def strip(out: Path, refs, angle=1, crop=(0.37, 0.70), width=1600, labels=None):
    """Stack horizontal bands (fractions of frame height) of one angle at several REFs, titled."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.image import imread

    fig, axs = plt.subplots(len(refs), 1, figsize=(16, 3.4 * len(refs) * (crop[1] - crop[0]) / 0.33),
                            squeeze=False)
    with tempfile.TemporaryDirectory() as td:
        for r, ref in enumerate(refs):
            ax = axs[r][0]
            ax.axis("off")
            p = Path(td) / f"{r}.jpg"
            if grab(angle, ref, p, width):
                im = imread(p)
                h = im.shape[0]
                ax.imshow(im[int(crop[0] * h): int(crop[1] * h)])
            ax.set_title(f"{labels[r] + ' | ' if labels else ''}{ref:.1f}  {C.ref_to_tc(ref)}  {ANGLE_NAME[angle]}",
                         fontsize=10, loc="left")
    plt.tight_layout()
    fig.savefig(out, dpi=80)
    plt.close(fig)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("refs", nargs="+", type=float)
    ap.add_argument("--angles", default="1,3,4,5")
    ap.add_argument("--labels")
    ns = ap.parse_args()
    sheet(Path(ns.out), ns.refs, tuple(int(x) for x in ns.angles.split(",")),
          ns.labels.split("|") if ns.labels else None)
