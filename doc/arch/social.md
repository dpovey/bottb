# Social Integration

Posting to LinkedIn and Meta (Facebook/Instagram/Threads) via OAuth.

## Supported Platforms

| Platform  | OAuth             | Post Types            |
| --------- | ----------------- | --------------------- |
| LinkedIn  | OAuth 2.0         | Image posts with text |
| Facebook  | Meta Business SDK | Image posts with text |
| Instagram | Meta Business SDK | Image posts with text |
| Threads   | Meta Business SDK | Image posts with text |

## OAuth Flow

1. Admin clicks "Connect [Platform]"
2. Redirect to platform OAuth
3. User grants permissions
4. Callback stores encrypted tokens
5. Redirect back to admin UI

## Token Security

- AES-256-GCM encryption for stored tokens
- Encryption key in environment variable
- Automatic token refresh before expiry
- Tokens never exposed to client

## API Endpoints

| Endpoint                                         | Description             |
| ------------------------------------------------ | ----------------------- |
| `GET /api/admin/social/accounts`                 | List connected accounts |
| `POST /api/admin/social/[platform]/connect`      | Initiate OAuth          |
| `GET /api/admin/social/[platform]/callback`      | Handle callback         |
| `DELETE /api/admin/social/[platform]/disconnect` | Remove account          |
| `POST /api/admin/social/post`                    | Post to platform        |

## Post Request

```
{
  platform: 'linkedin' | 'facebook' | 'instagram' | 'threads',
  accountId: string,
  text: string,
  photoIds: string[]
}
```

## Admin UI

- `/admin/social`: Connect/disconnect accounts
- Share composer modal: Select platform, photos, enter caption
- AI-powered caption suggestions

## Environment Variables

```
LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
META_APP_ID, META_APP_SECRET
SOCIAL_ENCRYPTION_KEY  # base64 encoded 32-byte key
```
