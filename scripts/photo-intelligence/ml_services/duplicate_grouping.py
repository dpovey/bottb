"""
Near-duplicate grouping that lets capture time and pixels reinforce each other.

Photographers often deliver the same frame several times (colour, B&W, other
grades, other crops) alongside burst frames a fraction of a second apart. No
single signal handles all of that:

- Capture time (EXIF DateTimeOriginal + SubSecTimeOriginal + camera model)
  survives Lightroom exports and is identical for every edit of one frame,
  however it was cropped or graded. It says nothing when EXIF was stripped.
- Perceptual hashes (pHash/dHash) see through regrades but not re-crops, and
  two different shots under the same lighting can land within 10 bits.
- Feature matching (ORB keypoints + a RANSAC similarity fit) sees through
  crops and grades, and also links burst frames whose background didn't move.

Each pair is linked only when time and pixels agree, or (with no usable time)
when both pixel signals agree. Disagreements are reported, not merged.
Measured on Eddy Hill's Sydney 2026 delivery (205 photos, 158 frames): the
old rule (pHash<=10 OR dHash<=10, greedy) missed every re-cropped variant and
merged two different singers; this rule gets both right.
"""

from dataclasses import dataclass, field
from itertools import combinations
from typing import Dict, List, Optional, Tuple

import imagehash
import numpy as np
from PIL import Image, ImageOps

# Frames from one camera this close together are one burst.
BURST_SECONDS = 2.0
# pHash distance for the same frame under a different grade (measured p50 6, max 14 uncropped).
VARIANT_PHASH = 14
# pHash distance for neighbouring burst frames (61/62 at 0.5 s measured 16).
BURST_PHASH = 16
# Without time evidence both pixel signals must agree, so the hash bar can be strict.
NO_TIME_PHASH = 10
# Pairs further apart than this on every hash are not worth feature-matching.
CANDIDATE_PHASH = 22
# RANSAC inliers. Measured on Sydney 2026: every same-frame pair >= 285 (re-crops included),
# look-alike shots seconds-to-minutes apart <= 36, random unrelated pairs <= 9.
GEO_SAME_IMAGE = 100
# Burst neighbours share a background but the subject moves (61/62 measured 32).
GEO_BURST = 25

# Saturation below which a photo counts as B&W.
MONO_SATURATION = 0.1
ANALYSIS_SIZE = 1024


@dataclass
class PhotoSignals:
    filename: str
    path: str
    width: int
    height: int
    camera: Optional[str]
    captured: Optional[str]  # "YYYY:MM:DD HH:MM:SS.ss" as written by the camera
    seconds: Optional[float]  # captured as seconds, for burst gaps
    saturation: float
    phash: imagehash.ImageHash
    dhash: imagehash.ImageHash
    _gray: Optional[np.ndarray] = field(default=None, repr=False)

    @property
    def frame_key(self) -> Optional[str]:
        if not (self.camera and self.captured):
            return None
        return f"{self.camera}|{self.captured}"

    @property
    def is_mono(self) -> bool:
        return self.saturation < MONO_SATURATION


def _capture_time(img: Image.Image) -> Tuple[Optional[str], Optional[str], Optional[float]]:
    exif = img.getexif()
    camera = exif.get(272)
    sub_ifd = exif.get_ifd(0x8769)
    taken = sub_ifd.get(36867)
    if not taken:
        return camera, None, None
    subsec = str(sub_ifd.get(37521) or "0").strip("\x00 ") or "0"
    captured = f"{taken}.{subsec}"
    try:
        date, clock = taken.split(" ")
        y, mo, d = (int(x) for x in date.split(":"))
        h, mi, s = (int(x) for x in clock.split(":"))
        # Day count is only used for differences, so a crude calendar is fine.
        seconds = ((y * 372 + mo * 31 + d) * 86400) + h * 3600 + mi * 60 + s + float(f"0.{subsec}")
    except ValueError:
        seconds = None
    return camera, captured, seconds


def load_signals(image_path: str) -> PhotoSignals:
    """Read capture time, colour and hashes for one photo (decodes at ~1024 px)."""
    import os

    with Image.open(image_path) as img:
        width, height = img.size
        camera, captured, seconds = _capture_time(img)
        img.draft("RGB", (ANALYSIS_SIZE, ANALYSIS_SIZE))
        rgb = ImageOps.exif_transpose(img).convert("RGB")
    rgb.thumbnail((ANALYSIS_SIZE, ANALYSIS_SIZE))
    hsv = np.asarray(rgb.convert("HSV"), dtype=np.float32)
    return PhotoSignals(
        filename=os.path.basename(image_path),
        path=image_path,
        width=width,
        height=height,
        camera=camera.strip("\x00 ") if isinstance(camera, str) else None,
        captured=captured,
        seconds=seconds,
        saturation=float(hsv[..., 1].mean() / 255),
        phash=imagehash.phash(rgb),
        dhash=imagehash.dhash(rgb),
        _gray=np.asarray(rgb.convert("L")),
    )


