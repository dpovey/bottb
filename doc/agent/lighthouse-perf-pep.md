# PEP: Hero & Page Performance — Lighthouse 95+ and a better load experience

> **Status:** Proposed
> **Owner:** TBD
> **Created:** 2026-05-18
> **Source:** Lighthouse desktop audit of the homepage on the `bottb-ekh7nb5dm` preview deployment (Lighthouse 12.6.1, 2026-05-18).
> **Related code:** `src/components/hero-carousel.tsx`, `src/components/ui/hero-background.tsx`, `src/components/ui/focal-point-image.tsx`, `src/lib/image-processor.ts`, `src/scripts/upload-event-image.ts`, `src/lib/photo-srcset.ts`.

## Purpose

Take the homepage (and by extension every page that uses our hero carousel) from a mediocre Lighthouse profile to a polished one — and along the way, give the page the kind of progressive load experience that hides the network rather than displaying it.

The audit told a coherent story:

- **Performance 72** — dragged down almost entirely by CLS = 0.969 and a 9.3 MB image payload, **not** by JS or compute (TBT was 60 ms, TTI 1.3 s).
- **Accessibility 96**, **Best Practices 96** — two tiny fixes each.
- **SEO 66** — entirely caused by Vercel's preview `x-robots-tag: noindex`. Production won't have this; we'll re-audit there to confirm.

The interesting structural finding: **two parallel image pipelines coexist**. Photos (in the `photos` table) get the full WebP variant treatment from `image-processor.ts`. Event hero images, uploaded via `upload-event-image.ts`, get stored as raw PNG/JPEG in `event.info.image_url` with no variants. The 5.3 MB Melbourne 2026 hero PNG is the visible cost of that fork.

## Goals (measurable)

| Metric                                | Current   | Target      |
| ------------------------------------- | --------- | ----------- |
| Performance score (homepage, desktop) | 72        | ≥ 95        |
| Performance score (homepage, mobile)  | unknown   | ≥ 90        |
| LCP                                   | 1.3 s     | ≤ 1.0 s     |
| CLS                                   | 0.969     | ≤ 0.05      |
| Total page weight                     | 9,259 KiB | ≤ 2,000 KiB |
| Image requests                        | 47        | ≤ 25        |
| Accessibility                         | 96        | 100         |
| Best Practices                        | 96        | 100         |
| SEO (production)                      | TBD       | ≥ 95        |

These targets are deliberately tight. CLS and image weight have so much headroom that getting most of the way there is mostly about doing the obvious thing well.

## Non-goals

