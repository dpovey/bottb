# Sydney 2026 — social boost plan

Event: **Thursday 8 October 2026, Manning Bar, University of Sydney.** Written 10 Sep 2026 (28 days out).
Budget: **under $500.** Status: **draft for Dean, nothing actioned.**

Competing: Bandlassian (Atlassian), Canvanauts (Canva), Amakazaam! (Amazon), V2 Voyagers (V2 AI).
Special guest, non-competing: ShipReX (Rex Software). National sponsor: Jumbo Interactive Limited.

---

## 1. Blockers to clear first

|                                                             | Why it blocks                                                                                                                                                                                                                                                                            | Effort                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| ~~Pixel unset~~ — **not a blocker**                         | The pixel **is live in production**: id `2116239625967737`, baked into the deployed bundle. It is only missing from `.env.local`, which is local-dev, and the component no-ops unless `NODE_ENV === 'production'`. A `Lead` event already fires on ticket clicks via `trackTicketClick`. | done                                  |
| Confirm the audience size                                   | Meta needs roughly 1,000 people in a custom audience to retarget sensibly and will not deliver under ~100. Check in Events Manager before committing the retargeting line.                                                                                                               | 2 minutes                             |
| No `read_insights` / `instagram_manage_insights` scope      | Can't pull view-through and retention programmatically, which is exactly the metric that decides which creative earns money.                                                                                                                                                             | free re-auth on the existing Meta app |
| `photographers` table has no rows for Eddy Hill or Rod Hunt | 509 Sydney photos with no creditable name, handle or site. Crediting is a runbook requirement.                                                                                                                                                                                           | data entry                            |
| Photo licensing for **paid** use unconfirmed                | Organic resharing is one thing; putting a photographer's work behind ad spend is usually outside what they assumed.                                                                                                                                                                      | one conversation each                 |
| No `/go` route                                              | `src/app/` has neither `go` nor `links`. Without it, Instagram and TikTok stay unmeasurable.                                                                                                                                                                                             | small build                           |

---

## 2. Content inventory — abundant

**Photos: 509 from Sydney 2025.** All `visibility='public'` (unlike the Brisbane Amy Corrie set, so **these can carry site links in captions**). Every one already has 4:5 and 9:16 crops generated — zero prep between deciding and posting.

| Band                    | Photos |
| ----------------------- | ------ |
| Bandlassian             | 128    |
| Canvanauts              | 121    |
| The Special Guests      | 85     |
| Jamazon                 | 58     |
| The Agentics            | 52     |
| The Incident Commanders | 43     |
| unassigned              | 22     |

Photographers: Eddy Hill (373), Rod Hunt (136).

