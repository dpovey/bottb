# Battle of the Tech Bands

A voting and scoring system for tech band competitions, built with Next.js and Neon Postgres.

## Features

- **Crowd Voting**: Simple one-click voting for audience members via QR code
- **Judge Scoring**: Detailed scoring system for judges across 4 criteria
- **Real-time Results**: Live results with category winners and overall winner
- **Band Breakdowns**: Individual band score analysis and statistics
- **CLI Tools**: Command-line tools for event management
- **Double Voting Protection**: Multi-layered system to prevent double voting
- **Admin Authentication**: Password-based admin authentication with user management

## Architecture Notes

### Server vs Client Code Separation

This project uses a strict separation between server-side and client-side code to avoid browser compatibility issues:

- **`src/lib/user-context.ts`**: Contains only shared TypeScript interfaces and types
- **`src/lib/user-context-server.ts`**: Server-side functions that use Node.js APIs (crypto, database queries)
- **`src/lib/user-context-client.ts`**: Client-side functions that use browser APIs (document, window, FingerprintJS)

**Why this matters**: Next.js bundles all imported modules for the client, so mixing server-side code (like Node.js `crypto`) with client-side code causes runtime errors in the browser. The separation ensures clean bundling and prevents "Cannot read properties of undefined (reading 'crypto')" errors.

**Import Guidelines**:

- API routes and server components: Import from `user-context-server.ts`
- Client components and browser code: Import from `user-context-client.ts`
- Shared types: Import from `user-context.ts`

### Finalized Results Architecture

**Critical Rule**: Once an event is finalized, **always use finalized results** from the `finalized_results` table instead of calculating scores dynamically.

**Why this matters**:
- **Performance**: Finalized results are pre-calculated and stored, avoiding expensive SQL queries with CTEs and aggregations
- **Data Integrity**: Results are frozen at finalization time, preventing inconsistencies if votes are modified later
- **Consistency**: All pages show the same results for finalized events

**Implementation Pattern**:

```typescript
// ✅ CORRECT: Check for finalized results first
if (event.status === 'finalized' && await hasFinalizedResults(event.id)) {
  const results = await getFinalizedResults(event.id);
  // Use finalized results
} else {
  // Only calculate for non-finalized events
  const scores = await getBandScores(event.id);
  // Calculate scores dynamically
}
```

**When to use each function**:
- **`getFinalizedResults(eventId)`**: Use for finalized events (`status === 'finalized'`)
- **`getBandScores(eventId)`**: Use only for non-finalized events (upcoming, voting, or admin preview)

**Files that must follow this pattern**:
- `src/app/page.tsx` - Home page past events
- `src/app/events/page.tsx` - Events listing page
- `src/app/results/[eventId]/page.tsx` - Results page
- `src/app/band/[bandId]/page.tsx` - Individual band page
- `src/app/api/events/[eventId]/scores/route.ts` - Scores API endpoint

## Scoring System

### Judge Criteria (80 points total)

- **Song Choice** (20 points): Engaging, recognizable, suited to band's style, fits event energy
- **Performance** (30 points): Musical ability, tightness, stage presence, having fun while nailing it
- **Crowd Vibe** (30 points): Getting crowd moving, singing, clapping, energy transfer

### Crowd Vote (20 points)

- **Crowd Vote** (20 points): Direct audience voting via app

## Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up Neon Postgres**:

   - Create a Neon database
   - Add the Vercel Postgres plugin to your Vercel project
   - Run the SQL schema from `src/lib/schema.sql`

