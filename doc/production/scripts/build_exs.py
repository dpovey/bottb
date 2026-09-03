#!/usr/bin/env python3
"""Generate a multi-group round-robin Logic Sampler (.exs) instrument.

    build_exs.py --template T.exs --samples DIR --out OUT.exs
                 --prefix SnareA --groups 9 --root 38 [--name "Snare A RR9"]

Logic's Sampler UI builds a group at a time: drag three samples in, set three
velocity ranges, repeat. That is fine for two groups and tedious for nine, so this
clones an existing hand-built instrument instead - every field whose meaning is not
understood is copied verbatim from the template, and only the fields that must
change per zone are rewritten.

.exs is a flat chunk list. Each chunk is an 84-byte header (uint32 signature, body
size, id, flags; 'TBOS'; char[64] name) followed by its body. Signatures used here:
0x00000101 header, 0x01000101 zone, 0x02000101 group, 0x03000101 sample,
0x04000101 params, 0x0a000101 opaque.

Two cross-references drive the whole file, both by position, not by name:
  * zone body byte 88     = index of its group in the group chunk sequence
  * zone body bytes 92-95 = index of its sample in the sample chunk sequence

Samples are named "<prefix>-<class>-<NNN>-<suffix>.wav" and group N takes the
NNN = N sample of each velocity class, so the number of groups is capped by the
smallest class. Sample chunks store an absolute path: the instrument survives being
copied between projects, not between machines or a renamed volume.

The 0x0b bookmark chunks (macOS security-scoped file bookmarks) are deliberately
NOT emitted - they are a fallback for relocating moved samples, and Logic rewrites
them on its next save. If a generated instrument ever opens with a "locate sample"
prompt while the paths are valid, that assumption is where to look first.
"""
import argparse, os, re, struct, sys

ZONE, GROUP, SAMPLE, HEADER, PARAMS, OPAQUE = (
    0x01000101, 0x02000101, 0x03000101, 0x00000101, 0x04000101, 0x0a000101)
VEL_CLASSES = [("Soft", 0, 42), ("Med", 43, 85), ("Hard", 86, 127)]


def read_chunks(path):
    d = open(path, "rb").read()
    out, off = [], 0
    while off + 84 <= len(d):
        sig, size, cid, flags = struct.unpack_from("<IIII", d, off)
        if d[off + 16:off + 20] != b"TBOS":
            raise SystemExit(f"{path}: not an .exs chunk stream at offset {off}")
        name = d[off + 20:off + 84].split(b"\x00")[0].decode("latin1")
        out.append((sig, flags, name, bytearray(d[off + 84:off + 84 + size])))
        off += 84 + size
    return out


def emit(sig, flags, name, body):
    return (struct.pack("<IIII", sig, len(body), 0, flags) + b"TBOS"
            + name.encode("latin1")[:63].ljust(64, b"\x00") + bytes(body))


def put(b, o, n, v):
    b[o:o + n] = int(v).to_bytes(n, "little")