**Do not use `heart_count` to select.** 17 hearts across 509 photos — the signal is empty. (Separately: that suggests the hearting feature isn't being used at all.)

**Reels.** 9 full song videos from Sydney 2025 (2:59–4:38). At 2–3 cuts per song that's 20–27 new short reels available — far more than 28 days needs. Plus the existing sub-minute cuts already published.

_Unresolved:_ whether the Sydney 2025 masters are available locally, or whether YouTube is the only copy. Cutting from a YouTube re-encode is visibly worse. **Check before planning around it.**

### Which songs earn a cut

Only cut footage that promotes someone actually playing on 8 October.

| Song                       | Band         | Why                 |
| -------------------------- | ------------ | ------------------- |
| Africa, Rosanna            | Bandlassian  | Atlassian returning |
| Anti-Hero                  | Canvanauts   | Canva returning     |
| Umbrella, APT, Alexa intro | Jamazon      | Amazon returning    |
| One Way, Seven Nation Army | The Agentics | see Holly, below    |

Don't Start Now / Used to be in Love (Google) and Mr Brightside (Banjo) — atmosphere only, not leads. Neither company returns.

### The Holly angle

The Agentics (Salesforce) **won Sydney 2025**. Their lead singer, Holly Dean, is now at V2 AI and will perform with V2 Voyagers. Dean's steer: don't push the company move, but do promote the performance.

Framing that works: **"The voice that won Sydney 2025 is back at Manning Bar — this time with V2 Voyagers."** True, promotes a returning band, never mentions the employer change.

Two cautions:

- The existing captions on those posts name Salesforce. **Recaption, don't reshare** — a straight repost points at the thing we're not pointing at.
- This puts a real person at the centre of the campaign. **Ask Holly before building creative around them** — courtesy, and they may have views on the framing.

This also solves V2 Voyagers having no BoTTB footage of their own.

---

## 3. Creative testing — organic first, paid second

Don't test creative with money. Post organically 11–22 Sep, roughly one reel a day, and let free impressions do the sorting. ~12 data points at no cost.

**Rank on 3-second view rate and thruplay rate, not likes.** A reel that holds 40% to the end will hold a cold audience too; one that collects sympathy likes from band members won't.

Melbourne and Brisbane cuts are fair game — a stranger in Sydney doesn't know or care which city the footage is from.

---

## 4. Paid — $450 of the $500

| Line          | Spend    | What                                                                 |
| ------------- | -------- | -------------------------------------------------------------------- |
| Boost winners | $120     | The 2–3 highest-retention reels. Meta. Sydney, 25–45.                |
| Retargeting   | $230     | Pixel visitors + 50%+ video viewers + IG/FB engagers. Final 10 days. |
| Final push    | $100     | Last 72 hours, retargeting only, "this Thursday".                    |
| **Total**     | **$450** | $50 slack                                                            |

**Skip LinkedIn ads.** AU CPC is $10–15 — $500 buys about forty clicks. Wrong tool at this budget. LinkedIn stays organic, where it's our best channel anyway.

**Optimise for `Lead`, not link clicks.** The pixel already fires a `Lead` event on ticket clicks, so the campaign can optimise for ticket intent directly — the single biggest determinant of whether a small budget works. A lookalike off ticket-clickers is available immediately rather than after weeks of audience building.

Targeting: Meta's employer targeting is thin and unreliable in Australia. Better proxies are Sydney + 25–45 + interests in the specific companies, plus "Software engineer" / "Information technology" titles. The best audience will be the pixel lookalike once it has data — third reason the pixel is urgent.

---

## 5. Company amplification — the biggest free lever

**The ask is amplification, not money.** Nobody approves new sponsorship spend in four weeks. Pitch it as ready-made employer-branding content their team didn't have to make.

**@canvalife (Instagram, ~104K)** is the single highest-leverage target in this plan — one post there out-reaches the entire $450 several times over.

| Company          | Door                                  | Contact                                                                                           | Notes                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rex Software** | Marketing                             | `marketing@rexsoftware.com`                                                                       | Published, monitored inbox. Non-competing guest, no rivalry friction. Small enough that one email reaches a decision-maker. **Easiest win — send first.**                                                                                                                         |
| **V2 AI**        | CMO                                   | Verity Martino, `linkedin.com/in/verity-martino/`                                                 | Verified on their live site. Scaling headcount ~110%, competing for AI talent against Atlassian and Canva. Go marketing, not people — at their size marketing owns the channels. Second: Gerhard Schweinitz (CPO). **Ask Holly first.**                                           |
| **Canva**        | Social impact **and** talent brand    | Robyn King (Head of Social Impact); Emily Vaughan (Talent Brand Lead); fallback `comms@canva.com` | Two parallel doors. Lead with the **charity** for King, @canvalife for Vaughan. **Verify Vaughan's title on the day** — signal she may have moved to People Experience; fallback Frances Agius. Use their vocabulary: _Talent Brand_, _People Experience_, _People Vibe & Comms_. |
| **Atlassian**    | Talent Brand — **not** the Foundation | via Bandlassian internally; cold fallback `press@atlassian.com`                                   | The Atlassian Foundation **explicitly refuses unsolicited partnership requests** — don't burn the approach there. Talent Brand's own job ads list "partnerships" in the remit, but it looks US-led with no confirmable Sydney person.                                             |
| **Amazon**       | via the band only                     | —                                                                                                 | No AU employer-brand team, no named AU community lead, only global inboxes published. Cold outreach won't land. First resolve whether Amakazaam! members are Amazon AU Consumer or AWS — different comms orgs. **Do last.**                                                       |

Counterintuitive finding worth keeping: for **Canva the charity door beats employer branding; for Atlassian it's the reverse.** Opposite of what company size would suggest.

_Caveat:_ several named people come from search snippets of unknown age. People-team roles turn over fast — check each LinkedIn on the day you write. Ignore ZoomInfo/RocketReach-style guessed addresses entirely; they're pattern-generated and make outreach look like spam.

---

## 6. Meetups — 20 with confirmed events in the window

**Deadline: four of these are on 16 September.** Outreach goes out in the next 2–3 days or the slots are gone.

The ask is small: 60 seconds at the top of the meetup, or a line in the organiser's Slack/newsletter.

### Priority

| #   | Group                                      | Date          | Members | Contact                           | Note                                                                                            |
| --- | ------------------------------------------ | ------------- | ------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Sydney AI + Sydney AI Developers (AI Camp) | Tue 22 Sep    | ~11,500 | `info@aicamp.ai`                  | **One email reaches both.** Held at Atlassian's Sydney office.                                  |
| 2   | Sydney AI + Data / Big Data Analytics      | **Tue 6 Oct** | ~15,000 | Eugene Dubossarsky, via Meetup    | Cross-posted, one organiser. **Two days before the show — best-timed slot on the list.**        |
| 3   | Sydney Tech Meetup                         | Thu 24 Sep    | 8,079   | Clinton Mead, via Meetup          | Already a pub social; format fit is exact.                                                      |
| 4   | Friends of Figma Sydney                    | Thu 24 Sep    | 2,618   | friends.figma.com/sydney          | Organiser **Simon Mateljan is at Atlassian** — only verified warm intro. Route via Bandlassian. |
| 5   | SydJS                                      | Wed 16 Sep    | ~1,774  | LinkedIn /company/sydjs, X @sydjs | At Atlassian HQ, L29/363 George St. Use sydjs.com — the Meetup group is dormant.                |
| 6   | Enterprise UX Sydney                       | Wed 16 Sep    | 3,649   | blueegg.com.au, X @euxsyd         |                                                                                                 |
| 7   | golang-syd                                 | Thu 17 Sep    | 2,605   | via Meetup                        |                                                                                                 |
| 8   | Sydney CocoaHeads                          | Thu 17 Sep    | 2,125   | sydneycocoaheads.com              |                                                                                                 |
| 9   | FP-Syd                                     | Mon 21 Sep    | 1,160   | groups.google.com/g/fp-syd        | Firehouse Hotel, Nth Sydney                                                                     |
| 10  | SLUG (Sydney Linux)                        | Fri 25 Sep    | 1,493   | `committee@slug.org.au`           |                                                                                                 |

**Lowest friction — online events, so a 60-second slot costs the organiser nothing:** Sydney .NET User Group (16 Sep, 2,311, via SSW), Sydney Alt.NET (29 Sep, 2,917). Also Lean Beer Sydney (14 & 28 Sep, informal pub format), IGDA Sydney (15 Sep, public Discord), Women in Digital Sydney (29 Sep), Elixir Sydney (16 Sep).

### Newsletter / Slack mention instead (no in-window event)

- **Data & Analytics Wednesday Sydney** — 7,705, real mailing list + LinkedIn group, met at Canva last week. Best newsletter ask.
- **GDG Sydney** — 6,561 plus the ANZ GDG Slack. DevFest is 10 Oct, two days late.
- **Sydney Technology Leaders** — `sydtechleaders@gmail.com` + Slack, 4,582 CTO/EM-level. Worth the contact regardless of this event — that's who sponsors a band next year.
- **FinTech & Banking Sydney** — 5,066, `glen@famfi.com.au` (Glen Frost). Only direct organiser email found.
- **SecTalks Sydney** — 4,547, `sydney@sectalks.org`, active, next ~13 Oct.

### Do not contact — confirmed dormant or defunct

DDD Sydney (indefinite hiatus), DevOps Sydney (8,007 members, no event since Nov 2025), Sydney Python (Jul 2025, but Slack still live — worth a Slack post), AWS User Group Sydney (Jun 2026), ProductTank Sydney (Jul 2026), Sydney Machine Learning, Deep Learning Sydney, Women Who Code Sydney (gone), PyData Sydney (404), Startup Grind Sydney (5,545 members, zero events), Techstars Startup Weekend Sydney (funding cut), plus ~25 more.

_Caveat on the research:_ Meetup's `/events/` subpages are login-walled and render "0 events" for every group. All readings above come from group landing pages instead. Anything sourced from an events subpage would be a false negative.

---

## 7. Other channels

- **Youngcare's own channels** — charity partner, warm list, free. "Buy a ticket, fund Youngcare" lands better from them than from us.
- **Manning Bar / University of Sydney** — the venue has a what's-on audience and promoting its own shows is its job. USyd student and alumni channels come with it. Uni societies: CSESoc UNSW (`csesoc@csesoc.org.au`, 16,000+), SYNCS USyd (`exec@syncs.org.au`).
- **Sydney event listings** — Time Out, Concrete Playground, City of Sydney. Free, broad rather than targeted, and a charity gig is exactly what they publish.
- **Facebook groups** — weakest of the options considered. Australian tech professionals aren't in FB groups in any numbers; that audience is on LinkedIn and in Slacks. Where they do work is Sydney live-music / Inner West / Newtown gig groups, which fill a room but don't build the tech-community identity the event runs on. Do late, cheap, expect little.

---

## 8. Sequence

| When                      | What                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**                 | Check the pixel audience size in Events Manager. Re-auth for `read_insights`. Email `marketing@rexsoftware.com`.                                              |
| **This week (by 12 Sep)** | Meetup outreach — the 16/17 Sep groups first. Ask Holly about the framing. Check whether Sydney 2025 masters exist locally. Fill in the `photographers` rows. |
| **11–22 Sep**             | Organic reel test, ~1/day. Company amplification approaches (Canva, V2 AI, Atlassian via band).                                                               |
| **~22 Sep**               | Read retention. Pick 2–3 winners.                                                                                                                             |
| **23 Sep – 8 Oct**        | Paid phase. `/go` live before this starts.                                                                                                                    |
| **5–8 Oct**               | Final push, retargeting only.                                                                                                                                 |

---

## 9. Open questions

1. Are the Sydney 2025 masters available locally, or is YouTube the only copy?
2. Will Eddy Hill and Rod Hunt license their photos for paid promotion?
3. Is Holly comfortable being the campaign's lead story, and how do they want it framed?
4. Are Amakazaam! members Amazon AU Consumer or AWS?
5. Does Meta Business Suite allow scheduling an IG story **with** a link sticker? Still unverified — if not, stories stay a manual phone job.
