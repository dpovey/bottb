# Social history and metrics: what is actually recoverable

Read-only investigation, 8 September 2026. Every number below came from a live API call made
during this investigation, not from documentation. Nothing was written to any platform or to the
database.

The short version: **the platforms hold roughly 460 posts of BotTB history — far more than the
Brisbane 2026 sample — and, critically, the older posts went out at wildly varying times of day.
That variance is what makes "when should we post" answerable.** The blocker is not history, it is
metrics: the Meta token has no insights permissions, so reach and impressions are unavailable
until someone re-authorises the app.

---

## Part 1 — Verification spike

### 1.1 Meta token scopes: the answer is no

`META_PAGE_ACCESS_TOKEN` in `.env.local` is a **Page token** (never expires; data access expires
2026-08-18) for page `207312765803305`, issued by app `799387456271172`. `debug_token` returns
exactly these scopes:

```
pages_show_list
business_management
instagram_basic
instagram_content_publish
pages_read_engagement
pages_manage_posts
public_profile
```

**`read_insights` is absent. `instagram_manage_insights` is absent.** Confidence: certain.

Proved by calling, not by inference:

| Call | Result |
|---|---|
| `GET /2138258163708684/video_insights` | `403 (#200) read_insights permission missing` |
| `GET /18127126216753732/insights?metric=reach,likes,...` | `400 (#10) Application does not have permission for this action` |
| `GET /{page}/insights?metric=page_impressions` | `400 (#100) The value must be a valid insights metric` |

So **no reach, no impressions, no watch-time, no follows-from-post, no profile visits** — not for
Facebook, not for Instagram, not now and not retrospectively. Any collection design that assumes
insights is dead on arrival until the token is re-minted.

A second, quieter permission problem showed up while enumerating. Field-by-field bisection of
`/{page}/published_posts`:

| Field | Works? |
|---|---|
| `id, created_time, message, permalink_url` | yes |
| `status_type`, `is_published`, `full_picture`, `promotable_id` | yes |
| `attachments{media_type,type,title,url}` | yes |
| `shares` | yes |
| `likes.summary(true)` | **no** — "requires pages_read_engagement or Page Public Content Access" |
| `comments.summary(true)` | **no** — "requires pages_read_user_content or PPCA" |
| `reactions.summary(true)` | **no** — same |

`pages_read_engagement` *is* in the token's scope list, yet the API rejects the like summary. The
likely explanation is that the app has not passed App Review for that permission, so the granular
grant is inert outside a dev/admin context. This should be treated as a known unknown, not a bug in
the call. Likewise `/{page}/feed` is refused (it includes visitor posts, which need PPCA) whereas
`/{page}/published_posts` succeeds.

**What Facebook engagement *is* available without any new permission:**

- `shares.count` on posts (present on 37 of 177 posts — absent means zero shares).
- **`views` on the `/videos` edge** — this one is the find. `GET /{page}/videos?fields=views`
  returned a view count for **102 of 102 videos**, median 99, max 949. This is a genuine outcome
  variable, retrievable for the whole video history, with the current token. Confidence: certain.

**What Instagram engagement is available:** `like_count` and `comments_count` on
`/{ig-user}/media`, populated for **179 of 179** media. No plays, no reach, no saves.

### 1.2 Instagram media insights call — attempted, blocked

Shown above. The media list itself works fine; only `/insights` is refused.

### 1.3 Facebook video insights call — attempted, blocked

Shown above. Note the contrast: `/{video-id}?fields=views` returns `72` for the same video whose
`/video_insights` edge 403s. Meta treats the aggregate view count as a public-ish field and the
insights edge as privileged.

### 1.4 YouTube — works

`videos.list?part=statistics` with the existing `YOUTUBE_API_KEY` succeeds:

```
ybYOCrGhNVY  2026-08-31  {"viewCount":"966","likeCount":"8","favoriteCount":"0","commentCount":"1"}
wM7hSnZJn0A  2026-09-07  {"viewCount":"60","likeCount":"8","favoriteCount":"0","commentCount":"0"}
```