def wav_info(path):
    """Data-chunk offset, frame count, rate, depth and file size, as .exs stores them."""
    d = open(path, "rb").read(4096)
    if d[:4] != b"RIFF" or d[8:12] != b"WAVE":
        raise SystemExit(f"{path}: not a RIFF/WAVE file")
    off, fmt = 12, None
    while off + 8 <= len(d):
        cid, csz = d[off:off + 4], struct.unpack_from("<I", d, off + 4)[0]
        if cid == b"fmt ":
            fmt = struct.unpack_from("<HHIIHH", d, off + 8)
        elif cid == b"data":
            if fmt is None:
                raise SystemExit(f"{path}: data chunk precedes fmt")
            ch, sr, bits = fmt[1], fmt[2], fmt[5]
            return dict(datoff=off + 8, frames=csz // (ch * bits // 8),
                        sr=sr, bits=bits, size=os.path.getsize(path))
        off += 8 + csz + (csz & 1)
    raise SystemExit(f"{path}: no data chunk in the first 4 kB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", required=True, help="hand-built .exs to clone structure from")
    ap.add_argument("--samples", required=True, help="directory of numbered one-shots")
    ap.add_argument("--out", required=True)
    ap.add_argument("--prefix", required=True, help="e.g. SnareA")
    ap.add_argument("--suffix", default="SnareBot")
    ap.add_argument("--groups", type=int, default=0, help="0 = as many as the samples allow")
    ap.add_argument("--root", type=int, default=38, help="root key AND single-note key range")
    ap.add_argument("--name", default=None)
    a = ap.parse_args()

    ch = read_chunks(a.template)
    def one(sig, pred=lambda c: True):
        for c in ch:
            if c[0] == sig and pred(c):
                return c
        raise SystemExit(f"template has no 0x{sig:08x} chunk")

    header = one(HEADER)
    gproto = one(GROUP)[3]
    sproto = one(SAMPLE)[3]
    # a zone prototype per velocity class where the template has one, else any zone
    zproto = {}
    for c in ch:
        if c[0] == ZONE:
            parts = c[2].split("-")
            if len(parts) > 1:
                zproto.setdefault(parts[1], c[3])
    zany = one(ZONE)[3]

    avail = {}
    for cls, _, _ in VEL_CLASSES:
        pat = re.compile(rf"^{re.escape(a.prefix)}-{cls}-(\d+)-{re.escape(a.suffix)}\.wav$")
        avail[cls] = sorted(int(m.group(1)) for m in
                            (pat.match(f) for f in os.listdir(a.samples)) if m)
        if not avail[cls]:
            raise SystemExit(f"no {cls} samples matching {a.prefix}-{cls}-NNN-{a.suffix}.wav")
    cap = min(len(v) for v in avail.values())
    n = a.groups or cap
    if n > cap:
        raise SystemExit(f"--groups {n} exceeds {cap} (only {cap} "
                         f"{min(avail, key=lambda k: len(avail[k]))} samples)")

    zones, groups, samples, si = [], [], [], 0
    for g in range(n):
        groups.append(emit(GROUP, 0x20000000, f"Group {g+1}", gproto))
        for cls, vlo, vhi in VEL_CLASSES:
            fn = f"{a.prefix}-{cls}-{avail[cls][g]:03d}-{a.suffix}.wav"
            info = wav_info(os.path.join(a.samples, fn))

            sb = bytearray(sproto)
            put(sb, 0, 4, info["datoff"]); put(sb, 4, 4, info["frames"])
            put(sb, 8, 4, info["sr"]);     put(sb, 12, 4, info["bits"])
            put(sb, 32, 4, info["size"])
            sb[80:336] = a.samples.rstrip("/").encode("utf-8")[:255].ljust(256, b"\x00")
            sb[336:592] = fn.encode("utf-8")[:255].ljust(256, b"\x00")
            samples.append(emit(SAMPLE, 0x20020000, fn, sb))

            zb = bytearray(zproto.get(cls, zany))
            zb[1] = zb[6] = zb[7] = a.root      # root key == key range == trigger note
            zb[9], zb[10] = vlo, vhi
            put(zb, 16, 8, info["frames"]); put(zb, 24, 8, info["frames"])
            zb[88] = g; put(zb, 92, 4, si)
            zones.append(emit(ZONE, 0x00000000, fn[:-4], zb))
            si += 1

    hb = bytearray(header[3])
    put(hb, 4, 4, len(zones)); put(hb, 8, 4, n)
    put(hb, 12, 4, len(samples)); put(hb, 44, 4, len(samples))

    name = a.name or os.path.splitext(os.path.basename(a.out))[0]
    blob = emit(HEADER, header[1], name, hb) + b"".join(zones) + b"".join(groups) + b"".join(samples)
    for sig in (PARAMS, OPAQUE):
        c = one(sig)
        blob += emit(sig, c[1], c[2], c[3])
    open(a.out, "wb").write(blob)
    print(f"wrote {a.out}  ({len(blob)} bytes)", file=sys.stderr)
    print(f"{n} groups x {len(VEL_CLASSES)} velocity layers = {len(zones)} zones, "
          f"root key {a.root}", file=sys.stderr)


if __name__ == "__main__":
    main()
