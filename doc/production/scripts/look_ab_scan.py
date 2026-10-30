#!/usr/bin/env python3
"""Per-cut A/B of two renders of the same range (e.g. look v1 vs a new look), ranked by warm shift.

Usage (gigstills venv has numpy + Pillow):
  ~/src/personal/gigstills/.venv/bin/python -I look_ab_scan.py <A.mp4> <B.mp4> <cut_list.json> <first_record_frame> \
      <out_dir> [--top N] [--workers N]

Both renders must start at <first_record_frame> (frame 0 = that record frame). For each V1 cut it decodes frames at 25/50/75 %
of the cut from both files (480x270 for numbers), converts to CIE Lab (sRGB curve as an approximation of Rec.709 G2.4) and
reports, B against A:
  green_dh  mean Lab hue change (deg) on pixels that are green in A (hue 100-180, chroma > 20); negative = toward yellow
  neut_db   mean b* change on bright near-neutrals in A (L > 55, chroma < 10): smoke, spots, screens; positive = warmer
  (no luma ratio: 8-bit p25 on dark frames is 0-3 codes and gave nonsense ratios; use gigstills ab_levels for levels)
Proven 2026-10-30: v1 against itself reads 0.0 on every metric for all 99 cuts (46 s, 5 workers).
  skin_dh   mean hue change on skin-ish pixels in A (hue 20-70, chroma 12-45, L 25-80)
  all_db    mean b* change on the whole frame
Writes <out_dir>/look_ab_scan.json and two sheets of full-res middle frames (A left, B right, record TC burnt in):
  sheet_green.jpg (worst green_dh) and sheet_neutral.jpg (worst neut_db).
"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageDraw

FPS = 25


def tc(f):
    return f"{f // 90000:02d}:{f // 1500 % 60:02d}:{f // 25 % 60:02d}:{f % 25:02d}"


def frame(path, n, w=480, h=270):
    cmd = ["ffmpeg", "-v", "error", "-threads", "2", "-ss", f"{n / FPS:.4f}", "-i", path, "-frames:v", "1",
           "-vf", f"scale={w}:{h}:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    if len(raw) != w * h * 3:
        raise RuntimeError(f"short decode {path} frame {n}: {len(raw)} bytes")
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def lab(rgb):
    c = rgb.astype(np.float64) / 255
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1]); b = 200 * (f[..., 1] - f[..., 2])
    return L, a, b, np.hypot(a, b), np.degrees(np.arctan2(b, a)) % 360


def dhue(h1, h0):
    return (h1 - h0 + 180) % 360 - 180


def measure(A, B):
    LA, aA, bA, CA, hA = lab(A); LB, aB, bB, CB, hB = lab(B)
    out = {}
    g = (hA > 100) & (hA < 180) & (CA > 20)
    out["green_frac"] = float(g.mean())
    out["green_dh"] = float(dhue(hB[g], hA[g]).mean()) if g.sum() > 200 else None
    n = (LA > 55) & (CA < 10)
    out["neut_frac"] = float(n.mean())
    out["neut_db"] = float((bB[n] - bA[n]).mean()) if n.sum() > 200 else None
    s = (hA > 20) & (hA < 70) & (CA > 12) & (CA < 45) & (LA > 25) & (LA < 80)
    out["skin_dh"] = float(dhue(hB[s], hA[s]).mean()) if s.sum() > 200 else None
    out["all_db"] = float((bB - bA).mean())
    return out


def avg(vals):
    v = [x for x in vals if x is not None]
    return round(float(np.mean(v)), 2) if v else None


def per_cut(args):
    pa, pb, it, first = args
    rin, rout = max(it["record_in"], first), it["record_out"]
    picks = [rin + int((rout - rin) * q) for q in (0.25, 0.5, 0.75)]
    ms = [measure(frame(pa, p - first), frame(pb, p - first)) for p in picks]
    r = {"cut": it["index"], "angle": it["angle"], "record_in": rin, "tc": tc(rin), "mid": picks[1], "mid_tc": tc(picks[1])}
    for k in ms[0]:
        r[k] = avg([m[k] for m in ms])
    return r


def sheet(rows, pa, pb, first, path, title):
    W, H = 960, 540
    img = Image.new("RGB", (2 * W, H * len(rows) + 40), (20, 20, 20))
    d = ImageDraw.Draw(img); d.text((10, 12), title, fill=(255, 255, 255))
    for i, r in enumerate(rows):
        for j, p in enumerate((pa, pb)):
            im = Image.fromarray(frame(p, r["mid"] - first, W, H).copy())
            img.paste(im, (j * W, 40 + i * H))
        lab_ = (f"cut {r['cut']} {r['mid_tc']} {r['angle']}  green {r['green_dh']} deg  neutral b* {r['neut_db']}"
                f"  skin {r['skin_dh']} deg")
        d.rectangle((0, 40 + i * H, 2 * W, 40 + i * H + 22), fill=(0, 0, 0))
        d.text((8, 44 + i * H), lab_, fill=(255, 255, 0))
        d.text((W - 60, 44 + i * H), "A", fill=(255, 255, 255)); d.text((2 * W - 60, 44 + i * H), "B", fill=(255, 255, 255))
    img.save(path, quality=88)


def main():
    a = sys.argv[1:]
    top = int(a[a.index("--top") + 1]) if "--top" in a else 8
    workers = int(a[a.index("--workers") + 1]) if "--workers" in a else 6
    pa, pb, cl, first, out = a[0], a[1], a[2], int(a[3]), a[4]
    os.makedirs(out, exist_ok=True)
    items = [i for i in json.load(open(cl))["items"] if i["track"] == "V1" and i["record_out"] > first]
    with ThreadPoolExecutor(workers) as ex:
        rows = list(ex.map(per_cut, [(pa, pb, it, first) for it in items]))
    json.dump({"A": pa, "B": pb, "first": first, "cuts": rows}, open(os.path.join(out, "look_ab_scan.json"), "w"), indent=1)
    green = sorted([r for r in rows if r["green_dh"] is not None and r["green_frac"] > 0.05], key=lambda r: r["green_dh"])
    neut = sorted([r for r in rows if r["neut_db"] is not None and r["neut_frac"] > 0.03], key=lambda r: -r["neut_db"])
    print("cut  tc           angle          green_dh(frac)  neut_db(frac)  skin_dh  all_db")
    for r in rows:
        print(f"{r['cut']:3d}  {r['tc']}  {r['angle'][:13]:13s}  {r['green_dh']!s:>6} ({r['green_frac']:.2f})"
              f"  {r['neut_db']!s:>6} ({r['neut_frac']:.2f})  {r['skin_dh']!s:>6}  {r['all_db']:>5}")
    sheet(green[:top], pa, pb, first, os.path.join(out, "sheet_green.jpg"), f"Worst green hue shift. A={os.path.basename(pa)}  B={os.path.basename(pb)}")
    sheet(neut[:top], pa, pb, first, os.path.join(out, "sheet_neutral.jpg"), f"Warmest near-neutrals. A={os.path.basename(pa)}  B={os.path.basename(pb)}")
    print("green worst:", [(r["cut"], r["mid_tc"], r["green_dh"]) for r in green[:top]])
    print("neutral worst:", [(r["cut"], r["mid_tc"], r["neut_db"]) for r in neut[:top]])


if __name__ == "__main__":
    main()
