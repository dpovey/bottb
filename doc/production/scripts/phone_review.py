"""Phone review package for a song render: contact sheet (one mid-cut frame per V1 cut, labelled timecode/cut/angle/RiP,
two JPG pages) + a 640x360 MP4 with a burned-in record timecode, sized for SendUserFile (30 MiB cap; ~26 MiB for 258 s).
Homebrew ffmpeg here has no drawtext, so the timecode is PIL-drawn once per second and overlaid as a 1 fps image sequence.
Run with the gigstills venv (PIL, numpy):
  gigstills/.venv/bin/python phone_review.py <render.mp4> <cut_list.json> <IN> <OUT> <outdir>
The render must cover record IN..OUT with frame 0 = IN. Proven on NOK 2026-10-05/06 (twice)."""
import json, subprocess, sys, os
from PIL import Image, ImageDraw, ImageFont

RENDER, CUTS, IN, OUT_F, OUT = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
os.makedirs(OUT, exist_ok=True)

def tc(f):
    f = int(f); return "%02d:%02d:%02d:%02d" % (f // 90000, f // 1500 % 60, f // 25 % 60, f % 25)

items = [x for x in json.load(open(CUTS))["items"] if x["record_out"] > IN and x["record_in"] <= OUT_F]
W, H, COLS = 480, 270, 3
font = ImageFont.load_default(size=22)
thumbs = []
for x in items:
    a, b = max(x["record_in"], IN), min(x["record_out"] - 1, OUT_F)
    mid = (a + b) // 2
    t = (mid - IN) / 25
    fn = f"{OUT}/f_{x['index']}.jpg"
    subprocess.run(["ffmpeg", "-nostats", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-i", RENDER, "-frames:v", "1",
                    "-vf", f"scale={W}:{H}", fn], check=True)
    im = Image.open(fn).convert("RGB")
    canvas = Image.new("RGB", (W, H + 34), (20, 20, 20)); canvas.paste(im, (0, 0))
    d = ImageDraw.Draw(canvas)
    d.text((8, H + 5), f"{tc(a)}  cut {x['index']}  {x['angle']}{' RiP' if x['media_type'] == 'Video' else ''}", fill=(235, 235, 235), font=font)
    thumbs.append(canvas)
rows = (len(thumbs) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * W + (COLS + 1) * 6, rows * (H + 34) + (rows + 1) * 6), (0, 0, 0))
for i, t in enumerate(thumbs):
    sheet.paste(t, (6 + (i % COLS) * (W + 6), 6 + (i // COLS) * (H + 40)))
# split into two pages so a phone can zoom comfortably
half = (rows + 1) // 2
h1 = 6 + half * (H + 40)
sheet.crop((0, 0, sheet.width, h1)).save(f"{OUT}/contact_1.jpg", quality=85)
sheet.crop((0, h1, sheet.width, sheet.height)).save(f"{OUT}/contact_2.jpg", quality=85)
print(len(items), "cuts;", rows, "rows")

# small review MP4 with a burned-in record timecode, one label per second (ffmpeg here has no drawtext)
os.makedirs(f"{OUT}/tc", exist_ok=True)
nsec = (OUT_F - IN + 1 + 24) // 25
f2 = ImageFont.load_default(size=30)
for k in range(nsec + 1):
    im = Image.new("RGBA", (260, 48), (0, 0, 0, 160)); ImageDraw.Draw(im).text((10, 7), tc(IN + 25 * k), fill=(255, 255, 255, 255), font=f2)
    im.save(f"{OUT}/tc/tc_{k:04d}.png")
subprocess.run(["ffmpeg", "-nostats", "-loglevel", "error", "-y", "-i", RENDER, "-framerate", "1", "-i", f"{OUT}/tc/tc_%04d.png",
                "-filter_complex", "[0:v]scale=640:360[v];[v][1:v]overlay=16:16:shortest=1[o]", "-map", "[o]", "-map", "0:a",
                "-c:v", "libx264", "-preset", "veryfast", "-b:v", "780k", "-maxrate", "950k", "-bufsize", "1600k",
                "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", f"{OUT}/review_phone.mp4"], check=True)
print("mp4", os.path.getsize(f"{OUT}/review_phone.mp4"))
