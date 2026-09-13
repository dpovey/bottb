# YouTube description templates — draft for Dean to edit

Status: **draft, not applied.** Nothing has been changed on the channel except three Melbourne
videos whose descriptions wrongly said the event was in Sydney.

Placeholders are `{{like_this}}`. Anything in _italics_ is a note to you, not part of the text.

---

## Why change anything

Four concrete problems with the current descriptions, in payoff order:

1. **The first ~150 characters are wasted.** That is what appears in search results, in the sidebar,
   and above the "...more" fold. Ours currently restate the title, which the viewer has already read.
2. **Every video is a dead end.** No links to the full set, the band's other songs, or the playlist.
   Session duration is what YouTube actually rewards, and we give it nothing to work with.
3. **No timestamps.** On a 21–28 minute full set this is the biggest single miss — timestamps become
   chapters, which improve retention and give search more to index.
4. **No company names beyond the one band.** People search for their employer. A description that
   names the other competing companies is how someone who searched "SEEK" finds the rest of BoTTB.

Two things NOT worth doing: hashtags in descriptions do very little, and keyword stuffing is
actively penalised. The paragraphs below should read like a human wrote them, because they will.

**Bigger than any of this:** as far as I can tell the channel has no playlists. 77 videos, no
per-event or per-band grouping. That is probably worth more than every description edit combined.

---

## Template A — single song (the common case, ~35 videos)

```
{{band}} — {{company}}'s house band — play {{artist}}'s "{{song}}" live at Battle of the
Tech Bands {{city}} {{year}}, {{venue}}, {{date}}.

Battle of the Tech Bands is Australia's tech-industry band competition: house bands from
{{other_companies_this_event}} compete live on a real stage, raising money for Youngcare.
{{band_hook}}

▶ {{band}}'s full set: {{full_set_url}}
▶ All {{city}} {{year}} videos: {{event_playlist_url}}
▶ Next event — {{next_city}}, {{next_date}}, {{next_venue}}: {{ticket_url}}

{{#if_timestamps}}
00:00 {{section}}
{{/if_timestamps}}

Filmed by {{videographer_credits}}.
Proudly powered by {{sponsor}}. All proceeds to Youngcare — youngcare.com.au
More at battleofthetechbands.com
```

_`{{band_hook}}` is one sentence of something only someone in the room would know — the erhu, the
LED masks, the sixteen-year-old drummer. Leave it out rather than invent one._

---

## Template B — full set (the 21–28 minute videos)

Same opening, then **timestamps are mandatory**. This is where they matter most.

```
{{band}} — {{company}}'s house band — full set at Battle of the Tech Bands {{city}} {{year}},
{{venue}}, {{date}}. {{placing_if_notable}}

Battle of the Tech Bands is Australia's tech-industry band competition: house bands from
{{other_companies_this_event}} compete live on a real stage, raising money for Youngcare.
{{band_hook}}

Setlist:
00:00 {{song_1}} ({{artist_1}})
{{mm:ss}} {{song_2}} ({{artist_2}})
...

▶ Individual songs from this set: {{band_playlist_url}}
▶ All {{city}} {{year}} videos: {{event_playlist_url}}
▶ Next event — {{next_city}}, {{next_date}}, {{next_venue}}: {{ticket_url}}

Filmed by {{videographer_credits}}.
Proudly powered by {{sponsor}}. All proceeds to Youngcare — youngcare.com.au
More at battleofthetechbands.com
```

_We already have accurate song-start times for Brisbane 2026 in `video-post-learnings.md`. For other
events they would need deriving._

---

## Template C — Shorts (~37 videos)

Different rules. Shorts are surfaced by the feed, not by search, and the description is barely
visible. Keep it to two lines and spend the effort on the title instead.

```
{{band}} ({{company}}) at Battle of the Tech Bands {{city}} {{year}}. {{one_detail}}
Full video: {{full_video_url}} · battleofthetechbands.com
```

---

## Worked example (Template A, real data)

> Fully SEEK — SEEK's house band — play Teddy Swims' "Lose Control" live at Battle of the Tech
> Bands Melbourne 2026, The Howler, Brunswick, 5 June 2026.
>
> Battle of the Tech Bands is Australia's tech-industry band competition: house bands from SEEK,
> REA Group, Mentorloop, Jumbo Interactive and Open Universities Australia compete live on a real
> stage, raising money for Youngcare.
>
> ▶ Fully SEEK's full set: {{url}}
> ▶ All Melbourne 2026 videos: {{playlist}}
> ▶ Next event — Sydney, 8 October 2026, Manning Bar: {{tickets}}
>
> Proudly powered by Jumbo Interactive. All proceeds to Youngcare — youngcare.com.au
> More at battleofthetechbands.com

Compare with what is live now:

> Lose Control - (Teddy Swims Cover) SEEK @ 2026 Melbourne Battle of the Tech Bands
>
> SEEK's band "Fully SEEK" recorded live at the Battle of the Tech Bands 2026 in Melbourne.
> Venue: The Howler, Brunswick - 5 June 2026.

---

## Titles

Worth a pass of their own. The current pattern is decent but inconsistent — some lead with the
artist, some with the band, one has a double space, one had "Teddy SwimsCover".

Suggested: `{{artist}} - {{song}} (Live Cover) - {{band}} ({{company}}) - BoTTB {{city}} {{year}}`

_Front-loading the artist and song is right: that is what people search for. The band and company
earn their place after. Keep under ~70 characters or it truncates._

---

## Open questions for you

1. **Playlists** — worth creating per event and per band? I think yes, and ahead of description edits.
2. **Does every video get the "what is BoTTB" paragraph**, or only the ones likely to be found cold?
   Repeating it across 77 videos is duplicate-ish text; YouTube tolerates it, but it is a judgement call.
3. **Videographer credits** — on every video, or only the full videos they shot? The runbook says
   video posts credit them; unclear whether that extends to descriptions on older material.
4. **Do we backfill all 77**, or apply going forward and fix only the worst offenders?
5. **`{{band_hook}}`** — I would rather leave it blank than write one from a guess. Some of these
   bands I know nothing about beyond the title.
