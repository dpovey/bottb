"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { SetlistSong, SongType } from "@/lib/db";
import { CompanyBadge } from "@/components/ui";
import { PublicLayout } from "@/components/layouts/public-layout";

interface SongsPageClientProps {
  events: { id: string; name: string }[];
  companies: { slug: string; name: string }[];
}

type SortField = "title" | "artist" | "event" | "band";
type SortDirection = "asc" | "desc";

export function SongsPageClient({ events, companies }: SongsPageClientProps) {
  const [songs, setSongs] = useState<SetlistSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<SongType | "">("");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 50;

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch songs
  const fetchSongs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventFilter) params.set("event", eventFilter);
      if (typeFilter) params.set("type", typeFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const response = await fetch(`/api/songs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setSongs(data.songs);
        setTotal(data.pagination.total);
      }
    } catch (error) {
      console.error("Error fetching songs:", error);
    } finally {
      setIsLoading(false);
    }
  }, [eventFilter, typeFilter, debouncedSearch, page]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // Filter songs by company (client-side since it's not in the API)
  const filteredSongs = companyFilter
    ? songs.filter((s) => s.company_slug === companyFilter)
    : songs;

  // Sort songs
  const sortedSongs = [...filteredSongs].sort((a, b) => {
    let aVal = "";
    let bVal = "";

    switch (sortField) {
      case "title":
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
        break;
      case "artist":
        aVal = a.artist.toLowerCase();
        bVal = b.artist.toLowerCase();
        break;
      case "event":
        aVal = a.event_date || "";
        bVal = b.event_date || "";
        break;
      case "band":
        aVal = (a.band_name || "").toLowerCase();
        bVal = (b.band_name || "").toLowerCase();
        break;
    }

    if (sortDirection === "asc") {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  const totalPages = Math.ceil(total / limit);

  const getSongTypeLabel = (type: string) => {
    const labels: Record<string, { text: string; className: string }> = {
      cover: {
        text: "Cover",
        className: "bg-white/10 text-text-muted border border-white/10",
      },
      mashup: {
        text: "Mashup",
        className: "bg-accent/20 text-accent border border-accent/30",
      },
      medley: {
        text: "Medley",
        className: "bg-info/20 text-info border border-info/30",
      },
      transition: {
        text: "Transition",
        className: "bg-success/20 text-success border border-success/30",
      },
    };
    return labels[type] || labels.cover;
  };

  const clearFilters = () => {
    setSearch("");
    setEventFilter("");
    setCompanyFilter("");
    setTypeFilter("");
    setPage(1);
  };

  const hasActiveFilters = search || eventFilter || companyFilter || typeFilter;

  return (
    <PublicLayout
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Songs" }]}
      footerVariant="simple"
    >
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-semibold mb-4">All Songs</h1>
          <p className="text-text-muted text-lg max-w-2xl">
            Every song performed across all Battle of the Tech Bands events.
            Filter by event, band, company, or song type.
          </p>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-dim"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search songs, artists, bands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-bg-elevated border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-text-dim focus:outline-none focus:border-accent/50"
            />
          </div>

          {/* Event Filter */}
          <select
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value);
              setPage(1);
            }}
            className="bg-bg-elevated border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent/50 min-w-[180px]"
          >
            <option value="">All Events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>

          {/* Company Filter */}
          <select
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setPage(1);
            }}
            className="bg-bg-elevated border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent/50 min-w-[150px]"
          >
            <option value="">All Companies</option>
            {companies.map((company) => (
              <option key={company.slug} value={company.slug}>
                {company.name}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as SongType | "");
              setPage(1);
            }}
            className="bg-bg-elevated border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-accent/50 min-w-[130px]"
          >
            <option value="">All Types</option>
            <option value="cover">Cover</option>
            <option value="mashup">Mashup</option>
            <option value="medley">Medley</option>
            <option value="transition">Transition</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results Count & Sort */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-text-muted text-sm">
            {isLoading ? (
              "Loading..."
            ) : (
              <>
                Showing{" "}
                <span className="text-white">{sortedSongs.length}</span>{" "}
                {total !== sortedSongs.length && (
                  <>of {total} </>
                )}
                songs
              </>
            )}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Sort by:</span>
            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split("-");
                setSortField(field as SortField);
                setSortDirection(dir as SortDirection);
              }}
              className="bg-transparent border-none text-white focus:outline-none cursor-pointer"
            >
              <option value="title-asc">Song Name (A-Z)</option>
              <option value="title-desc">Song Name (Z-A)</option>
              <option value="artist-asc">Artist (A-Z)</option>
              <option value="artist-desc">Artist (Z-A)</option>
              <option value="event-desc">Event Date (Newest)</option>
              <option value="event-asc">Event Date (Oldest)</option>
              <option value="band-asc">Band Name (A-Z)</option>
              <option value="band-desc">Band Name (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Songs Table */}
        <div className="bg-bg-elevated rounded-xl border border-white/5 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-text-muted">
              Loading songs...
            </div>
          ) : sortedSongs.length === 0 ? (
            <div className="p-12 text-center text-text-muted">
              <p className="text-lg mb-2">No songs found</p>
              <p className="text-sm">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Songs will appear here after events are finalized"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    <th className="px-6 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">
                      Song
                    </th>
                    <th className="px-6 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">
                      Artist(s)
                    </th>
                    <th className="px-6 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">
                      Type
                    </th>
                    <th className="px-6 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">
                      Band
                    </th>
                    <th className="px-6 py-4 text-xs tracking-widest uppercase text-text-muted font-medium">
                      Event
                    </th>
                    <th className="px-6 py-4 text-xs tracking-widest uppercase text-text-muted font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedSongs.map((song) => {
                    const typeLabel = getSongTypeLabel(song.song_type);

                    return (
                      <tr
                        key={song.id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="font-medium">{song.title}</span>
                          {song.song_type === "transition" &&
                            song.transition_to_title && (
                              <span className="text-text-dim">
                                {" "}
                                → {song.transition_to_title}
                              </span>
                            )}
                        </td>
                        <td className="px-6 py-4 text-text-muted">
                          {song.artist}
                          {song.song_type === "transition" &&
                            song.transition_to_artist && (
                              <> / {song.transition_to_artist}</>
                            )}
                          {song.additional_songs &&
                            song.additional_songs.length > 0 && (
                              <>
                                {" "}+ {song.additional_songs.length} more
                              </>
                            )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${typeLabel.className}`}
                          >
                            {typeLabel.text}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/band/${song.band_id}`}
                            className="flex items-center gap-2 text-text-muted hover:text-white transition-colors"
                          >
                            {song.company_slug && song.company_name && (
                              <CompanyBadge
                                slug={song.company_slug}
                                name={song.company_name}
                                iconUrl={song.company_icon_url}
                                size="sm"
                              />
                            )}
                            <span>{song.band_name}</span>
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          {song.event_id && song.event_name && (
                            <Link
                              href={`/event/${song.event_id}`}
                              className="text-text-muted hover:text-accent transition-colors"
                            >
                              {song.event_name}
                            </Link>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {song.youtube_video_id && (
                            <a
                              href={`https://www.youtube.com/watch?v=${song.youtube_video_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-white/10 transition-colors text-text-muted hover:text-accent inline-block"
                              title="Watch video"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                              </svg>
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </PublicLayout>
  );
}

