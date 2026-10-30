#!/usr/bin/env bash
# Record the V2 Voyagers "Starships / UFO" posts in the ledger. Run from the repo root.
# Usage: bash doc/production/v2-voyagers-starships-ufo/record-posts.sh [linkedin <activity-urn> <posted-at-iso>]
set -euo pipefail
export PATH="$HOME/Library/pnpm/bin:$PATH"
G=sydney-2026-v2-voyagers-starships-ufo
T='V2 Voyagers - Starships / UFO (Nicki Minaj & Sneaky Sound System Cover) - BotTB Sydney 2026'
C=(--group "$G" --event sydney-2026 --band v2-voyagers-sydney-2026 --content-type video --status published --title "$T" --apply --yes)

if [[ "${1:-}" == linkedin ]]; then
  pnpm -s bottb post record --platform linkedin --external-id "$2" \
    --permalink "https://www.linkedin.com/feed/update/$2/" --posted-at "$3" --posted-at-estimated \
    --posted-via browser --mentions 'V2 AI,Jumbo Interactive Limited,Youngcare' "${C[@]}"
  exit
fi

pnpm -s bottb post record --platform facebook --external-id 1395781299210374 \
  --permalink https://www.facebook.com/reel/1395781299210374 --posted-at 2026-10-30T05:44:51Z \
  --posted-via api --utm-content "$G-facebook" "${C[@]}"
pnpm -s bottb post record --platform instagram --external-id DfG3KB5D0du \
  --permalink https://www.instagram.com/reel/DfG3KB5D0du/ --posted-at 2026-10-30T05:46:38Z \
  --posted-via api --collaborators sailornicole,demonrace,youngcareoz "${C[@]}"
pnpm -s bottb post record --platform youtube --external-id 4UhnRsKcvKc \
  --permalink https://youtu.be/4UhnRsKcvKc --posted-at 2026-10-30T06:13:00Z --posted-at-estimated \
  --posted-via browser --utm-content "$G-youtube" "${C[@]}"
pnpm -s bottb post record --platform tiktok --external-id 7702340811786259732 \
  --permalink https://www.tiktok.com/@bottb0/video/7702340811786259732 --posted-at 2026-10-30T06:30:00Z \
  --posted-at-estimated --posted-via browser "${C[@]}"
