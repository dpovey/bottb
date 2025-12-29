# Songs Requirements

![Songs Table](../screenshots/songs-table.png)

## Song Data

- song_title, artist
- song_type: cover, mashup, medley, transition
- position (order in setlist)
- secondary_artist/secondary_song (for mashups/transitions)
- video_url (YouTube)

## Song Types

| Type       | Display                  | Example               |
| ---------- | ------------------------ | --------------------- |
| Cover      | Song • Artist            | "Africa" • Toto       |
| Mashup     | Song 1 / Song 2          | "Titanium / Stronger" |
| Medley     | Song 1 / Song 2 / Song 3 | "80s Medley"          |
| Transition | Song 1 → Song 2          | "Rain → Umbrella"     |

## All Songs Page `/songs`

### Filter Bar

- Search input (title, artist)
- Event, band, type filters
- Clear filters button

### Data Table

- Song title (link to song detail page)
- Artist (link to artist page)
- Song type badge
- Band name (link)
- Event name (link)
- Sortable columns

## Artist Page `/songs/[artist]`

Shows all songs by a specific artist performed at BOTTB events.

- Header with artist name
- Count of songs performed
- List of songs with:
  - Song title (link to song detail)
  - Performance count
  - List of bands/events that performed it

## Song Detail Page `/songs/[artist]/[song]`

Shows all performances of a specific song.

- Header with song title and artist (clickable)
- Breadcrumbs: Home > Songs > Artist > Song
- Performance count
- List of performances with:
  - Company badge
  - Band name (link)
  - Event name and date (link)
  - Song type badge
- YouTube links section (if available)

## Setlist Display (Band Page)

- Numbered position indicators
- Song title formatted by type
- Artist(s)
- Type badge
- Video link button

## Admin Setlist Editor

- Band selector/tabs
- Song list with drag handles
- Drag to reorder
- Edit modal: title, artist, type, secondary fields, video URL
- Delete with confirmation
- Add new song button
