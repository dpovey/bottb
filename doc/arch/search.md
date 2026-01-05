# Search Architecture

Client-side search powered by Orama, with build-time index generation.

## Overview

Search enables users to find events, bands, songs, companies, and static pages across the site. The search index is generated at build time from database content and static pages.

## Stack

- **Engine**: [Orama](https://orama.com/) - lightweight client-side search (~15KB)
- **Index**: JSON file generated at build time (`public/search-index.json`)
- **UI**: Modal dialog with keyboard navigation

## Key Files

| File                                      | Purpose                                           |
| ----------------------------------------- | ------------------------------------------------- |
| `src/scripts/build-search-index.ts`       | Generates search index from DB + static content   |
| `src/components/search/search-dialog.tsx` | Search modal UI                                   |
| `src/components/search/use-search.ts`     | Search state hook (open/close, keyboard shortcut) |
| `public/search-index.json`                | Generated index (gitignored)                      |

## Index Generation

Run manually or as part of build:

```bash
pnpm build:search-index
```

### Indexed Content

| Type          | Source               | Fields                            |
| ------------- | -------------------- | --------------------------------- |
| Events        | `getEvents()`        | name, location, description       |
| Bands         | `getBands()`         | name, company, description, genre |
| Songs         | `getAllSongs()`      | title, artist, band               |
| Companies     | `getCompanies()`     | name, description                 |
| Photographers | `getPhotographers()` | name, bio, location               |
| Videos        | `getVideos()`        | title, band, event                |
| Pages         | Hardcoded            | About, FAQ, Privacy, Terms, etc.  |

### Document Schema

```typescript
interface SearchDocument {
  id: string // Unique ID (e.g., "event-sydney-2025")
  title: string // Display title
  content: string // Searchable text
  type: string // event, band, song, company, photographer, page, video
  url: string // Navigation target
  subtitle?: string // Secondary text (e.g., artist for songs)
  image?: string // Optional thumbnail
}
```

## Search UI

### Keyboard Shortcuts

- `⌘K` / `Ctrl+K` - Open search
- `↑` / `↓` - Navigate results
- `Enter` - Go to selected result
- `Escape` - Close

### Features

- Fuzzy matching (typo-tolerant)
- Title boosting (2x weight)
- Match snippets shown for content matches
- Debounced input (150ms)
- Keyboard navigation with visual highlight

## Integration

### Header Button

Icon-only button with platform-aware tooltip:

- Mac: "Search (⌘K)"
- Windows/Linux: "Search (Ctrl+K)"

### Search Provider

Wrap app with search context (already in layout):

```tsx
<SearchProvider>
  <Header />
  <SearchDialog />
</SearchProvider>
```

## Build Process

1. `build:search-index` script runs before deploy
2. Fetches all indexable content from database
3. Creates Orama database with schema
4. Serializes to JSON in `public/`
5. Client loads and restores index on first search

## Performance

- Index size: ~240KB for ~100 documents
- Load time: ~50ms (lazy loaded on first search open)
- Search time: <10ms (client-side)

## Future Considerations

- Server-side search for very large indexes
- Incremental index updates
- Search analytics (popular queries)
