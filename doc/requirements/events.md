# Events Requirements

![Events List](../screenshots/events-list.png)

## Event States

| State     | Description                             |
| --------- | --------------------------------------- |
| Upcoming  | Created, not yet active, bands editable |
| Voting    | Active, accepting votes                 |
| Finalized | Complete, results frozen                |

## Event Display Sections

Events are grouped into **Upcoming** and **Past** sections across the app:

### Upcoming Events

- **Statuses shown**: `upcoming`, `voting`
- **Sort order**: By date ascending (soonest first)
- **Display**: Event cards with date badge, location, band count
- **Home page**: Featured section with "View All Events" link
- **Events page**: Tab/section for upcoming

### Past Events

- **Statuses shown**: `finalized` only
- **Sort order**: By date descending (most recent first)
- **Display**: Event cards with winner info, trophy icon
- **Home page**: "Past Events" section with results highlights
- **Events page**: Tab/section for past events
- **Results page**: Lists all finalized events

### Active Event (Special Case)

- When an event has `is_active: true` AND `status: voting`
- Shows live indicator banner on home page
- "Vote Now" CTA prominently displayed
- Only one event can be active at a time

## Event Data

- id, name, date, location, timezone
- status: upcoming/voting/finalized
- is_active: boolean
- info (JSONB): image_url, description, ticket_url, social_media

## Event Creation

JSON format in `events/` directory:

- Event name, date, location, timezone
- Bands array with name, company_slug, order

CLI: `npm run create-event events/sydney-2025.json`

## CLI Commands

| Command                       | Description      |
| ----------------------------- | ---------------- |
| `npm run create-event <json>` | Create from JSON |
| `npm run list-events`         | List all events  |
| `npm run activate-event <id>` | Enable voting    |
| `npm run finalize-event <id>` | Freeze results   |
| `npm run cleanup-event <id>`  | Clear event data |

## Event Page Requirements

### Hero Section

- Event name, date badge, location
- Status badge
- Hero image from labeled photos

### Band List

- All competing bands with order
- Company badges
- Links to band detail pages

### Actions by Status

| Status    | Actions                      |
| --------- | ---------------------------- |
| Upcoming  | Get Tickets, Add to Calendar |
| Voting    | Vote Now, View Scores        |
| Finalized | View Results, See Photos     |
