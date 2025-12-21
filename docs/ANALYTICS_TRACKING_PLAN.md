# Analytics Tracking Plan

This document outlines all events tracked in the Battle of the Tech Bands application, including what information is captured with each event.

## Analytics Providers

- **Vercel Analytics**: Basic page views and custom events
- **PostHog**: Detailed product analytics with event properties

Both providers receive the same events, but PostHog includes additional metadata for filtering and analysis.

## Automatic Environment Metadata

All events automatically include the following environment properties (added by `src/lib/analytics.ts`):

| Property         | Type   | Description                                                                                   |
| ---------------- | ------ | --------------------------------------------------------------------------------------------- |
| `environment`    | string | Node environment: "development", "production", or "test"                                      |
| `is_development` | string | "true" if in development (localhost, dev domains, or NODE_ENV=development), "false" otherwise |
| `is_production`  | string | "true" if in production and not development, "false" otherwise                                |

**Note**: Test environment events are not tracked (automatically filtered out).

## Tracked Events

**Event Naming Convention**: Following PostHog's best practices, we use the `Category:Action` format:

- All events use lowercase letters
- Present-tense verbs for actions
- Colons (`:`) to separate category from action
- Example: `photo:download`, `photo:share`

### 1. Page Views

**Event Name**: `$pageview`

**When Tracked**: Automatically on every route change (handled by `src/components/posthog-provider.tsx`)

**Properties**:

- `$current_url` (string): Full URL of the current page
- `environment` (string): Node environment
- `is_development` (string): Development flag
- `is_production` (string): Production flag

**Location**: `src/components/posthog-provider.tsx`

---

### 2. Photo Click

**Event Name**: `photo:click`

**When Tracked**: When a user clicks on a photo in the photo grid to open the slideshow

**Properties**:

- `photo_id` (string): Unique identifier of the photo
- `event_id` (string | null): ID of the event the photo belongs to
- `band_id` (string | null): ID of the band in the photo
- `event_name` (string | null): Name of the event
- `band_name` (string | null): Name of the band
- `environment` (string): Node environment (automatic)
- `is_development` (string): Development flag (automatic)
- `is_production` (string): Production flag (automatic)

**Location**: `src/app/photos/photos-content.tsx` → `handlePhotoClick()`

**Use Cases**:

- Track which photos are most clicked
- Understand user engagement with photo gallery
- Identify popular photos by band or event

---

### 3. Photo View

**Event Name**: `photo:view`

**When Tracked**: When a photo is viewed in the slideshow for at least 1 second (when slideshow opens or photo changes)

**Minimum View Duration**: 1 second - The photo must be visible for at least 1 second before a view is tracked. This filters out accidental glimpses or very brief navigations.

**Properties**:

- `photo_id` (string): Unique identifier of the photo
- `event_id` (string | null): ID of the event the photo belongs to
- `band_id` (string | null): ID of the band in the photo
- `event_name` (string | null): Name of the event
- `band_name` (string | null): Name of the band
- `view_duration` (number | undefined): Optional - duration photo was viewed (if available)
- `environment` (string): Node environment (automatic)
- `is_development` (string): Development flag (automatic)
- `is_production` (string): Production flag (automatic)

**Location**: `src/components/photos/photo-slideshow.tsx` → `useEffect` on `currentIndex` change with 1s delay

**Use Cases**:

- Track which photos are viewed most
- Understand slideshow engagement
- Measure time spent viewing photos

---

### 4. Photo Download

**Event Name**: `photo:download`

**When Tracked**: When a user downloads a high-resolution photo from the slideshow

**Properties**:

- `photo_id` (string): Unique identifier of the photo
- `event_id` (string | null): ID of the event the photo belongs to
- `band_id` (string | null): ID of the band in the photo
- `photographer` (string | null): Name of the photographer
- `event_name` (string | null): Name of the event
- `band_name` (string | null): Name of the band
- `environment` (string): Node environment (automatic)
- `is_development` (string): Development flag (automatic)
- `is_production` (string): Production flag (automatic)

**Location**: `src/components/photos/photo-slideshow.tsx` → `handleDownload()`

**Use Cases**:

- Track most downloaded photos
- Understand which bands/events generate most downloads
- Measure content value and engagement

---

### 5. Photo Share

**Event Name**: `photo:share`

**When Tracked**: When a user shares a photo via:

- Copy link to clipboard
- Social media share (LinkedIn, Facebook, Instagram)

**Properties**:

- `photo_id` (string): Unique identifier of the photo
- `share_method` (string): Method used to share - one of:
  - `"copy_link"`: Link copied to clipboard
  - `"linkedin"`: Shared to LinkedIn
  - `"facebook"`: Shared to Facebook
  - `"instagram"`: Shared to Instagram
- `event_id` (string | null): ID of the event the photo belongs to
- `band_id` (string | null): ID of the band in the photo
- `event_name` (string | null): Name of the event
- `band_name` (string | null): Name of the band
- `environment` (string): Node environment (automatic)
- `is_development` (string): Development flag (automatic)
- `is_production` (string): Production flag (automatic)

**Locations**:

- Copy link: `src/components/photos/photo-slideshow.tsx` → `handleCopyLink()`
- Social shares: `src/components/photos/share-composer-modal.tsx` → `handlePost()` (after successful post)

**Use Cases**:

- Track most shared photos
- Understand which platforms are most popular for sharing
- Measure viral potential of photos
- Identify shareable content by band or event

**Note**: For social media shares, the event is tracked for each photo in a multi-photo share, and only after a successful post.

---

### 6. Photo Filter Change

**Event Name**: `photo:filter_changed`

**When Tracked**: When a user changes any filter in the photo gallery:

- Event filter
- Band filter
- Photographer filter
- Company filter

**Properties**:

- `filter_type` (string): Type of filter changed - one of:
  - `"event"`: Event filter
  - `"band"`: Band filter
  - `"photographer"`: Photographer filter
  - `"company"`: Company filter
- `filter_value` (string | null): The selected filter value, or `null` if filter was cleared
- `environment` (string): Node environment (automatic)
- `is_development` (string): Development flag (automatic)
- `is_production` (string): Production flag (automatic)

**Location**: `src/app/photos/photos-content.tsx` → Filter change handlers:

- `handleEventChange()`
- `handleBandChange()`
- `handlePhotographerChange()`
- `handleCompanyChange()`

**Use Cases**:

- Understand how users navigate the photo gallery
- Identify most popular filters
- Measure filter usage patterns
- Optimize filter UI/UX

---

### 7. Social Link Click

**Event Name**: `social:link_clicked`

**When Tracked**: When a user clicks on any social media icon/link throughout the site

**Properties**:

- `platform` (string): Social platform name (e.g., "linkedin", "instagram", "facebook", "twitter", "youtube", "tiktok", "website", "email")
- `location` (string): Where the icon appears on the site - one of:
  - `"footer_simple"`: Simple footer variant
  - `"footer_full"`: Full footer variant
  - `"about_hero"`: About page hero section
  - `"band_page"`: Band detail page
  - `"photographer_page"`: Photographer detail page
- `url` (string): The destination URL
- `environment` (string): Node environment (automatic)
- `is_development` (string): Development flag (automatic)
- `is_production` (string): Production flag (automatic)

**Location**: `src/components/ui/social-icon-link.tsx` - Used throughout the site

**Use Cases**:

- Track which social platforms are most popular
- Understand which locations drive most social clicks
- Measure engagement with social links
- Identify which bands/photographers drive social traffic

**Note**: All social icons now use the shared `SocialIconLink` component for consistent tracking.

---

### 8. Video Click

**Event Name**: `video:clicked`

**When Tracked**: When a user clicks on a video thumbnail to open the video modal

**Properties**:

- `video_id` (string): Unique identifier of the video
- `video_title` (string): Title of the video
- `youtube_video_id` (string): YouTube video ID
- `event_id` (string | null): ID of the event the video belongs to
- `band_id` (string | null): ID of the band in the video
- `event_name` (string | null): Name of the event
- `band_name` (string | null): Name of the band
- `company_name` (string | null): Name of the company
- `location` (string): Where the video was clicked - one of:
  - `"home_page"`: Home page video strip
  - `"event_page"`: Event detail page
  - `"band_page"`: Band detail page
  - `"video_strip"`: Generic video strip (default)
  - `"video_carousel"`: Generic video carousel (default)