Channel: `UCJVbMoGFRdQxVgHvW1heYCg` (Battle of the Tech Bands), created 2025-09-15, 72 subscribers,
28,208 lifetime views, 77 videos. Confidence: certain.

### 1.5 Vercel plan tier: **Pro**

The Vercel CLI is not installed and there is no `VERCEL_TOKEN`, but `VERCEL_OIDC_TOKEN` in
`.env.local` is a JWT whose payload carries the answer directly:

```
iss         https://oidc.vercel.com/dean-poveys-projects
owner       dean-poveys-projects   owner_id  team_rRepDDAA5T4M6W2o7mTzsvfO
project     bottb                  project_id prj_9NRMqE8lmtfHqwDAbaIbYO8GISiZ
plan        pro
```

Caveat: that token was issued around 2025-12-17 and has expired, so the claim is a snapshot from
then, not from today. Plan downgrades are rare, so confidence is high but not certain. Confirm in
one step at vercel.com/dean-poveys-projects/~/settings/billing, or with `vercel project inspect`
once the CLI is installed.

**Consequence: sub-daily crons are allowed.** Pro permits cron schedules at any interval (Hobby is
daily-only, 2 jobs). `vercel.json` currently declares no crons at all — the "cron 5707ec44" entries
in the Brisbane 2026 schedule log were Claude Code session crons, not Vercel ones.

---

## Part 2 — How much history is recoverable

### 2.1 Facebook page (207312765803305)

**Enumerable: yes, in full, in two API calls.**

`GET /{page}/published_posts?fields=id,created_time,message,permalink_url,status_type,shares,is_published,attachments{media_type,type}&limit=100`
returned **177 posts** with cursor pagination, oldest **2024-01-25**, newest today.

```
2024: 16    2025: 92    2026: 69
status_type: added_photos 99, added_video 69, mobile_status_update 5, created_event 4
```

`GET /{page}/videos?fields=id,created_time,title,description,permalink_url,length,views` returned
**102 videos**, oldest 2024-06-06, all 102 carrying a `views` count. The videos edge overlaps the
posts edge but is worth collecting separately purely because it is the only source of view counts.

**How far back:** to 2024-01-25 and no further. An explicit probe with
`since=2019-01-01&until=2024-01-25` returned an empty array, so this is the page's real beginning,
not a pagination cap. **Brisbane 2022 and Brisbane 2023 have no Facebook footprint on this page.**
Whatever was posted for those events went somewhere else (a personal account, a different page) or
was never posted.

**Historical insights:** unavailable, and would be unavailable even with `read_insights` for
anything older than the platform's own retention. Post-level lifetime totals (`views`, `shares`)
are current snapshots, not time series — there is no way to recover "impressions in the first 24
hours" for a 2024 post retroactively from any endpoint.

**Cost:** 4 calls total for the full history. Negligible against the rate limit.
**Confidence:** certain for counts and date range; certain that insights are blocked.

### 2.2 Instagram (17841461862790198, @battleofthetechbands)

**Enumerable: yes, in full, in two API calls.**

`GET /{ig-user}/media?fields=id,timestamp,media_type,media_product_type,permalink,caption,like_count,comments_count&limit=100`
returned **179 media**, oldest **2023-08-24**, newest today.

```
2023: 1    2024: 26    2025: 91    2026: 61
media_product_type: FEED 92, REELS 87
```

The account reports `media_count: 186`, seven more than the edge returns. The gap is probably
media the API omits (some album children, or items posted before the account became a business
account). Worth a note, not worth chasing.

The single 2023 post is dated the day of Brisbane 2023 — so Instagram reaches one event further
back than Facebook, but with a sample of one.

**Fields per media:** id, timestamp, caption (full text, so hashtags and collaborator mentions are
recoverable), permalink, media_type, media_product_type (FEED vs REELS — a useful covariate),
like_count, comments_count.

**Historical insights:** blocked entirely by the missing `instagram_manage_insights`. Note that
even with that permission, **Instagram media insights are only available for media published after
the account converted to a business/creator account, and reach data has a practical horizon** —
retroactive collection for 2024 posts would likely be partial. Confidence on that last point:
medium; the test is to grant the scope and try `/insights` on a 2024 media id.