def _geometric_inliers(a: PhotoSignals, b: PhotoSignals, cache: Dict[str, tuple]) -> int:
    """ORB matches that agree on one scale+shift between the two photos."""
    import cv2

    def features(p: PhotoSignals):
        if p.filename not in cache:
            # CLAHE flattens grading differences (B&W vs colour, crushed vs lifted).
            gray = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(p._gray)
            cache[p.filename] = cv2.ORB_create(nfeatures=2000).detectAndCompute(gray, None)
        return cache[p.filename]

    ka, da = features(a)
    kb, db = features(b)
    if da is None or db is None or len(ka) < 8 or len(kb) < 8:
        return 0
    pairs = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da, db, k=2)
    good = [m for m, n in (p for p in pairs if len(p) == 2) if m.distance < 0.75 * n.distance]
    if len(good) < 8:
        return 0
    src = np.float32([ka[m.queryIdx].pt for m in good])
    dst = np.float32([kb[m.trainIdx].pt for m in good])
    _, mask = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4.0)
    return int(mask.sum()) if mask is not None else 0


@dataclass
class PairEvidence:
    a: str
    b: str
    time: str  # "same_frame" | "burst" | "apart" | "unknown"
    gap_seconds: Optional[float]
    phash: int
    dhash: int
    inliers: Optional[int]
    link: Optional[str]  # "variant" | "similar" | None
    note: Optional[str] = None


def _judge(a: PhotoSignals, b: PhotoSignals, cache: Dict[str, tuple]) -> Optional[PairEvidence]:
    ph, dh = int(a.phash - b.phash), int(a.dhash - b.dhash)
    same_camera = a.camera is not None and a.camera == b.camera
    gap = abs(a.seconds - b.seconds) if (same_camera and a.seconds is not None and b.seconds is not None) else None

    if a.frame_key and a.frame_key == b.frame_key:
        time = "same_frame"
    elif gap is not None and gap <= BURST_SECONDS:
        time = "burst"
    elif gap is not None:
        time = "apart"
    else:
        time = "unknown"

    # Cheap reject: nothing in time or hashes suggests a relationship.
    if time in ("apart", "unknown") and min(ph, dh) > CANDIDATE_PHASH:
        return None

    inliers = _geometric_inliers(a, b, cache)
    geo = inliers >= GEO_SAME_IMAGE
    ev = PairEvidence(a.filename, b.filename, time, None if gap is None else round(gap, 2), ph, dh, inliers, None)

    if time == "same_frame":
        if ph <= VARIANT_PHASH or geo:
            ev.link = "variant"
        else:
            ev.note = "same capture time but pixels disagree (two cameras with one clock?)"
    elif time == "burst":
        if ph <= BURST_PHASH or inliers >= GEO_BURST:
            ev.link = "similar"
    elif time == "unknown":
        if ph <= NO_TIME_PHASH and geo:
            ev.link = "similar"
        elif ph <= NO_TIME_PHASH or geo:
            ev.note = "one pixel signal matches, the other does not"
    elif geo or ph <= NO_TIME_PHASH:
        # Same camera, well apart in time, yet looks alike: a re-framed moment, not a duplicate.
        ev.note = f"looks alike but {gap:.0f} s apart"
    return ev


def pick_representative(members: List[PhotoSignals]) -> PhotoSignals:
    """Colour before B&W, then the widest crop, then the earliest filename."""
    return sorted(members, key=lambda p: (p.is_mono, -(p.width * p.height), p.filename))[0]


def group_near_duplicates(photos: List[PhotoSignals]) -> Tuple[List[dict], List[PairEvidence]]:
    """
    Link photos pairwise, then take connected components (single linkage, so a
    burst A-B-C groups even when A and C alone wouldn't).

    Returns (clusters, review) where each cluster is
    {photo_filenames, representative_photo, kind, frames} and review lists the
    pairs whose signals disagreed.
    """
    parent = {p.filename: p.filename for p in photos}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    cache: Dict[str, tuple] = {}
    links: List[PairEvidence] = []
    review: List[PairEvidence] = []
    for a, b in combinations(photos, 2):
        ev = _judge(a, b, cache)
        if ev is None:
            continue
        if ev.link:
            links.append(ev)
            parent[find(a.filename)] = find(b.filename)
        elif ev.note:
            review.append(ev)

    by_name = {p.filename: p for p in photos}
    components: Dict[str, List[PhotoSignals]] = {}
    for p in photos:
        components.setdefault(find(p.filename), []).append(p)

    clusters = []
    for members in components.values():
        if len(members) < 2:
            continue
        names = sorted(m.filename for m in members)
        member_set = set(names)
        kinds = {ev.link for ev in links if ev.a in member_set}
        frames = len({m.frame_key or m.filename for m in members})
        clusters.append({
            "photo_filenames": names,
            "representative_photo": pick_representative(members).filename,
            "kind": "variant" if kinds == {"variant"} else "similar",
            "frames": frames,
        })
    clusters.sort(key=lambda c: min(by_name[n].seconds or 0 for n in c["photo_filenames"]))
    return clusters, review
