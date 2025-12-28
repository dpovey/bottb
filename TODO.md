# BOTTB Website TODO

## ✅ Recently Completed

- [x] Security headers (CSP, HSTS, X-Frame-Options, etc.)
- [x] AVIF image format support
- [x] Image `sizes` attribute audit
- [x] Photo JPEG endpoint rate limiting
- [x] Error boundaries on home page sections
- [x] Dynamic OG images for events/bands/results
- [x] FAQ page with structured data
- [x] Ticket purchase CTA on event pages
- [x] Social share buttons on results pages
- [x] Hero photos in sitemap for SEO
- [x] PostHog session recording CSP fix
- [x] Skeleton shimmer animations (with reduced-motion support)
- [x] Micro-interactions on hover/focus (Button, Card components)
- [x] E2E tests (Playwright) - Critical flows: voting, admin, photo gallery
- [x] Photo list rate limiting - Added to `/api/photos` endpoint
- [x] Dependency audit - 0 vulnerabilities, minor/patch updates applied

---

## 🔴 High Priority

### Security & Infrastructure

- [ ] **Signed blob URLs** - Prevent direct scraping of blob storage URLs
- [ ] **CORS configuration** - Configure proper CORS headers in next.config.ts

### Performance

- [ ] **800px medium image variant** - Add `md` variant for mobile slideshow (4x bandwidth savings)
- [ ] **Lighthouse baseline** - Run audit and populate `lighthouse-report.json`
- [ ] **Bundle analyzer** - Add `@next/bundle-analyzer` to track JS payload

### Testing

- [ ] **Lighthouse CI** - Add to CI/CD pipeline

---

## 🟡 Medium Priority

### SEO Improvements

- [ ] **NewsArticle schema** - Add structured data for results announcements
- [ ] **LocalBusiness schema** - Add for event venues
- [ ] **Title consistency** - Standardize "BOTTB" vs "Battle of the Tech Bands"
- [ ] **Alt text audit** - Review photo alt texts for keyword richness
- [ ] **Internal linking** - Add "Related Events" / "Also Performed" sections

### Features

- [ ] **Search functionality** - Search across photos, songs, and bands
- [ ] **Email notifications** - Event reminders, results announcements
- [ ] **Band registration form** - Replace mailto with proper form
- [ ] **Live leaderboard** - Real-time crowd scores during events

### Content Pages

- [ ] **Contact page** - Replace email link with proper contact form
- [ ] **Sponsorship page** - Benefits/tiers for potential sponsors
- [ ] **Press/Media kit** - Logos, photos, event history for journalists
- [ ] **Winners archive** - All-time leaderboard, trophy history

### Content Gaps

- [ ] **About page team bios** - Add organizer information
- [ ] **Total funds raised** - Display Youngcare fundraising total
- [ ] **Band social links** - Add social media links to band pages
- [ ] **Event venue details** - Parking, dress code, accessibility

---

## 🟢 Low Priority

### UX/Design Polish

- [ ] **Light mode option** - For outdoor voting scenarios
- [ ] **Form validation UX** - Inline validation with error/success states
- [ ] **Touch target audit** - Ensure 44x44px minimum on photo grid

### Advanced Features

- [ ] **Photo comments/reactions** - Like/heart photos
- [ ] **User accounts** - Save favorites, follow bands
- [ ] **PWA/Service worker** - Offline voting support for poor connectivity
- [ ] **Photo watermarking** - Protect photographer work
- [ ] **Automated social posting** - Share results to channels

### Technical Debt

- [ ] **Zod API validation** - Add input validation middleware
- [ ] **API documentation** - OpenAPI/Swagger docs
- [ ] **Database connection pooling** - Configure Neon pooling limits
- [ ] **Console error review** - Audit `suppressHydrationWarning` usage
- [ ] **Separate PostHog projects** - Dev vs prod environments

### Testing (Extended)

- [x] **Visual regression** - Chromatic with Storybook (TurboSnap enabled)
- [ ] **Accessibility tests** - Add axe-core to test suite
- [ ] **API contract tests** - Frontend/backend sync validation

### Security (Extended)

- [ ] **Admin IP whitelisting** - Restrict admin access by IP
- [ ] **API key authentication** - For server-to-server calls
- [ ] **Security event logging** - Log failed auth, rate limit violations
- [ ] **Request fingerprinting** - Enhanced client identification

---

## 📊 Current Protection Status

| Endpoint                | Auth Required | Rate Limited | Notes                |
| ----------------------- | ------------- | ------------ | -------------------- |
| `/api/votes/batch`      | ✅ Admin      | ✅ 200/min   | Batch voting         |
| `/api/votes`            | ❌ Public     | ✅ 10/min    | Public voting        |
| `/api/photos/[id]/jpeg` | ❌ Public     | ✅ 20/min    | Blob cost protection |
| `/api/photos`           | ❌ Public     | ✅ 100/min   | Photo list endpoint  |
| `/api/photos/heroes`    | ❌ Public     | ✅ 100/min   | Hero photos          |
| `/api/events/*`         | ❌ Public     | ✅ 100/min   | Event data           |
| `/api/bands/*`          | ❌ Public     | ✅ 100/min   | Band data            |
| `/api/songs`            | ❌ Public     | ✅ 100/min   | Song catalog         |
| `/api/videos`           | ❌ Public     | ✅ 100/min   | Video list           |
| `/api/companies`        | ❌ Public     | ✅ 100/min   | Company data         |
| `/api/photographers`    | ❌ Public     | ✅ 100/min   | Photographer list    |
| `/api/setlist/*`        | ❌ Public     | ✅ 100/min   | Band setlists        |
| `/api/auth/*`           | ❌ Public     | ❌ None      | Auth endpoints       |

---

## 📝 Notes

### Image Optimization Strategy

Current variants:

- `thumbnail.webp` - 300x300 (grid)
- `large.webp` - 2000px max (slideshow)

Recommended addition:

- `md` variant - 800px wide for mobile slideshow (biggest bandwidth win)

### Rate Limiting

Current implementation uses in-memory Map which:

- Resets on deploy
- Per-instance state (adequate for current scale)

This is acceptable for BOTTB's traffic patterns. Revisit if scraping becomes an issue.
