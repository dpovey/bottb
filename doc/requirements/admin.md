# Admin Requirements

![Admin Login](../screenshots/admin-login.png)

## Authentication

- Email/password login at `/admin/login`
- bcrypt password hashing
- JWT sessions (30-day expiry)
- Protected routes via middleware

## User Management

CLI: `pnpm manage-users`

- Create, update, list, delete admin users

## Dashboard `/admin`

- Quick stats (events, votes, photos)
- Recent activity
- Quick actions

## Event Management `/admin/events`

- List all events with status (the rehearsal event is tagged "Test")
- "Run the night" for each event
- QR code generation

## Run the Night `/admin/events/[id]/run`

Step-by-step operation of a live event: open and close crowd voting, review
held votes, check judge sheets, finalise and release results, with an undo for
every step. Includes a hidden test event for rehearsals.

See [run-the-night.md](./run-the-night.md).

## Setlist Management `/admin/events/[id]/setlists`

- Band selector/tabs
- Add/edit/delete songs
- Drag to reorder
- Song type badges
- Video links

See [songs.md](./songs.md) for data model.

## Video Management `/admin/videos`

- List all videos
- Add by YouTube URL (auto-fetch metadata)
- Edit associations and metadata
- Delete with confirmation

## Social Accounts `/admin/social`

- Connect LinkedIn, Facebook, Instagram
- View connected accounts
- Post to platforms
- AI caption suggestions

## CLI Tools

```bash
pnpm create-event <json>
pnpm activate-event <id>   # legacy — use Run the night
pnpm finalize-event <id>   # legacy — use Run the night
pnpm manage-users
pnpm bulk-upload-photos <dir> <event-id>
pnpm setup-db
pnpm backup-db
```
