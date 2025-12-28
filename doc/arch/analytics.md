# Analytics Architecture

Event tracking with PostHog and Vercel Analytics.

## Providers

- **PostHog**: Detailed product analytics
- **Vercel Analytics**: Basic page views

Both receive same events via unified `trackEvent()` utility.

## Event Naming

- Format: `category:action`
- Case: lowercase
- Examples: `photo:click`, `video:clicked`, `social:link_clicked`

## Tracked Events

### Photo Events

| Event                  | When                   |
| ---------------------- | ---------------------- |
| `photo:click`          | Photo clicked in grid  |
| `photo:view`           | Photo viewed >1 second |
| `photo:download`       | Original downloaded    |
| `photo:share`          | Shared via link/social |
| `photo:filter_changed` | Filter applied         |

### Video Events

| Event                       | When                     |
| --------------------------- | ------------------------ |
| `video:clicked`             | Thumbnail clicked        |
| `youtube:subscribe_clicked` | Subscribe button clicked |

### Social Events

| Event                 | When                |
| --------------------- | ------------------- |
| `social:link_clicked` | Social icon clicked |

## Environment Metadata

All events include:

- `environment`: production/development/test
- `is_development`: true/false
- `is_production`: true/false

Use `is_production = "true"` filter in PostHog for production-only data.

## Configuration

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Privacy

- No PII tracked
- IDs are internal identifiers
- PostHog respects Do Not Track
- Analytics disabled in test environment
