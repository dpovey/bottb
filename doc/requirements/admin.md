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

- List all events with status
- Activate/finalize actions
- QR code generation

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
pnpm activate-event <id>
pnpm finalize-event <id>
pnpm manage-users
pnpm bulk-upload-photos <dir> <event-id>
pnpm setup-db
pnpm backup-db
```
