-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'voting', 'finalized')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bands table
CREATE TABLE IF NOT EXISTS bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  voter_type VARCHAR(10) NOT NULL CHECK (voter_type IN ('crowd', 'judge')),
  song_choice INTEGER CHECK (song_choice >= 0 AND song_choice <= 20),
  performance INTEGER CHECK (performance >= 0 AND performance <= 30),
  crowd_vibe INTEGER CHECK (crowd_vibe >= 0 AND crowd_vibe <= 30),
  crowd_vote INTEGER CHECK (crowd_vote >= 0 AND crowd_vote <= 20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bands_event_id ON bands(event_id);
CREATE INDEX IF NOT EXISTS idx_votes_event_id ON votes(event_id);
CREATE INDEX IF NOT EXISTS idx_votes_band_id ON votes(band_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_type ON votes(voter_type);

