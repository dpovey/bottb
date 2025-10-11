# Battle of the Tech Bands

A voting and scoring system for tech band competitions, built with Next.js and Neon Postgres.

## Features

- **Crowd Voting**: Simple one-click voting for audience members via QR code
- **Judge Scoring**: Detailed scoring system for judges across 4 criteria
- **Real-time Results**: Live results with category winners and overall winner
- **Band Breakdowns**: Individual band score analysis and statistics
- **CLI Tools**: Command-line tools for event management

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

4. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

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

## Database Schema

The app uses three main tables:

- `events`: Event information and active status
- `bands`: Band information linked to events
- `votes`: Voting data with separate crowd and judge votes

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: Neon Postgres via Vercel Postgres
- **Deployment**: Vercel
- **CLI**: tsx for TypeScript execution