**Cost:** 2 calls. **Confidence:** certain.

### 2.3 YouTube (UCJVbMoGFRdQxVgHvW1heYCg)

**Enumerable: yes, cheaply and completely.**

`channels.list?part=contentDetails` → uploads playlist `UUJVbMoGFRdQxVgHvW1heYCg` (1 unit).
`playlistItems.list?part=snippet,contentDetails&maxResults=50` → **77 videos** in 2 calls (2 units),
oldest 2025-09-15, newest 2026-09-07.

```
2025: 27    2026: 50
```

`videos.list?part=statistics` accepts 50 ids per call, so all 77 videos' stats cost **2 units**.
Total for a complete refresh: **5 quota units** against a 10,000/day default. This can run hourly
forever without a quota conversation.

**Fields:** videoId, publishedAt (to the second), title, description, thumbnails; and from
`statistics`: viewCount, likeCount, commentCount, favoriteCount. `part=contentDetails` adds
duration. Note that watch-time, impressions and CTR live in the **YouTube Analytics API**, which
needs OAuth as the channel owner — not the API key. That is a separate, achievable piece of work
and is the only platform where genuine time-series analytics are within reach.

**Cross-reference against the `videos` table (read-only query):**

The table holds **65** rows; the channel has **77**. Every row in the table exists on the channel
(no orphans). **12 videos exist on YouTube that are not in the table:**

| Published | Id | Title |
|---|---|---|
| 2025-10-13 | `-zj74_dQT4k` | Jumbo Band – Brisbane BoTTB 2025 |
| 2026-07-10 | `UpUrKQqSYZI` | Lenny Kravitz – Are You Gonna Go My Way – Mentorloop – Melbourne 2026 |
| 2026-07-18 | `Ux7eaYzKQfE` | Fully Seek from SEEK (Full Set) – Melbourne 2026 |
| 2026-07-26 | `sInXTpMAtR8` | "Hot Property" from REA Group (Full Set) – Melbourne 2026 |
| 2026-07-27 | `OUJkTjq8ySg` | "Loop, There it is" from Mentorloop (Full Set) – Melbourne 2026 |
| 2026-08-02 | `oQUjdvea7Lw` | "Continuously Groovin'" from Open Universities Australia (Full Set) – Melbourne 2026 |
| 2026-08-10 | `IYZ6fDuhYuo` | Suncorp – Brisbane 2026 |
| 2026-08-10 | `XsZiXBhj2TY` | Jumbo – Brisbane 2026 |
| 2026-08-12 | `2t0zoh-ZJO4` | "Jumbo Band" from Jumbo Interactive (Full Set) – Melbourne 2026 |
| 2026-08-12 | `YYG9Vwmk3sM` | Epsilon – Brisbane 2026 |
| 2026-08-14 | `IOCbvBxkPP0` | Brisbane 2026 – For the Record (FTR) |
| 2026-08-20 | `l0cV7dmtY2Y` | ShipReX – Brisbane 2026 |

Most are full-set videos and Brisbane 2026 band videos that were published but never registered on
the site. That is a content gap worth fixing independently of any metrics work — these videos are
invisible on the band pages. **Confidence: certain** (exact set difference on video ids).

Existing `videos` rows by event: brisbane-2024 (1), brisbane-2025 (10), brisbane-2026 (8),
melbourne-2026 (26), sydney-2025 (19), plus 1 with a null `event_id`.

### 2.4 LinkedIn (organisation page `battle-of-the-tech-bands`)

**API: almost certainly not obtainable. Confidence: high on the blocker, medium on the workaround.**

`LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are in `.env.local`, but no access token exists
and `social_accounts` contains only `facebook` and `instagram` rows. The runbook confirms LinkedIn
posting is done by hand through the page composer in Chrome precisely because no OAuth token is
connected.

Reading an organisation's own post history needs `r_organization_social`, which LinkedIn grants
only through the **Community Management API** or the **Marketing Developer Platform** — both
partner-gated, both requiring an application, a review, and typically a demonstrated business case.
For a five-post-a-week event page this is unlikely to be approved and would take weeks. Treat the
LinkedIn API as unavailable.

**The realistic route is the Page analytics export.** As a page admin: Admin view → Analytics →
Content (or Updates) → Export. This produces an XLSX with one row per post carrying impressions,
clicks, reactions, comments, reposts, engagement rate and — importantly — the post date/time.

Two things I could not verify without page-admin access and should be tested rather than assumed:

1. **Does the date-range picker reach back past 12 months?** LinkedIn's UI has historically capped a
   single export at a 12-month window. My belief is that the cap is *per export*, not an absolute
   retention limit, so consecutive 12-month exports (Sep 2024–Sep 2025, then Sep 2023–Sep 2024)
   should reach back to page creation. **Confidence: medium.** *Test:* open the export dialog, set
   the range to 2024-09-01 → 2025-08-31, and see whether it (a) is accepted and (b) returns rows.
   Ten minutes, no code.
2. **Does the export include post time-of-day, or only the date?** If it is date-only, LinkedIn
   contributes nothing to the posting-time question and only to the "what content works" question.
   **Confidence: low.** *Test:* open the exported file and look at the timestamp column.

If both tests pass, LinkedIn is the *best* dataset of the five, because the export contains real
impressions — the metric Meta is withholding.

### 2.5 TikTok (@bottb0)

**Not obtainable. Confidence: high.**

No credentials. TikTok's Display API needs an app plus user OAuth; the Content Posting API needs
app review, which the runbook already dismissed as not worth it. There is no public endpoint that
lists an account's videos. `oEmbed` works but only per-known-URL and returns title, author and
thumbnail — no view count, no publish time.

Two partial routes, both manual:
- **TikTok Studio → Analytics → Content** shows per-video views/likes/comments/shares, but the
  analytics window is capped (60 days for most views) and there is no bulk export of post-level
  history.
- **"Download your data"** (Settings → Account → Download your data) produces a JSON archive
  including a posted-video list with timestamps. This *would* give publish times back to account
  creation. **Confidence: medium** that it includes per-video view counts; it certainly includes
  timestamps. *Test:* request the archive, wait for the email, inspect `Video/Videos.txt` or the
  JSON equivalent.

Given the small number of TikTok posts, TikTok is not worth engineering effort. Deprioritise.

### 2.6 Summary table

| Platform | Enumerable? | How far back | Posts recoverable | Outcome metric available now | Cost | Confidence |
|---|---|---|---|---|---|---|
| Facebook posts | Yes, `/published_posts` | 2024-01-25 | **177** | `shares` only | 2 calls | Certain |
| Facebook videos | Yes, `/videos` | 2024-06-06 | **102** (subset of above) | **`views`** ✅ | 2 calls | Certain |
| Instagram | Yes, `/media` | 2023-08-24 | **179** | `like_count`, `comments_count` ✅ | 2 calls | Certain |
| YouTube | Yes, uploads playlist | 2025-09-15 | **77** | `viewCount`, `likeCount`, `commentCount` ✅ | 5 quota units | Certain |
| LinkedIn | No API; manual export | unknown, likely page creation | unknown, est. 100–150 | impressions, clicks, reactions (if export works) | manual, ~30 min | Medium |
| TikTok | No | — | unknown, est. 30–60 | none automated | manual, days | Low |

**Automatable dataset today: 177 + 179 + 77 = 433 posts across three platforms**, of which 358
(FB videos, IG, YT) carry a usable engagement outcome. Add LinkedIn and the ceiling is roughly
550–580. Against the Brisbane 2026 log's ~10 posts per platform, this is a 40× increase.

Note the platforms disagree about when BotTB started online. Brisbane 2022 has **zero** social
footprint anywhere reachable; Brisbane 2023 has exactly one Instagram post. Real history begins
with Brisbane 2024.

---

## Part 3 — Does this make "best time to post" answerable?

**Yes. This is the finding that changes the verdict.**

The earlier conclusion — that Brisbane 2026 cannot answer the question because every post went out
in the same scheduled burst (LinkedIn 16:30 → YouTube 17:00 → IG+FB 18:00 → TikTok 18:30) — is
correct for Brisbane 2026 and wrong for the archive. The older posting was ad hoc, and it shows.

Publish hour, converted to Australia/Brisbane local time:

```
FB posts (n=177)   spread over 20 distinct hours, σ = 4.85 h
FB videos (n=102)  spread over 18 distinct hours, σ = 5.18 h
IG media (n=179)   spread over 18 distinct hours, σ = 4.91 h
YouTube (n=77)     spread over 16 distinct hours
```

Per year, Instagram:

| Year | n | distinct hours | σ (hours) | most common |
|---|---|---|---|---|
| 2024 | 26 | 9 | 2.33 | 17:00 (×8), 18:00 (×6) |
| 2025 | 91 | 16 | 5.20 | 07:00 (×15), 17:00 (×13) |
| 2026 | 61 | 14 | 4.48 | 08:00 (×16), 18:00 (×9) |

Facebook is the same shape: 2024 tightly clustered around the evening, 2025 wide open across 18
hours, 2026 bimodal at 08:00 and 18:00. Day-of-week is also well spread (Mon 33, Tue 30, Thu 28,
Wed 26, Fri 25, Sun 21, Sat 14 on Facebook), so weekday effects are estimable too.

A σ of nearly five hours across 18–20 distinct hours is real, usable variance. The question is
answerable.

**A first descriptive pass, purely to show the signal is not flat** (medians, not a model):

Instagram Reels, 2025 onward, n=76:

| Slot (AEST) | n | median likes |
|---|---|---|
| 06–08 | 23 | 12 |
| 09–11 | 12 | 12 |
| 12–14 | 7 | 12 |
| 15–17 | 11 | 14 |
| **18–20** | **19** | **20** |
| 21–23 | 3 | 13 |

Facebook videos, all 102, median views:

| Slot (AEST) | n | median views |
|---|---|---|
| 03–05 | 4 | 64 |
| **06–08** | **27** | **204** |
| 09–11 | 16 | 170 |
| 12–14 | 11 | 51 |
| 15–17 | 22 | 140 |
| 18–20 | 15 | 51 |
| 21–23 | 7 | 64 |

Instagram evening posts get roughly 1.6× the likes of morning posts; Facebook video points the
other way, favouring the morning. Both are interesting and **neither should be believed yet**, for
four reasons that any real analysis has to handle:

1. **Age confound.** All these numbers are lifetime totals captured on one day. A post from 2024 has
   had two years to accumulate; one from last week has had days. Age must be a covariate, or the
   analysis must be restricted to posts older than ~30 days where accumulation has plateaued.
2. **Content confound, and it is severe.** Posting time is not randomly assigned — it correlates
   with what was being posted. The 06–08 Facebook block is dominated by 2026 band videos from the
   deliberate morning schedule; the evening block is a different content mix. Time-of-day and
   content type are entangled. Controlling for `status_type` / `media_product_type` / event phase is
   mandatory.
3. **Audience growth.** The Instagram account went from a handful of followers to 223 over the
   period. Later posts get more engagement because there are more people, not because of the hour.
   Normalise by follower count at time of posting, or at minimum include year as a covariate.
4. **Likes are a weak proxy for reach.** Without `read_insights` the outcome is engagement, not
   distribution. A post can reach thousands and get eight likes.

The honest framing: **433 posts with ~5 hours of publish-time variance is enough to fit a sensible
model** — outcome ~ hour-of-day + weekday + content type + log(days since publish) + follower count
— and get an answer with real confidence intervals, per platform. It is not enough to answer it by
eyeballing a bar chart of medians.

**Recovering `read_insights` and `instagram_manage_insights` would upgrade the outcome variable
from engagement to reach and roughly double the value of the exercise.** That is a re-authorisation
of the existing app with two extra scopes, plus App Review for the Facebook one. It is the single
highest-leverage thing on this list.

---

## Part 4 — PostHog

### What is configured

Standard `posthog-js` via `src/instrumentation-client.ts`, proxied same-origin through the `/ph`
rewrite in `vercel.json` (good — this evades ad-blockers, so the referrer data is more complete
than a typical install). `capture_pageview: false` with a manual `$pageview` fired from `loaded`
after super properties are registered, plus a route-change tracker in
`src/components/posthog-provider.tsx`. `person_profiles: 'identified_only'`. Super properties
`environment`, `is_development`, `is_production` are registered on every event.

Project (environment) id **268555**, US cloud.

### The API key cannot read anything

`POSTHOG_PERSONAL_API_KEY` exists but is scoped to no read permissions at all. Every read endpoint
probed returned 403 with the missing scope named:

| Endpoint | Missing scope |
|---|---|
| `POST /api/projects/268555/query/` (HogQL) | `query:read` |
| `GET /api/projects/268555/` | `project:read` |
| `.../event_definitions/` | `event_definition:read` |
| `.../property_definitions/` | `property_definition:read` |
| `.../insights/` | `insight:read` |
| `.../dashboards/` | `dashboard:read` |
| `.../session_recordings/` | `session_recording:read` |
| `.../feature_flags/` | `feature_flag:read` |

It is also project-scoped (`/api/organizations/@current/` refuses with "API keys with scoped
projects are only supported on project-based endpoints"), so it cannot even enumerate the org.

**Fix, ~2 minutes:** PostHog → Settings → Personal API keys → edit the key (or mint a second,
read-only one) → grant `query:read`, and optionally `project:read`, `event_definition:read`,
`property_definition:read`. Then the HogQL endpoint is fully queryable:

```
POST https://us.posthog.com/api/projects/268555/query/
{"query":{"kind":"HogQLQuery","query":"select toStartOfDay(timestamp) d, properties.$referring_domain, count() from events where event='$pageview' and properties.$pathname like '/events/%' group by d, 2 order by d"}}
```

I did not attempt to change the key's scopes — read-only investigation.

### Does historical referrer data exist for event pages?

Almost certainly yes, and I could not verify it. **Confidence: medium-high on existence, unknown on
volume and retention window.**

The reasoning: `posthog-js` automatically attaches `$referrer` and `$referring_domain` to every
event, and sets `$initial_referring_domain` / `$initial_utm_*` as person properties on first touch.
Nothing in the init config suppresses this. So every `$pageview` on `/events/[slug]` since PostHog
was installed should carry a referring domain — which will separate `l.instagram.com`,
`lm.facebook.com`, `www.linkedin.com`, `t.co`, `com.google.android.gm`, direct, and organic search.

Two unknowns:

- **Retention.** PostHog's free tier retains events for 1 year; paid plans retain 7. Which applies
  here is not determinable from the API without `project:read`. *Test:* once `query:read` is
  granted, run `select min(timestamp), max(timestamp), count() from events` — one query answers
  retention, install date and total volume at once.
- **Install date.** Not recoverable from the repo alone; the same query answers it.

### The real limitation: referrer tells you the platform, not the post

`$referring_domain = 'l.instagram.com'` says a visit came from Instagram. It does not say *which
post*, and it does not distinguish the link-in-bio from a story sticker from a caption link. Since
BotTB posts several pieces of content per day during an event week, referrer alone cannot attribute
a traffic spike to a specific post — which is exactly the attribution needed to answer "which post
worked".

Worse, Instagram's in-app browser and Facebook's link shim both strip or rewrite referrers
inconsistently, and iOS Mail / WhatsApp / Slack often send no referrer at all, landing in "direct".
Expect direct traffic to be materially overstated.

### What UTM tagging to add

Captions currently link to a bare domain with no parameters. Every outbound link in a caption
should carry UTMs, and `posthog-js` will pick them up with no code change at all — they land as
`$utm_source`, `$utm_medium`, `$utm_campaign`, `$utm_content` on the pageview and as
`$initial_utm_*` on the person.

Proposed scheme:

```
https://battleofthetechbands.com/events/brisbane-2026
  ?utm_source=instagram          # instagram | facebook | linkedin | tiktok | youtube
  &utm_medium=social             # social | social_bio | social_story
  &utm_campaign=brisbane-2026    # the event slug — matches events.id, so it joins to the DB
  &utm_content=epsilon-thechain-reel   # per-post slug, unique per creative
