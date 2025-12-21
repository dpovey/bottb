import { unstable_cache } from "next/cache";
import { getPastEventsWithWinners, getUpcomingEvents, getCompanies, getCompanyBySlug, getCompanyBands, getEvents, getBands, getDistinctCompanies, getVideos, type CompanyWithStats, type Company, type Band, type Video } from "./db";

export interface NavEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  status: "upcoming" | "voting" | "finalized";
  info?: {
    winner?: string;
    winner_company_slug?: string;
    winner_company_name?: string;
    winner_company_icon_url?: string;
    [key: string]: unknown;
  };
}

interface EventInfo {
  winner?: string;
  winner_company_slug?: string;
  winner_company_name?: string;
  winner_company_icon_url?: string;
  [key: string]: unknown;
}

/**
 * Get events for navigation dropdown - cached for 5 minutes
 */
export const getNavEvents = unstable_cache(
  async (): Promise<{ upcoming: NavEvent[]; past: NavEvent[] }> => {
    const [pastEventsRaw, upcomingEvents] = await Promise.all([
      getPastEventsWithWinners(),
      getUpcomingEvents(),
    ]);

    // Process past events to merge winner info into info object
    const pastEvents = pastEventsRaw.map((event) => {
      const eventInfo = event.info as EventInfo | null;

      if (event.winner_band_name) {
        return {
          id: event.id,
          name: event.name,
          date: event.date,
          location: event.location,
          status: event.status,
          info: {
            ...eventInfo,
            winner: event.winner_band_name,
            winner_company_slug: event.winner_company_slug,
            winner_company_name: event.winner_company_name,
            winner_company_icon_url: event.winner_company_icon_url,
          },
        } as NavEvent;
      }

      return {
        id: event.id,
        name: event.name,
        date: event.date,
        location: event.location,
        status: event.status,
        info: eventInfo,
      } as NavEvent;
    });

    // Sort past events by date descending and take first 5
    const sortedPast = pastEvents
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return {
      upcoming: upcomingEvents.map((e) => ({
        id: e.id,
        name: e.name,
        date: e.date,
        location: e.location,
        status: e.status,
        info: e.info as EventInfo | undefined,
      })),
      past: sortedPast,
    };
  },
  ["nav-events"],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ["nav-events"],
  }
);

/**
 * Get all companies with stats - cached for 5 minutes
 */
export const getCachedCompanies = unstable_cache(
  async (): Promise<CompanyWithStats[]> => {
    return getCompanies();
  },
  ["companies"],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ["companies"],
  }
);

export interface CompanyBand extends Band {
  event_name: string;
  event_date: string;
}

/**
 * Get company details with bands - cached for 5 minutes
 */
export const getCachedCompanyWithBands = unstable_cache(
  async (slug: string): Promise<{ company: Company | null; bands: CompanyBand[] }> => {
    const [company, bands] = await Promise.all([
      getCompanyBySlug(slug),
      getCompanyBands(slug),
    ]);
    return { company, bands: bands as CompanyBand[] };
  },
  ["company-with-bands"],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ["companies"],
  }
);

// ============================================================
// Filter Options (for Photos/Videos pages)
// ============================================================

export interface FilterOptions {
  events: Array<{ id: string; name: string; date: string }>;
  bands: Array<{ id: string; name: string; event_id: string; company_slug?: string }>;
  companies: Array<{ slug: string; name: string }>;
}

/**
 * Get filter options for photos/videos pages - cached for 5 minutes
 */
export const getCachedFilterOptions = unstable_cache(
  async (): Promise<FilterOptions> => {
    const [events, bands, companies] = await Promise.all([
      getEvents(),
      getBands(),
      getDistinctCompanies(),
    ]);

    // Sort events by date descending
    const sortedEvents = events
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((e) => ({ id: e.id, name: e.name, date: e.date }));

    return {
      events: sortedEvents,
      bands: bands.map((b) => ({
        id: b.id,
        name: b.name,
        event_id: b.event_id,
        company_slug: b.company_slug,
      })),
      companies,
    };
  },
  ["filter-options"],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ["filter-options"],
  }
);

// ============================================================
// Videos Data
// ============================================================

export interface VideosData {
  videos: Video[];
  filterOptions: FilterOptions;
}

/**
 * Get videos with filter options - cached for 5 minutes
 */
export const getCachedVideosData = unstable_cache(
  async (eventId?: string, bandId?: string): Promise<VideosData> => {
    const [videos, filterOptions] = await Promise.all([
      getVideos({ eventId, bandId, limit: 100 }),
      getCachedFilterOptions(),
    ]);

    return { videos, filterOptions };
  },
  ["videos-data"],
  {
    revalidate: 300, // Cache for 5 minutes
    tags: ["videos"],
  }
);

