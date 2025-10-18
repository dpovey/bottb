import { sql } from "@vercel/postgres";
import {
  getEvents,
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandsForEvent,
  getVotesForEvent,
  submitVote,
  getEventById,
  getBandScores,
} from "../db";

// Helper function to create a proper QueryResult mock
const createMockQueryResult = <T>(rows: T[]) => ({
  rows,
  command: "SELECT",
  rowCount: rows.length,
  oid: 0,
  fields: [],
});

// Mock the @vercel/postgres module
jest.mock("@vercel/postgres", () => ({
  sql: jest.fn(),
}));

const mockSql = sql as jest.MockedFunction<typeof sql>;

describe("Database Functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getEvents", () => {
    it("returns all events ordered by date DESC", async () => {
      const mockEvents = [
        {
          id: "event-1",
          name: "Event 1",
          date: "2024-12-25T18:30:00Z",
          location: "Venue 1",
          is_active: true,
          status: "voting",
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "event-2",
          name: "Event 2",
          date: "2024-12-24T18:30:00Z",
          location: "Venue 2",
          is_active: false,
          status: "finalized",
          created_at: "2024-01-02T00:00:00Z",
        },
      ];

      mockSql.mockResolvedValue(createMockQueryResult(mockEvents));

      const result = await getEvents();

      expect(mockSql).toHaveBeenCalledWith([
        "SELECT * FROM events ORDER BY date DESC",
      ]);
      expect(result).toEqual(mockEvents);
    });

    it("returns empty array when no events exist", async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]));

      const result = await getEvents();

      expect(result).toEqual([]);
    });
  });

  describe("getActiveEvent", () => {
    it("returns the active event", async () => {
      const mockEvent = {
        id: "active-event-1",
        name: "Active Event",
        date: "2024-12-25T18:30:00Z",
        location: "Active Venue",
        is_active: true,
        status: "voting",
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSql.mockResolvedValue(createMockQueryResult([mockEvent]));

      const result = await getActiveEvent();

      expect(mockSql).toHaveBeenCalledWith([
        "SELECT * FROM events WHERE is_active = true LIMIT 1",
      ]);
      expect(result).toEqual(mockEvent);
    });

    it("returns null when no active event exists", async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]));

      const result = await getActiveEvent();

      expect(result).toBeNull();
    });
  });

  describe("getUpcomingEvents", () => {
    it("returns upcoming events ordered by date ASC", async () => {
      const mockEvents = [
        {
          id: "upcoming-1",
          name: "Upcoming Event 1",
          date: "2024-12-25T18:30:00Z",
          location: "Venue 1",
          is_active: false,
          status: "upcoming",
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockSql.mockResolvedValue(createMockQueryResult(mockEvents));

      const result = await getUpcomingEvents();

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringMatching(
            /SELECT \* FROM events\s+WHERE date >= NOW\(\)\s+ORDER BY date ASC/
          ),
        ])
      );
      expect(result).toEqual(mockEvents);
    });
  });

  describe("getPastEvents", () => {
    it("returns past events ordered by date DESC", async () => {
      const mockEvents = [
        {
          id: "past-1",
          name: "Past Event 1",
          date: "2023-12-25T18:30:00Z",
          location: "Venue 1",
          is_active: false,
          status: "finalized",
          created_at: "2023-01-01T00:00:00Z",
        },
      ];

      mockSql.mockResolvedValue(createMockQueryResult(mockEvents));

      const result = await getPastEvents();

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringMatching(
            /SELECT \* FROM events\s+WHERE date < NOW\(\)\s+ORDER BY date DESC/
          ),
        ])
      );
      expect(result).toEqual(mockEvents);
    });
  });

  describe("getBandsForEvent", () => {
    it("returns bands for a specific event ordered by order", async () => {
      const eventId = "event-1";
      const mockBands = [
        {
          id: "band-1",
          event_id: eventId,
          name: "Band 1",
          description: "Description 1",
          order: 1,
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "band-2",
          event_id: eventId,
          name: "Band 2",
          description: "Description 2",
          order: 2,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockSql.mockResolvedValue(createMockQueryResult(mockBands));

      const result = await getBandsForEvent(eventId);

      expect(mockSql).toHaveBeenCalledWith(
        ["SELECT * FROM bands WHERE event_id = ", ' ORDER BY "order"'],
        eventId
      );
      expect(result).toEqual(mockBands);
    });
  });

  describe("getVotesForEvent", () => {
    it("returns votes for a specific event", async () => {
      const eventId = "event-1";
      const mockVotes = [
        {
          id: "vote-1",
          event_id: eventId,
          band_id: "band-1",
          voter_type: "crowd",
          song_choice: null,
          performance: null,
          crowd_vibe: null,
          crowd_vote: 20,
          created_at: "2024-01-01T00:00:00Z",
        },
      ];

      mockSql.mockResolvedValue(createMockQueryResult(mockVotes));

      const result = await getVotesForEvent(eventId);

      expect(mockSql).toHaveBeenCalledWith(
        ["SELECT * FROM votes WHERE event_id = ", ""],
        eventId
      );
      expect(result).toEqual(mockVotes);
    });
  });

  describe("submitVote", () => {
    it("submits a vote and returns the created vote", async () => {
      const voteData = {
        event_id: "event-1",
        band_id: "band-1",
        voter_type: "crowd" as const,
        song_choice: undefined,
        performance: undefined,
        crowd_vibe: undefined,
        crowd_vote: 20,
      };

      const mockVote = {
        id: "vote-1",
        ...voteData,
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSql.mockResolvedValue(createMockQueryResult([mockVote]));

      const result = await submitVote(voteData);

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringMatching(/INSERT INTO votes/)]),
        "event-1", // event_id
        "band-1", // band_id
        "crowd", // voter_type
        undefined, // song_choice
        undefined, // performance
        undefined, // crowd_vibe
        20, // crowd_vote
        undefined, // ip_address
        undefined, // user_agent
        undefined, // browser_name
        undefined, // browser_version
        undefined, // os_name
        undefined, // os_version
        undefined, // device_type
        undefined, // screen_resolution
        undefined, // timezone
        undefined, // language
        undefined, // google_click_id
        undefined, // facebook_pixel_id
        undefined, // utm_source
        undefined, // utm_medium
        undefined, // utm_campaign
        undefined, // utm_term
        undefined, // utm_content
        undefined, // vote_fingerprint
        undefined, // fingerprintjs_visitor_id
        undefined, // fingerprintjs_confidence
        undefined // fingerprintjs_confidence_comment
      );
      expect(result).toEqual(mockVote);
    });
  });

  describe("getEventById", () => {
    it("returns event by id", async () => {
      const eventId = "event-1";
      const mockEvent = {
        id: eventId,
        name: "Test Event",
        date: "2024-12-25T18:30:00Z",
        location: "Test Venue",
        is_active: true,
        status: "voting",
        created_at: "2024-01-01T00:00:00Z",
      };

      mockSql.mockResolvedValue(createMockQueryResult([mockEvent]));

      const result = await getEventById(eventId);

      expect(mockSql).toHaveBeenCalledWith(
        ["\n    SELECT * FROM events WHERE id = ", "\n  "],
        eventId
      );
      expect(result).toEqual(mockEvent);
    });

    it("returns null when event not found", async () => {
      const eventId = "nonexistent-event";
      mockSql.mockResolvedValue(createMockQueryResult([]));

      const result = await getEventById(eventId);

      expect(result).toBeNull();
    });
  });

  describe("getBandScores", () => {
    it("returns band scores with aggregated data", async () => {
      const eventId = "event-1";
      const mockScores = [
        {
          id: "band-1",
          name: "Band 1",
          order: 1,
          avg_song_choice: 15.5,
          avg_performance: 25.0,
          avg_crowd_vibe: 22.5,
          avg_crowd_vote: 18.0,
          crowd_vote_count: 10,
          judge_vote_count: 3,
          total_crowd_votes: 50,
        },
      ];

      mockSql.mockResolvedValue(createMockQueryResult(mockScores));

      const result = await getBandScores(eventId);

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringMatching(/WITH total_votes AS/)]),
        eventId,
        eventId,
        eventId
      );
      expect(result).toEqual(mockScores);
    });
  });
});