- **Replacing `next/image`** — the codebase deliberately uses raw `<img>` in hero contexts to control srcset and animation. Don't get drawn into a "switch everything to `next/image`" digression.
- **Building a homegrown LQIP encoder.** If we want blur placeholders, use the BlurHash we likely already produce in the image-processor (or Sharp's `metadata.dominantColor`). Don't reinvent.
- **Production CDN choice / cache policy overhaul.** Out of scope unless we discover Vercel blob caching is the actual culprit — currently we can fix this with a header change.

## What the Lighthouse audit actually found

### LCP (1.3 s, score 0.87)

LCP element is the homepage hero `<img>`. The phase breakdown is telling:

| Phase          | Time       | % of LCP |
| -------------- | ---------- | -------- |
| TTFB           | 185 ms     | 14%      |
| **Load Delay** | **886 ms** | **69%**  |
| Load Time      | 116 ms     | 9%       |
| Render Delay   | 99 ms      | 8%       |

Load Delay dominates because the LCP image was rendered with `loading="lazy" fetchpriority="auto"`. Combined with the `lcp-lazy-loaded` audit failing, this is the smoking gun: **the homepage hero is being treated as below-the-fold by the browser**.

The HeroCarousel already plumbs `loading={isCurrent ? 'eager' : 'lazy'}` and `fetchPriority={isCurrent ? 'high' : 'auto'}`. So one of two things is happening:

1. The "current" image at the time of LCP is _not_ the one Lighthouse captured (after the 8 s interval rotates). Lighthouse sees the LCP element as whatever painted largest, which may be a still-lazy non-current image painting late.
2. Or: during SSR, `currentIndex` isn't deterministic — `page.tsx:249` uses `Math.random()` to pick `heroInitialIndex` per request, marked with `eslint-disable react-hooks/purity`. The eager/lazy attributes hinge on this random number being preserved through hydration.

Either way, the fix is to **eagerly prefetch one specific image** before the carousel even tries to be smart about it.

### CLS = 0.969 (score 0.02)

One layout shift on `<main class="flex-1">`. Cause: the hero `<section>` has `relative flex items-end` but no `min-h-…` on the homepage carousel, so its height is determined by content. When the lazy hero image finally arrives, the section snaps to the image's intrinsic aspect and pushes everything below it down ~700 px. Score of 0.97 means _almost the entire viewport shifted_.

This is fixable in one line — give the hero section a reserved height that matches the image's intended display size, before the image lands.

### Image weight (9.3 MB across 47 requests)

| Source                                               | Size      |
| ---------------------------------------------------- | --------- |
| `events/melbourne-2026/hero-*.png` (a single PNG)    | 5,317 KiB |
| 7 photo `large.webp` files over-sized for their slot | 1,455 KiB |
| Other images                                         | 2,573 KiB |
| Total                                                | 9,346 KiB |

The Melbourne 2026 PNG is the standout — it exists because event hero uploads bypass `image-processor.ts`. Every other hero in the system (Brisbane 2022–2025) sits in `photos` with `label='event_hero'` and gets proper WebP variants, but Melbourne 2026 was uploaded via `upload-event-image.ts`, which writes raw blob into `events.info.image_url`.

The other 1.5 MB is from `large.webp` (2000 px) being served into slots where `medium.webp` (1200 px) or smaller would do. The `sizes` attribute on `FocalPointImage` is `(max-width: 1920px) 100vw, 1920px` — too generous; the browser picks the highest-resolution match for those breakpoints even on a 1350 px desktop.

### Accessibility (96 → 100)

Two failures:

- `image-redundant-alt`: the YouTube highlight thumbnail's `alt="Battle of the Tech Bands - Sydney 2025 - Highlights"` duplicates the visible caption. Set `alt=""` on it.
- `target-size`: the photo carousel pagination indicators are 16 × 21 px buttons (`aria-label="Photo 5 of 1371"`). Need ≥ 24 × 24 px hit area (the visual dot can stay small; pad the button).

### Best Practices (96 → 100)

`errors-in-console`: every entry is `_next/static/chunks/…?dpl=dpl_GE…` returning 401. This is Lighthouse running against a Vercel preview — the `x-vercel-protection-bypass` token wasn't forwarded to subresource fetches. **Won't reproduce in production.** Re-audit on prod to confirm.

### SEO (66 → 95+)

Single failure: `is-crawlable` because Vercel preview returns `x-robots-tag: noindex`. Production deployments don't carry this header. **Re-audit on production.**

## Strategy

Four threads. Each ships independently; the order is intentional so each thread compounds on the previous one.

### Thread 1 — Stop the hero from causing CLS and LCP misses

Smallest patch, biggest perf win.

1. **Reserve hero height up front.** Give the homepage hero `<section>` an `aspect-ratio` (e.g. `aspect-[16/9]` on mobile, `aspect-[21/9]` on desktop) or an explicit `min-h-[60vh] md:min-h-[80vh]`. Match the dimensions Lighthouse measured for the LCP element (1350 × 900 desktop, viewport-width × ~60vh mobile). CLS goal: ≤ 0.05.

2. **Make the first hero image truly eager.**
   - Stop randomising `heroInitialIndex` on the server. Either:
     - Always start at index 0 and let the existing client-side `useEffect` randomise once hydrated, or
     - Use a stable per-request hash (e.g. the `Date.now() / 86400000 | 0`) so the SSR pick is the same as the client pick _and_ deterministic enough for caching.
   - On the chosen first image only, emit a `<link rel="preload" as="image" href="…/medium.webp" imagesrcset="…" imagesizes="…">` in the document `<head>`. This forces the browser's preload scanner to discover the LCP image during HTML parsing, eliminating the 886 ms Load Delay.
   - Drop `loading="lazy"` from the first image's `<img>` element. It should always be `loading="eager" fetchpriority="high"` and never depend on `isCurrent` for the _initial_ render.

3. **Width/height on every hero img.** Even though we use `object-cover`, the intrinsic `width`/`height` attributes let the browser reserve the right aspect during layout. Read them off the photo's stored `width`/`height` columns (already populated by the image-processor).

**Exit:** CLS ≤ 0.05; LCP ≤ 1.0 s; `lcp-lazy-loaded` audit passes; `unsized-images` audit passes.

### Thread 2 — Unify event hero images onto the processed-photos pipeline

Right now event hero is special. It shouldn't be.

1. **Deprecate `event.info.image_url` as a primary source.** Keep it readable for backward compat, but make `getPhotosByLabel(EVENT_HERO, { eventId })` the canonical lookup everywhere (`event-card.tsx`, `event-page-client.tsx`, `results/[eventId]/page.tsx`).

2. **Provide an admin upload path that uses `image-processor.ts`.** Easiest: extend `bulk-upload-photos.ts` (or add `upload-event-hero.ts`) so an admin can upload a raw PNG/JPEG for an event and the script:
   - Processes via `processImage()` → WebP variants
   - Inserts into `photos` with `label = ['event_hero']`
   - Optionally updates `events.info.image_url` to the new `blob_url` for OG-image / JSON-LD backward compat (these consumers can also migrate later).

3. **Backfill Melbourne 2026.** Re-upload the existing PNG through the new path, label it `event_hero`, then null out `events.info.image_url` (or point it at the new blob URL). The current 5.3 MB PNG can be deleted from blob storage afterwards.

4. **Migration:** sweep blob storage for any orphaned raw event-hero uploads and delete them.

**Exit:** No PNG/JPEG event hero served bigger than its `medium.webp` (1200 px) variant. All event heroes findable via `getPhotosByLabel(EVENT_HERO, { eventId })`.

### Thread 3 — Right-size every hero img via better `sizes`

The cheapest 1.5 MB on the page comes from telling the browser more accurately what slot the image will fill.

1. **Per-context `sizes` audit.** Walk every callsite of `FocalPointImage` and the inline `<img>` in `HeroCarousel`, and replace the blanket `(max-width: 1920px) 100vw, 1920px` with a tight expression matching the actual slot. Slots we currently render:
   - Homepage hero: full viewport width up to ~1920 px (current sizes is fine)
   - Event card hero: ~400 px on mobile, 33vw on desktop
   - Band hero: 100vw mobile, 80vw desktop
   - Photographer hero: same as band hero
   - Sidebar/grid thumbnails: probably want `medium.webp` (1200 px) max

2. **Stop emitting `large_4k_url` in srcset unless the slot will ever render >2000 px.** The 4 K variant adds noise to srcset and the browser sometimes picks it speculatively.

3. **Consider AVIF.** Sharp can encode `.avif` cheaply; AVIF saves another 20–30% over WebP for photo content. Adding a fourth variant (`avif_url`) and a `<picture>` element in `FocalPointImage` is worth it if the cost is per-upload, not per-request. (Decision point: keep this in scope or defer? See "Open questions".)

**Exit:** `uses-responsive-images` and `modern-image-formats` audits both pass (or report savings < 50 KiB). Image transfer ≤ 1.5 MB on the homepage.

### Thread 4 — Progressive load polish

Once threads 1–3 land we have headroom to make the load _feel_ good, not just be fast.

1. **Dominant-colour or BlurHash placeholders.** Sharp can extract a dominant colour during processing (`metadata().stats`). Store as a hex string on the photo row. Render a `background-color` on the wrapper div before the image loads. Zero extra requests, instant first paint.

2. **`fetchpriority="low"` on below-the-fold hero crossfade siblings.** Tell the browser they're hints, not blockers.

3. **Optional: BlurHash thumbnails.** If we want the iOS-photos-app feel, encode a BlurHash during image processing (~30 chars per photo) and render an SVG/canvas placeholder. Adds ~5 ms to upload and zero bytes to runtime.

4. **DOM size reduction.** The audit flagged 1,000 elements. The Sydney 2025 photo grid is the likely culprit — if it's not virtualised, virtualise it with `react-window` or paginate above the fold.

5. **Cache TTL.** 15 resources fail `uses-long-cache-ttl`. Most are blob storage assets; `lib/blob.ts:uploadImage()` already sets `cacheControlMaxAge: 31536000` but verify the headers come through in production responses. If not, set `Cache-Control: public, max-age=31536000, immutable` on the bucket / Vercel asset route.

**Exit:** A user with a cold cache sees a colour swatch immediately, then a blurred preview, then the sharp image — never an empty white box and never a layout shift. Repeat visits hit the cache.

### Thread 5 — Mop up the rest of the audit failures

These don't move the perf numbers materially but they get us to 100 / 100 on the non-perf categories.

1. **Accessibility:**
   - YouTube highlight thumbnail: `alt=""` (it's decorative; the visible caption already names it).
   - Photo carousel pagination buttons: bump the touch target to `min-w-6 min-h-6` (24 px) with internal padding. Visual dot can stay 12 px.

2. **Best Practices:** Re-audit on production. The console-error noise is preview-only.

3. **SEO:** Re-audit on production. Verify `bottb.com` (or wherever) does _not_ send `x-robots-tag: noindex`. Confirm sitemap and robots.txt are sane.

## Wave plan

These are bounded so each can ship as its own PR with green CI:

| Wave   | Scope                                                                                                                              | Approx. impact                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **W1** | Reserve hero height, preload-link the first image, drop `Math.random()` SSR pick, intrinsic width/height on all hero `<img>`s      | Performance 72 → ~85, CLS 0.97 → ~0.02        |
| **W2** | New `upload-event-hero` path through image-processor, re-upload Melbourne 2026, switch consumers to `getPhotosByLabel(EVENT_HERO)` | Page weight 9.3 MB → ~4 MB                    |
| **W3** | `sizes` audit + tighten srcset, drop 4K variants from non-hero contexts, optional AVIF                                             | Page weight 4 MB → ~1.5 MB, Performance → ~95 |
| **W4** | Dominant-colour placeholder, virtualise photo grid, verify cache headers                                                           | Subjective UX polish; LCP score → 1.0         |
| **W5** | A11y `alt=""` + tap-target sweep                                                                                                   | Accessibility 96 → 100                        |
| **W6** | Re-audit production for SEO and Best Practices; fix anything that legitimately fails outside preview noise                         | Confirms ≥ 95 across all four categories      |

Don't sequence W1 and W2 in parallel — W1 changes how the hero image is served, and W2 changes _which_ image is served. Land W1 first so we can attribute W2's impact cleanly.

## Acceptance criteria

A PR closes this PEP when, on a fresh production Lighthouse run:

- Performance ≥ 95 (desktop), ≥ 90 (mobile)
- Accessibility = 100
- Best Practices = 100
- SEO ≥ 95
- CLS ≤ 0.05
- LCP ≤ 1.0 s
- No image asset > 200 KB on the homepage
- All four `is-crawlable`, `lcp-lazy-loaded`, `unsized-images`, `target-size` audits pass

## Open questions

1. **AVIF: in scope for W3 or its own follow-up?** AVIF encoding adds ~3× CPU vs WebP at upload time. If `bulk-upload-photos` runs locally on the admin's machine, that's free; if it ever moves to a server cron, it matters.
2. **Cache invalidation on blob storage:** the `large.webp` URL is content-addressed by photo UUID + variant name. If we re-process an existing image, do we need to bust caches? Audit whether anything reuses `large.webp` after a re-upload.
3. **OG image dependency on `event.info.image_url`:** `event-jsonld.tsx`, OpenGraph metadata, and the search index all read `image_url` directly. If we deprecate it, do those need backward-compat shims or a clean migration?
4. **Mobile performance baseline:** the audit was desktop only. Mobile is likely worse (smaller bandwidth, slower JS). Run a mobile audit _before_ W1 so we can track that number too.

## What I'd skip from a "boil the ocean" version

For clarity, things I deliberately did **not** include:

- Switching the whole site to `next/image`. The custom `<img>` is intentional and works.
- A new image CDN. Vercel Blob is fine if cache headers are right.
- Service worker / PWA. Not justified by audit findings.
- Critical CSS extraction. Render-blocking score is 50, which is "needs improvement" but not painful — Tailwind v4 emits a single small stylesheet already.

This PEP should ship in 5–6 PRs over a week or two. The hard work is W1 (precision) and W2 (data migration). Everything else is mechanical.
