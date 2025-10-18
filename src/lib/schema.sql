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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
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
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  voter_type VARCHAR(10) NOT NULL CHECK (voter_type IN ('crowd', 'judge')),
  song_choice INTEGER CHECK (song_choice >= 0 AND song_choice <= 20),
  performance INTEGER CHECK (performance >= 0 AND performance <= 30),
  crowd_vibe INTEGER CHECK (crowd_vibe >= 0 AND crowd_vibe <= 30),
  crowd_vote INTEGER CHECK (crowd_vote >= 0 AND crowd_vote <= 20),
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
CREATE INDEX IF NOT EXISTS idx_votes_fingerprintjs_visitor_id ON votes(fingerprintjs_visitor_id);

-- JSONB indexes for bands info
CREATE INDEX IF NOT EXISTS idx_bands_info_gin ON bands USING GIN (info);
CREATE INDEX IF NOT EXISTS idx_bands_info_logo ON bands USING GIN ((info->>'logo_url'));

