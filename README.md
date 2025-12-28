# Battle of the Tech Bands

A voting and scoring system for tech band competitions, built with Next.js 16 and Neon Postgres.

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd bottb

# Install dependencies
npm install

# Copy environment variables
cp env.example .env.local
# Edit .env.local with your database credentials

# Set up the database
npm run setup-db

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Features

- **Crowd Voting**: Mobile-friendly QR code voting for audience members
- **Judge Scoring**: Multi-criteria scoring for event judges
- **Real-time Results**: Live and finalized results with winner announcements
- **Photo Gallery**: Event photo management with slideshow
- **Admin Dashboard**: Event lifecycle and content management
- **Design System**: Component library with Storybook

## Documentation

Comprehensive documentation is available in the `/doc` directory:

| Section                               | Description                                     |
| ------------------------------------- | ----------------------------------------------- |
| **[Architecture](doc/arch/)**         | System design, module documentation, data flow  |
| **[Practices](doc/practices/)**       | TypeScript, React, Next.js, styling conventions |
| **[Testing](doc/testing/)**           | Testing strategy, patterns, and tools           |
| **[Requirements](doc/requirements/)** | Feature specifications and acceptance criteria  |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Client: React 19 + Next.js 16 App Router                    │
├─────────────────────────────────────────────────────────────┤
│ API: Next.js Route Handlers + NextAuth.js                   │
├─────────────────────────────────────────────────────────────┤
│ Data: Neon Postgres + Vercel Blob Storage                   │
└─────────────────────────────────────────────────────────────┘
```

See [Architecture documentation](doc/arch/) for detailed module documentation.

## Development

### Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server

# Quality
npm run format:check     # Check formatting
npm run typecheck        # TypeScript check
npm run lint             # ESLint
npm test                 # Run tests

# Storybook
npm run storybook        # Component development
npm run chromatic        # Visual regression tests

# CLI Tools
npm run create-event     # Create event from JSON
npm run list-events      # List all events
npm run manage-users     # Admin user management
```

### Design System

Browse the interactive design system at `/design-system` or run Storybook:

```bash
npm run storybook
```

See [DESIGN.md](DESIGN.md) for design tokens and component guidelines.

### Pre-Commit Checklist

All checks must pass before committing:

```bash
npm run format:check   # Prettier
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm test               # Tests
```

## Tech Stack

| Layer          | Technology               |
| -------------- | ------------------------ |
| Framework      | Next.js 16, React 19     |
| Language       | TypeScript (strict mode) |
| Styling        | Tailwind CSS 4           |
| Database       | Neon Postgres            |
| Auth           | NextAuth.js v5           |
| Storage        | Vercel Blob              |
| Testing        | Vitest, RTL, Playwright  |
| Visual Testing | Storybook, Chromatic     |

## Project Structure

```
src/
├── app/           # Next.js App Router pages
│   ├── api/       # API route handlers
│   ├── admin/     # Admin dashboard
│   └── ...        # Public pages
├── components/    # React components
│   ├── ui/        # Primitive UI components
│   ├── icons/     # SVG icon components
│   └── ...        # Feature components
├── lib/           # Shared utilities
│   └── db.ts      # Database access
└── scripts/       # CLI tools
```

## Event Workflow

```
1. Create event:     npm run create-event events/event.json
2. Activate voting:  npm run activate-event <event-id>
3. Run event:        Share QR codes for voting
4. Finalize:         npm run finalize-event <event-id>
```

## Scoring System

| Category    | Points  | Description   |
| ----------- | ------- | ------------- |
| Song Choice | 20      | Judge average |
| Performance | 30      | Judge average |
| Crowd Vibe  | 30      | Judge average |
| Crowd Vote  | 20      | Proportional  |
| **Total**   | **100** |               |

## Environment Variables

Required environment variables (see `env.example`):

```bash
# Database (Neon Postgres)
POSTGRES_URL=...
POSTGRES_URL_NON_POOLING=...

# Authentication
AUTH_SECRET=...  # openssl rand -base64 32

# Analytics (optional)
NEXT_PUBLIC_POSTHOG_KEY=...
```

## Contributing

1. Read the [Architecture](doc/arch/) and [Practices](doc/practices/) documentation
2. Follow the pre-commit checklist
3. Write tests for new functionality
4. Add Storybook stories for new components

## License

Private - All rights reserved
