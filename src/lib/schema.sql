-- Users table for admin authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  location VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'voting', 'finalized')),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bands table
CREATE TABLE IF NOT EXISTS bands (
  id VARCHAR(255) PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  "order" INTEGER NOT NULL,
  image_url TEXT,
  info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  band_id VARCHAR(255) NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  voter_type VARCHAR(10) NOT NULL CHECK (voter_type IN ('crowd', 'judge')),
  song_choice INTEGER CHECK (song_choice >= 0 AND song_choice <= 20),
  performance INTEGER CHECK (performance >= 0 AND performance <= 30),
  crowd_vibe INTEGER CHECK (crowd_vibe >= 0 AND crowd_vibe <= 30),
  crowd_vote INTEGER CHECK (crowd_vote >= 0 AND crowd_vote <= 20),
  -- Visuals score (2026.1 scoring only) - costumes, backdrops, visual presentation
  visuals INTEGER CHECK (visuals >= 0 AND visuals <= 20),
  -- User context fields
  ip_address INET,
  user_agent TEXT,
  browser_name VARCHAR(100),
  browser_version VARCHAR(50),
  os_name VARCHAR(100),
  os_version VARCHAR(50),
  device_type VARCHAR(50),
  screen_resolution VARCHAR(20),
  timezone VARCHAR(50),
  language VARCHAR(10),
  -- Tracking IDs
  google_click_id VARCHAR(255),
  facebook_pixel_id VARCHAR(255),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  utm_term VARCHAR(100),
  utm_content VARCHAR(100),
  -- Vote fingerprint for duplicate detection
  vote_fingerprint VARCHAR(64) UNIQUE,
          -- FingerprintJS fields
          fingerprintjs_visitor_id VARCHAR(255),
          fingerprintjs_confidence DECIMAL(3,2),
          fingerprintjs_confidence_comment TEXT,
  -- Optional email for voter
  email VARCHAR(255),
  -- Optional name for judge
  name VARCHAR(255),
  -- Vote status for duplicate handling
  status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('approved', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_bands_event_id ON bands(event_id);
CREATE INDEX IF NOT EXISTS idx_votes_event_id ON votes(event_id);
CREATE INDEX IF NOT EXISTS idx_votes_band_id ON votes(band_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_type ON votes(voter_type);
CREATE INDEX IF NOT EXISTS idx_votes_fingerprint ON votes(vote_fingerprint);
CREATE INDEX IF NOT EXISTS idx_votes_ip_address ON votes(ip_address);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);

-- Crowd noise measurements table
CREATE TABLE IF NOT EXISTS crowd_noise_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  band_id VARCHAR(255) NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  energy_level DECIMAL(10,4) NOT NULL CHECK (energy_level >= 0),
  peak_volume DECIMAL(10,4) NOT NULL CHECK (peak_volume >= 0),
  recording_duration INTEGER NOT NULL CHECK (recording_duration > 0),
  crowd_score INTEGER NOT NULL CHECK (crowd_score >= 1 AND crowd_score <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, band_id)
);

-- Indexes for crowd noise measurements
CREATE INDEX IF NOT EXISTS idx_crowd_noise_event_id ON crowd_noise_measurements(event_id);
CREATE INDEX IF NOT EXISTS idx_crowd_noise_band_id ON crowd_noise_measurements(band_id);
CREATE INDEX IF NOT EXISTS idx_crowd_noise_created_at ON crowd_noise_measurements(created_at);
CREATE INDEX IF NOT EXISTS idx_votes_fingerprintjs_visitor_id ON votes(fingerprintjs_visitor_id);

-- Finalized results table (snapshot of results when event is finalized)
CREATE TABLE IF NOT EXISTS finalized_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  band_id VARCHAR(255) NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  band_name VARCHAR(255) NOT NULL,
  final_rank INTEGER NOT NULL,
  -- Raw judge averages
  avg_song_choice DECIMAL(10,2),
  avg_performance DECIMAL(10,2),
  avg_crowd_vibe DECIMAL(10,2),
  avg_visuals DECIMAL(10,2),  -- 2026.1 scoring
  -- Vote counts
  crowd_vote_count INTEGER DEFAULT 0,
  judge_vote_count INTEGER DEFAULT 0,
  total_crowd_votes INTEGER DEFAULT 0,
  -- Crowd noise data (2025.1 scoring)
  crowd_noise_energy DECIMAL(10,4),
  crowd_noise_peak DECIMAL(10,4),
  crowd_noise_score INTEGER,
  -- Calculated scores
  judge_score DECIMAL(10,2),
  crowd_score DECIMAL(10,2),
  visuals_score DECIMAL(10,2),  -- 2026.1 scoring
  total_score DECIMAL(10,2),
  -- Metadata
  finalized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, band_id)
);

-- Indexes for finalized results
CREATE INDEX IF NOT EXISTS idx_finalized_results_event_id ON finalized_results(event_id);
CREATE INDEX IF NOT EXISTS idx_finalized_results_band_id ON finalized_results(band_id);
CREATE INDEX IF NOT EXISTS idx_finalized_results_final_rank ON finalized_results(final_rank);

-- JSONB indexes for bands info
CREATE INDEX IF NOT EXISTS idx_bands_info_gin ON bands USING GIN (info);
-- Use btree for text extraction instead of GIN
CREATE INDEX IF NOT EXISTS idx_bands_info_logo ON bands ((info->>'logo_url'));