3. **Environment Variables**:

   - Copy `env.example` to `.env.local`
   - Fill in your Neon database connection details:
     - `POSTGRES_URL`: Your Neon database connection string
     - `POSTGRES_PRISMA_URL`: Prisma-compatible connection string
     - `POSTGRES_URL_NO_SSL`: Non-SSL connection string
     - `POSTGRES_URL_NON_POOLING`: Non-pooling connection string
     - `POSTGRES_USER`: Database username
     - `POSTGRES_HOST`: Database host
     - `POSTGRES_PASSWORD`: Database password
     - `POSTGRES_DATABASE`: Database name
   - Set up authentication:
     - `AUTH_SECRET`: Generate a random secret key (e.g., `openssl rand -base64 32`)
   - Optional SEO and analytics:
     - `GOOGLE_SITE_VERIFICATION`: Google Search Console verification code (get from https://search.google.com/search-console)
     - `NEXT_PUBLIC_BASE_URL`: Base URL for the site (auto-detected on Vercel, but can be set explicitly)

4. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

## Admin Access

The application includes admin functionality protected by password-based authentication:

- **Admin Dashboard**: `/admin` - Main admin interface
- **Event Management**: `/admin/events` - Manage all events
- **User Management**: Create and manage admin users via CLI tools
- **Protected APIs**: Admin-only endpoints like bulk vote management

### Admin Features

- **Event Management**: Create, edit, and manage events
- **Vote Management**: View and manage all votes
- **Bulk Operations**: Perform bulk vote operations
- **User Management**: Create, update, and delete admin users
- **System Administration**: User and system management

### Authentication

- Admin access requires password-based authentication using NextAuth.js
- User accounts are stored in the database with bcrypt-hashed passwords
- Admin users are created via CLI tools (`npm run manage-users`)
- Middleware protects admin routes and redirects unauthenticated users

## CLI Tools

### Setup Database

```bash
npm run setup-db
```

### Create Event from JSON

```bash
npm run create-event events/example-event.json
```

### List All Events

```bash
npm run list-events
```

### Activate an Event

```bash
npm run activate-event <event-id>
```

### Finalize an Event

```bash
npm run finalize-event <event-id>
```

### Cleanup an Event

```bash
npm run cleanup-event <event-id>
```

### Manage Admin Users

```bash
npm run manage-users
```

This interactive tool allows you to:

- Create new admin users
- Update user passwords
- Delete users
- List all users

## Event JSON Format

Create events by adding JSON files to the `events/` directory:

```json
{
  "name": "Battle of the Tech Bands - Sydney 2024",
  "date": "2024-12-15T18:00:00Z",
  "location": "Sydney Convention Centre",
  "is_active": true,
  "bands": [
    {
      "name": "The Code Rockers",
      "description": "Frontend specialists who know how to make the crowd dance",
      "order": 1
    },
    {
      "name": "Database Divas",
      "description": "Backend engineers with killer vocals",
      "order": 2
    }
  ]
}
```

## Event Status

Events have three statuses:

- **upcoming**: Event is created but voting hasn't started
- **voting**: Event is active and accepting votes
- **finalized**: Event is complete and results are available

## Usage

1. **Create an Event**: Use the CLI tool with a JSON file
2. **Activate Event**: Set the event as active for voting (status: voting)
3. **Share QR Codes**:
   - Crowd voting: `/vote/crowd/{eventId}`
   - Judge scoring: `/vote/judge/{eventId}`
4. **Finalize Event**: Mark event as complete (status: finalized)
5. **View Results**: `/results/{eventId}` (only available for finalized events)

## Double Voting Prevention

The system uses multiple layers to prevent duplicate voting:

### 1. FingerprintJS Integration

- **Primary Method**: Uses FingerprintJS to generate unique browser fingerprints
- **High Accuracy**: Combines 40+ browser characteristics for stable identification
- **Cross-Session**: Maintains identity across browser sessions and device restarts
- **Confidence Scoring**: Tracks fingerprint reliability with confidence scores

### 2. Custom Fingerprint Fallback

- **Hybrid Approach**: Combines IP address, user agent, event ID, and daily timestamp
- **Daily Reset**: Fingerprints reset daily to allow legitimate re-voting
- **SHA-256 Hashing**: Secure fingerprint generation using cryptographic hashing

### 3. Cookie-Based Tracking

- **Client-Side**: Sets voting cookies to track completed votes
- **Update Allowed**: Users can update their votes if they have a valid cookie
- **30-Day Expiry**: Cookies persist for 30 days to prevent re-voting

### 4. Server-Side Validation

- **Database Checks**: Queries database for existing votes before submission
- **Fingerprint Matching**: Checks both FingerprintJS visitor ID and custom fingerprints
- **Error Responses**: Returns 409 Conflict status for duplicate vote attempts

### 5. Multi-Layer Protection

```
1. FingerprintJS Visitor ID (Primary)
   ↓ (if not available)
2. Custom Fingerprint (Fallback)
   ↓ (if not available)
3. Cookie Check (Client-side)
```

The system prioritizes FingerprintJS for maximum accuracy, falls back to custom fingerprints, and uses cookies for client-side UX improvements.

## Database Schema

The app uses four main tables:

- `users`: Admin user accounts with password authentication
- `events`: Event information and active status
- `bands`: Band information linked to events
- `votes`: Voting data with fingerprint tracking and user context

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Neon Postgres via Vercel Postgres
- **Authentication**: NextAuth.js with password-based credentials
- **Password Hashing**: bcrypt for secure password storage
- **Middleware**: Next.js middleware for route protection
- **Deployment**: Vercel
- **CLI**: tsx for TypeScript execution
