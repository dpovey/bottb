# Requirements Documentation

## Feature Areas

| Feature                                   | Description                            |
| ----------------------------------------- | -------------------------------------- |
| [Home Page](./home-page.md)               | Landing page, hero, event sections     |
| [Navigation](./navigation.md)             | Header, footer, menus, breadcrumbs     |
| [Events](./events.md)                     | Event lifecycle, creation, pages       |
| [Voting](./voting.md)                     | Crowd and judge voting                 |
| [Scoring](./scoring.md)                   | Score calculation, results display     |
| [Photos](./photos.md)                     | Gallery and slideshow                  |
| [Videos](./videos.md)                     | Video carousel and YouTube integration |
| [Songs](./songs.md)                       | Setlists and all songs page            |
| [Bands & Companies](./bands-companies.md) | Band pages, company associations       |
| [Admin](./admin.md)                       | Administrative dashboard               |
| [Public Pages](./public-pages.md)         | Static pages, SEO, accessibility       |

## User Journeys

### Event Attendee

1. Scan QR code at event
2. Select favorite band
3. Submit vote
4. View results after event

### Judge

1. Access judge scoring page
2. Score each band on 3 criteria
3. Submit all scores

### Admin

1. Create event from JSON
2. Activate event for voting
3. Share QR codes
4. Finalize event
5. Manage photos/videos

### Visitor

1. View upcoming/past events
2. Browse photo gallery
3. View results and bands

## Event Lifecycle

```
Upcoming → Voting → Finalized
```

- **Upcoming**: Created, bands editable, no voting
- **Voting**: Active, accepting votes, QR codes work
- **Finalized**: Complete, results frozen, voting disabled

## Screenshots

Screenshots are stored in `doc/screenshots/`. To regenerate:

```bash
# Start dev server in another terminal
npm run dev

# Capture screenshots
npm run capture-screenshots
```

The script auto-detects the running Next.js port.
