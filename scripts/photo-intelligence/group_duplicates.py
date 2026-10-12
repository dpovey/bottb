#!/usr/bin/env python3
"""
Group near-duplicate photos (grading/crop variants and burst frames) without the full ML pipeline.

    python -I group_duplicates.py <photo_dir> <output_dir>

Needs only Pillow, imagehash, numpy and opencv-python. Writes:
- clusters.json  near_duplicates in the shape upload-intelligence.ts reads (scenes/people empty)
- review.json    pairs where time and pixels disagreed, for a human to look at

See ml_services/duplicate_grouping.py for how the signals combine.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ml_services.duplicate_grouping import group_near_duplicates, load_signals  # noqa: E402

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_dir")
    parser.add_argument("output_dir")
    parser.add_argument("--no-recursive", action="store_true")
    args = parser.parse_args()

    src = Path(args.input_dir)
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    paths = src.glob("*") if args.no_recursive else src.rglob("*")
    files = sorted(
        p for p in paths
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS and not p.name.startswith("._")
    )
    names = [p.name for p in files]
    dupes = {n for n in names if names.count(n) > 1}
    if dupes:
        sys.exit(f"Filenames must be unique (the upload matches on them): {sorted(dupes)[:5]}")

    print(f"Reading {len(files)} photos...")
    photos = [load_signals(str(p)) for p in files]
    no_time = [p.filename for p in photos if not p.frame_key]
    if no_time:
        print(f"  {len(no_time)} without capture time; grouped on pixels only")

    print("Grouping...")
    clusters, review = group_near_duplicates(photos)

    near_duplicates = [{"cluster_id": i, **c} for i, c in enumerate(clusters)]
    (out / "clusters.json").write_text(json.dumps(
        {"near_duplicates": near_duplicates, "scenes": [], "people": []}, indent=2))
    (out / "review.json").write_text(json.dumps([r.__dict__ for r in review], indent=2))

    grouped = sum(len(c["photo_filenames"]) for c in clusters)
    variants = sum(1 for c in clusters if c["kind"] == "variant")
    print(f"{len(photos)} photos -> {len(photos) - grouped + len(clusters)} gallery tiles")
    print(f"  {len(clusters)} groups ({variants} edits of one frame, {len(clusters) - variants} with burst frames)")
    print(f"  {len(review)} pairs for review -> {out / 'review.json'}")


if __name__ == "__main__":
    main()