```

Three notes on making this actually work:

- **`utm_content` is what buys the attribution.** `utm_source` alone reproduces what
  `$referring_domain` already gives. The per-post identifier is the whole point: it is what lets a
  visit be joined back to a row in the posts table.
- **`utm_campaign` should be the event slug verbatim** (`brisbane-2026`, `sydney-2026`,
  `melbourne-2026`) so PostHog output joins to `events.id` without a mapping table.
- **Instagram captions are not clickable.** UTMs in an Instagram caption do nothing; the link must
  go in the bio or a story sticker, with `utm_medium=social_bio` or `social_story` to keep it
  distinguishable. Facebook, LinkedIn and YouTube descriptions all take live links.
- Keep the parameters short and put them at the end — LinkedIn and Facebook both truncate long URLs
  in the preview, and a URL that visibly ends in a query string reads as spammier.

Add a `utm_content` (or equivalent) column to the posts table the sibling agent is building, and
generate the tagged URL from it at caption-composition time. That closes the loop: post row →
UTM → PostHog pageview → conversions, alongside the platform-native engagement numbers.

### What PostHog can and cannot contribute

**Can:** a platform-level traffic breakdown for event pages going back to install; a
consistent, cross-platform outcome measure (site visits) that is not subject to each platform's own
definition of a "view"; downstream behaviour (did they reach the ticket link?); and, once UTMs are
added, genuine per-post attribution from the next event onward.

**Cannot:** attribute historical traffic to specific posts (no UTMs existed), measure anything about
people who saw a post and did not click, or substitute for the missing Meta insights. It is a
complement to platform metrics, not a replacement.

---

## Recommended order of work

1. **Re-authorise the Meta app with `read_insights` and `instagram_manage_insights`.** Highest
   leverage by a distance; converts the outcome variable from likes to reach. Requires App Review
   for the Facebook side, so start it now — the lead time is the cost, not the effort.
2. **Grant `query:read` on the PostHog personal API key** and run one query to establish retention,
   install date and event volume. Two minutes, and it unblocks everything else on PostHog.
3. **Backfill 433 posts** from Facebook `/published_posts` + `/videos`, Instagram `/media`, and the
   YouTube uploads playlist. Six API calls plus five YouTube quota units for a complete snapshot.
   Store the raw `created_time` / `timestamp` / `publishedAt` and the current metric totals with the
   collection timestamp, so age can be modelled later.
4. **Add UTM tagging to caption composition** before Sydney 2026 (8 October) — that event then
   becomes the first with clean per-post attribution.
5. **Register the 12 missing YouTube videos** in the `videos` table. Independent of metrics; they
   are currently invisible on the site.
6. **Test the LinkedIn analytics export** (two questions: does the range reach past 12 months, does
   it carry time-of-day). Ten minutes, and if it passes, LinkedIn becomes the only source of real
   impressions data.
7. **Deprioritise TikTok.** Low volume, no automated route, high manual cost.

## Appendix — reproducing the checks

All read-only. Load `.env.local` with a proper parser, not `source`: line 50
(`SHOP_EMAIL_FROM`) contains an unquoted `<`, which makes `. ./.env.local` fail with a zsh parse
error and exit 126.

```
GET  https://graph.facebook.com/v21.0/debug_token?input_token={page_token}&access_token={app_id}|{app_secret}
GET  https://graph.facebook.com/v21.0/207312765803305/published_posts?fields=id,created_time,message,permalink_url,status_type,shares&limit=100
GET  https://graph.facebook.com/v21.0/207312765803305/videos?fields=id,created_time,title,permalink_url,length,views&limit=100
GET  https://graph.facebook.com/v21.0/17841461862790198/media?fields=id,timestamp,media_type,media_product_type,permalink,caption,like_count,comments_count&limit=100
GET  https://www.googleapis.com/youtube/v3/channels?part=contentDetails,statistics&id=UCJVbMoGFRdQxVgHvW1heYCg
GET  https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=UUJVbMoGFRdQxVgHvW1heYCg&maxResults=50
GET  https://www.googleapis.com/youtube/v3/videos?part=statistics&id={up to 50 ids}
```
