# Reels schedule

Purpose: mix, slots, link rules, copy and covers for 9:16 reels recut from released songs, Sydney and Brisbane 2026. Findings: `notes/findings.md`.

Reels: `~/src/personal/gigstills/runs/sydney26_reels/report/`, listed in `data/reels.json` with which are final. The BOTTB logo is burned in, so do not run the runbook's branding step.

Rerun, repo root unless noted:

1. `node doc/production/scripts/collect-social-metrics.mjs` (dry first), then `node doc/production/reels-schedule/scripts/export_history.mjs`.
2. Save new scrapes as `data/meta_video_90d_<date>.psv` (Business Suite, Insights, Content, Last 90 days; `kind` is hand-labelled from duration) and `data/tiktok_studio_<date>.psv` (Studio content list). Read Instagram and Facebook Active times in the composer's Schedule panel without saving. Times are the browser zone; check `date`.
3. From this directory: `python3 scripts/analyse_slots.py data/history_<date>.json`, `python3 scripts/slot_tests.py`, `zsh scripts/seam_and_frames.sh <key> <file>` per reel (uses the gigstills venv for NumPy), `python3 scripts/mix.py` (seeded shuffle from `data/reels.json`; list booked keys under `booked`), `python3 scripts/build_page.py` (words in `scripts/page_content.py`). Link evidence, repo root: `node doc/production/reels-schedule/scripts/fb_captions.mjs`, `node doc/production/reels-schedule/scripts/export_links.mjs`; then here `python3 scripts/fb_link_test.py`, `python3 scripts/link_power.py`. Don't use the ledger's captions as evidence of no link: most are blank. The scrapes hold video rows only.

Measurement: `scripts/yt_daily_views.mjs` appends every upload's views to `data/yt_daily_views.csv` daily (launch agent `~/Library/LaunchAgents/com.deapovey.bottb-yt-daily-views.plist`, log `~/Library/Logs/bottb-yt-daily-views.log`). Remove the agent when the rollout's measurement ends. Tracked links are `/go/<video>/<placement>` on the site (PR 230), counted in PostHog as `reel:link_clicked`, filter `is_production`.

Credentials: `.env.local` in the repo root (Meta, Postgres). Business Suite and TikTok use the T3 "Dean (personal)" browser profile. YouTube was signed out there on 7 Nov.

Proposal page: https://claude.ai/artifact/PSENqnh4VioWTD4Q85FhsB (source `report/reels-proposal.html`).

Dean approved slots, link rules and the LinkedIn test on 7 Nov, and chose to stage without waiting for a loop check. Covers, facts and captions are set per reel on the page and stored in its `db` at `reviews/<key>` (read with `ArtifactData`, collection `reviews`); `confirmed: true` with `final` is his go for that reel, exactly as written.

Status 7 Nov: 11 reels final in `data/reels.json`, Covered in Chrome (v8) still awaiting Dean; Bring Me to Life not released.

Files by platform: YouTube gets a 2160x3840 render (Dean, 7 Nov), requested from the cutting session; every other platform gets the 1080x1920 finals in `data/reels.json`. Approved wording fixes: `scripts/apply_fixes_2026-11-07.py`. Chosen covers: `report/covers/`.

Follow-ups: Dean's approval, then schedule, ledger and copy docs; run the LinkedIn link test (design on the page, arms in `data/mix_*.json`) with baselines before the first post; add collaborators after publish if the Reels composer has no option; check the loop on the first post; read LinkedIn metrics and YouTube traffic sources once signed in.

## Attaching video without a drag

The T3 preview browser's `upload` action takes a local path, up to 50 MB per transfer, with no public upload and no fetch for a site's CSP to block. For a larger reel: `split -b 45m` it, add a hidden `<input type=file id=bottb-part>` whose change handler pushes `files[0]` to `window.__parts`, `upload` each piece in order, then `new File(parts, name, {type:'video/mp4'})`, put it in a `DataTransfer`, set the site's input's `.files` and dispatch `change` (bubbles). The rebuilt file's SHA-256 matched the original on 7 Nov. If the site creates its input only on click, hook `HTMLInputElement.prototype.click` first to capture it without opening a native picker. Site steps are in `social/tiktok.md`, `linkedin.md` and `facebook-instagram.md`. Attaching publishes nothing.