- `environment` (string): Node environment (automatic)
- `is_development` (string): Development flag (automatic)
- `is_production` (string): Production flag (automatic)

**Location**: `src/components/video-carousel.tsx` → Video thumbnail click handler

**Use Cases**:

- Track which videos are most popular
- Understand which locations drive most video engagement
- Measure video engagement by band or event
- Identify which videos drive the most views

---

### 9. YouTube Subscribe Click

**Event Name**: `youtube:subscribe_clicked`

**When Tracked**: When a user clicks the "Subscribe" button in the video carousel

**Properties**:

- `location` (string): Where the subscribe button was clicked - one of:
  - `"home_page"`: Home page video strip
  - `"event_page"`: Event detail page
  - `"band_page"`: Band detail page
  - `"video_strip"`: Generic video strip (default)
  - `"video_carousel"`: Generic video carousel (default)
- `url` (string): The YouTube subscribe URL
- `environment` (string): Node environment (automatic)
- `is_development` (string): Development flag (automatic)
- `is_production` (string): Production flag (automatic)

**Location**: `src/components/video-carousel.tsx` → Subscribe button click handler

**Use Cases**:

- Track subscribe button effectiveness
- Understand which pages drive most subscriptions
- Measure conversion from video views to subscriptions
- Optimize subscribe button placement

---

## PostHog Filtering Guide

Since we use a single PostHog project for all environments, use these filters to view production-only data:

### Filter Options

1. **Production Only**:

   ```
   is_production = "true"
   ```

2. **Exclude Development**:

   ```
   is_development = "false"
   ```

3. **By Environment**:
   ```
   environment = "production"
   ```

### Example: Creating "Most Popular Photos" Insight

1. Create a new insight in PostHog
2. Select event: `photo:view` or `photo:click`
3. Add filter: `is_production = "true"`
4. Group by: `photo_id` or `band_name`
5. Save the insight

This will show only production data, excluding all development and test events.

---

## Implementation Details

### Analytics Utility

All tracking functions are defined in `src/lib/analytics.ts`:

- `trackEvent()`: Base function that sends to both Vercel Analytics and PostHog
- `trackPhotoClick()`: Photo click tracking
- `trackPhotoView()`: Photo view tracking
- `trackPhotoDownload()`: Photo download tracking
- `trackPhotoShare()`: Photo share tracking
- `trackPhotoFilterChange()`: Filter change tracking
- `trackSocialLinkClick()`: Social link click tracking
- `trackVideoClick()`: Video click tracking
- `trackSubscribeClick()`: YouTube subscribe button click tracking

### PostHog Initialization

PostHog is initialized in `src/components/posthog-provider.tsx` using the official PostHog App Router integration with `posthog-js/react`. This follows PostHog's recommended approach for Next.js App Router.

### Page View Tracking

Page views are tracked automatically via `src/components/posthog-provider.tsx` which listens to Next.js route changes using `usePathname()` and `useSearchParams()` hooks.

---

## Environment Configuration

### Development

By default, development events are tracked with `is_development="true"`. To disable tracking in development:

```bash
NEXT_PUBLIC_DISABLE_DEV_TRACKING=true
```

### Production

Always tracked with `is_production="true"` (when not in development).

### Test

Automatically disabled - no events are sent when `NODE_ENV=test`.

---

## Data Privacy

- All events include environment metadata for filtering
- No personally identifiable information (PII) is tracked
- Photo IDs, event IDs, and band IDs are internal identifiers
- User IP addresses and personal data are not included in custom events
- PostHog respects Do Not Track headers

---

## Future Enhancements

Potential additional events to track:

- Video views and interactions
- Voting interactions
- Setlist views
- Band page views
- Event page views
- Search queries (if search is added)
- User journey funnels (view → click → share → download)

---

## Questions or Updates

If you need to add new events or modify existing tracking, update:

1. `src/lib/analytics.ts` - Add new tracking functions
2. This document - Document the new events
3. Component files - Add tracking calls where needed
