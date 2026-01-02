-- Schema for bottb database
-- Generated from production Vercel/Neon database

-- Users table for admin authentication
CREATE TABLE IF NOT EXISTS users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255),
    is_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    last_login timestamp with time zone
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id character varying(255),
    name character varying(255) NOT NULL,
    date timestamp with time zone NOT NULL,
    location character varying(255) NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    status character varying(20) DEFAULT 'upcoming'::character varying,
    info jsonb DEFAULT '{}'::jsonb,
    timezone character varying(64) DEFAULT 'Australia/Brisbane'::character varying NOT NULL,
    CONSTRAINT events_status_check CHECK (((status)::text = ANY ((ARRAY['upcoming'::character varying, 'voting'::character varying, 'finalized'::character varying])::text[])))
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    slug character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    logo_url text,
    website text,
    created_at timestamp with time zone DEFAULT now(),
    icon_url text
);

-- Photographers table
CREATE TABLE IF NOT EXISTS photographers (
    slug character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    bio text,
    location character varying(255),
    website text,
    instagram text,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    avatar_url text
);

-- Bands table
CREATE TABLE IF NOT EXISTS bands (
    id character varying(255),
    name character varying(255) NOT NULL,
    description text,
    "order" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    info jsonb DEFAULT '{}'::jsonb,
    event_id character varying(255),
    company_slug character varying(255)
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voter_type character varying(10) NOT NULL,
    song_choice integer,
    performance integer,
    crowd_vibe integer,
    crowd_vote integer,
    created_at timestamp with time zone DEFAULT now(),
    fingerprintjs_visitor_id character varying(255),
    fingerprintjs_confidence numeric(3,2),
    fingerprintjs_components text,
    vote_fingerprint character varying(64),
    ip_address inet,
    user_agent text,
    browser_name character varying(100),
    browser_version character varying(50),
    os_name character varying(100),
    os_version character varying(50),
    device_type character varying(50),
    screen_resolution character varying(20),
    timezone character varying(50),
    language character varying(10),
    google_click_id character varying(255),
    facebook_pixel_id character varying(255),
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(100),
    utm_term character varying(100),
    utm_content character varying(100),
    fingerprintjs_confidence_comment text,
    event_id character varying(255),
    band_id character varying(255),
    status character varying(20) DEFAULT 'approved'::character varying,
    email character varying(255),
    name character varying(255),
    visuals integer,
    CONSTRAINT votes_crowd_vibe_check CHECK (((crowd_vibe >= 0) AND (crowd_vibe <= 30))),
    CONSTRAINT votes_crowd_vote_check CHECK (((crowd_vote >= 0) AND (crowd_vote <= 20))),
    CONSTRAINT votes_performance_check CHECK (((performance >= 0) AND (performance <= 30))),
    CONSTRAINT votes_song_choice_check CHECK (((song_choice >= 0) AND (song_choice <= 20))),
    CONSTRAINT votes_status_check CHECK (((status)::text = ANY ((ARRAY['approved'::character varying, 'pending'::character varying])::text[]))),
    CONSTRAINT votes_visuals_check CHECK (((visuals >= 0) AND (visuals <= 20))),
    CONSTRAINT votes_voter_type_check CHECK (((voter_type)::text = ANY ((ARRAY['crowd'::character varying, 'judge'::character varying])::text[])))
);

-- Crowd noise measurements table
CREATE TABLE IF NOT EXISTS crowd_noise_measurements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    energy_level numeric(10,4) NOT NULL,
    peak_volume numeric(10,4) NOT NULL,
    recording_duration integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    crowd_score integer NOT NULL,
    event_id character varying(255),
    band_id character varying(255),
    CONSTRAINT crowd_noise_measurements_crowd_score_check CHECK (((crowd_score >= 1) AND (crowd_score <= 10))),
    CONSTRAINT crowd_noise_measurements_energy_level_check CHECK ((energy_level >= (0)::numeric)),
    CONSTRAINT crowd_noise_measurements_peak_volume_check CHECK ((peak_volume >= (0)::numeric)),
    CONSTRAINT crowd_noise_measurements_recording_duration_check CHECK ((recording_duration > 0))
);

-- Finalized results table
CREATE TABLE IF NOT EXISTS finalized_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id character varying(255) NOT NULL,
    band_id character varying(255) NOT NULL,
    band_name character varying(255) NOT NULL,
    final_rank integer NOT NULL,
    avg_song_choice numeric(10,2),
    avg_performance numeric(10,2),
    avg_crowd_vibe numeric(10,2),
    crowd_vote_count integer DEFAULT 0,
    judge_vote_count integer DEFAULT 0,
    total_crowd_votes integer DEFAULT 0,
    crowd_noise_energy numeric(10,4),
    crowd_noise_peak numeric(10,4),
    crowd_noise_score integer,
    judge_score numeric(10,2),
    crowd_score numeric(10,2),
    total_score numeric(10,2),
    finalized_at timestamp with time zone DEFAULT now(),
    avg_visuals numeric(10,2),
    visuals_score numeric(10,2)
);

-- Photos table
CREATE TABLE IF NOT EXISTS photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id character varying(255),
    band_id character varying(255),
    photographer character varying(255),
    blob_url text NOT NULL,
    blob_pathname text NOT NULL,
    original_filename character varying(255),
    width integer,
    height integer,
    file_size integer,
    content_type character varying(50),
    xmp_metadata jsonb,
    matched_event_name character varying(255),
    matched_band_name character varying(255),
    match_confidence character varying(20),
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    labels text[] DEFAULT '{}'::text[],
    hero_focal_point jsonb DEFAULT '{"x": 50, "y": 50}'::jsonb,
    captured_at timestamp with time zone,
    original_blob_url text,
    CONSTRAINT photos_match_confidence_check CHECK (((match_confidence)::text = ANY ((ARRAY['exact'::character varying, 'fuzzy'::character varying, 'manual'::character varying, 'unmatched'::character varying])::text[])))
);

-- Photo intelligence tables

-- Photo crops - Smart crop calculations for different aspect ratios
CREATE TABLE IF NOT EXISTS photo_crops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    aspect_ratio character varying(20) NOT NULL,
    crop_box jsonb NOT NULL,
    confidence numeric(5,4),
    method character varying(20),
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photo_crops_photo_id ON photo_crops(photo_id);
CREATE UNIQUE INDEX IF NOT EXISTS photo_crops_photo_aspect_unique ON photo_crops(photo_id, aspect_ratio);

-- Photo clusters - Groups of related photos (near-duplicates, scenes, people)
CREATE TABLE IF NOT EXISTS photo_clusters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_type character varying(20) NOT NULL,
    photo_ids uuid[] NOT NULL,
    representative_photo_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT photo_clusters_type_check CHECK ((cluster_type)::text = ANY ((ARRAY['near_duplicate'::character varying, 'scene'::character varying, 'person'::character varying])::text[]))
);
CREATE INDEX IF NOT EXISTS idx_photo_clusters_type ON photo_clusters(cluster_type);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    youtube_video_id character varying(20) NOT NULL,
    title character varying(255) NOT NULL,
    event_id character varying(255),
    band_id character varying(255),
    duration_seconds integer,
    thumbnail_url text,
    published_at timestamp with time zone,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Setlist songs table
CREATE TABLE IF NOT EXISTS setlist_songs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    band_id character varying(255) NOT NULL,
    "position" integer NOT NULL,
    song_type character varying(50) DEFAULT 'cover'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    artist character varying(255) NOT NULL,
    additional_songs jsonb DEFAULT '[]'::jsonb,
    transition_to_title character varying(255),
    transition_to_artist character varying(255),
    youtube_video_id character varying(50),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT setlist_songs_song_type_check CHECK (((song_type)::text = ANY ((ARRAY['cover'::character varying, 'mashup'::character varying, 'medley'::character varying, 'transition'::character varying])::text[]))),
    CONSTRAINT setlist_songs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'locked'::character varying, 'conflict'::character varying])::text[])))
);

-- Social accounts table
CREATE TABLE IF NOT EXISTS social_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider character varying(50) NOT NULL,
    provider_account_id character varying(255) NOT NULL,
    provider_account_name character varying(255),
    organization_urn character varying(255),
    page_id character varying(255),
    ig_business_account_id character varying(255),
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    scopes text[],
    status character varying(20) DEFAULT 'active'::character varying,
    last_error text,
    connected_by character varying(255),
    connected_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT social_accounts_provider_check CHECK (((provider)::text = ANY ((ARRAY['linkedin'::character varying, 'facebook'::character varying, 'instagram'::character varying, 'threads'::character varying])::text[]))),
    CONSTRAINT social_accounts_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'revoked'::character varying, 'error'::character varying])::text[])))
);

-- Social post templates table
CREATE TABLE IF NOT EXISTS social_post_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    title_template text,
    caption_template text,
    include_photographer_credit boolean DEFAULT true,
    include_event_link boolean DEFAULT true,
    default_hashtags text[],
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Social posts table
CREATE TABLE IF NOT EXISTS social_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    platforms text[] NOT NULL,
    title text,
    caption text NOT NULL,
    photo_ids uuid[] NOT NULL,
    event_id character varying(255),
    band_id character varying(255),
    template_id uuid,
    include_photographer_credit boolean DEFAULT true,
    include_event_link boolean DEFAULT true,
    hashtags text[],
    ig_collaborator_handles text[],
    ig_crop_info jsonb DEFAULT '{}'::jsonb,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_by character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT social_posts_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'partial'::character varying, 'failed'::character varying])::text[])))
);

-- Social post results table
CREATE TABLE IF NOT EXISTS social_post_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    platform character varying(50) NOT NULL,
    status character varying(20) NOT NULL,
    external_post_id character varying(255),
    external_post_url text,
    error_code character varying(100),
    error_message text,
    response_data jsonb,
    attempted_at timestamp with time zone DEFAULT now(),
    CONSTRAINT social_post_results_platform_check CHECK (((platform)::text = ANY ((ARRAY['linkedin'::character varying, 'facebook'::character varying, 'instagram'::character varying])::text[]))),
    CONSTRAINT social_post_results_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'success'::character varying, 'failed'::character varying])::text[])))
);

-- Primary key and unique constraints
ALTER TABLE ONLY users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY events ADD CONSTRAINT events_slug_unique UNIQUE (id);
ALTER TABLE ONLY companies ADD CONSTRAINT companies_pkey PRIMARY KEY (slug);
ALTER TABLE ONLY photographers ADD CONSTRAINT photographers_pkey PRIMARY KEY (slug);
ALTER TABLE ONLY bands ADD CONSTRAINT bands_slug_unique UNIQUE (id);
ALTER TABLE ONLY votes ADD CONSTRAINT votes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY votes ADD CONSTRAINT votes_vote_fingerprint_key UNIQUE (vote_fingerprint);
ALTER TABLE ONLY crowd_noise_measurements ADD CONSTRAINT crowd_noise_measurements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY crowd_noise_measurements ADD CONSTRAINT crowd_noise_measurements_event_band_unique UNIQUE (event_id, band_id);
ALTER TABLE ONLY finalized_results ADD CONSTRAINT finalized_results_pkey PRIMARY KEY (id);
ALTER TABLE ONLY finalized_results ADD CONSTRAINT finalized_results_event_id_band_id_key UNIQUE (event_id, band_id);
ALTER TABLE ONLY photos ADD CONSTRAINT photos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY videos ADD CONSTRAINT videos_pkey PRIMARY KEY (id);
ALTER TABLE ONLY videos ADD CONSTRAINT videos_youtube_video_id_key UNIQUE (youtube_video_id);
ALTER TABLE ONLY setlist_songs ADD CONSTRAINT setlist_songs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social_accounts ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social_accounts ADD CONSTRAINT social_accounts_provider_key UNIQUE (provider);
ALTER TABLE ONLY social_post_templates ADD CONSTRAINT social_post_templates_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social_posts ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social_post_results ADD CONSTRAINT social_post_results_pkey PRIMARY KEY (id);
ALTER TABLE ONLY social_post_results ADD CONSTRAINT social_post_results_post_id_platform_key UNIQUE (post_id, platform);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_events_info_gin ON events USING gin (info);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_photographers_name ON photographers(name);
CREATE INDEX IF NOT EXISTS idx_bands_event_id ON bands(event_id);
CREATE INDEX IF NOT EXISTS idx_bands_company_slug ON bands(company_slug);
CREATE INDEX IF NOT EXISTS idx_bands_info_gin ON bands USING gin (info);
CREATE INDEX IF NOT EXISTS idx_votes_event_id ON votes(event_id);
CREATE INDEX IF NOT EXISTS idx_votes_band_id ON votes(band_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_type ON votes(voter_type);
CREATE INDEX IF NOT EXISTS idx_votes_fingerprint ON votes(vote_fingerprint);
CREATE INDEX IF NOT EXISTS idx_votes_fingerprintjs_visitor_id ON votes(fingerprintjs_visitor_id);
CREATE INDEX IF NOT EXISTS idx_votes_ip_address ON votes(ip_address);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
CREATE INDEX IF NOT EXISTS idx_votes_email ON votes(email);
CREATE INDEX IF NOT EXISTS idx_crowd_noise_event_id ON crowd_noise_measurements(event_id);
CREATE INDEX IF NOT EXISTS idx_crowd_noise_band_id ON crowd_noise_measurements(band_id);
CREATE INDEX IF NOT EXISTS idx_crowd_noise_created_at ON crowd_noise_measurements(created_at);
CREATE INDEX IF NOT EXISTS idx_finalized_results_event_id ON finalized_results(event_id);
CREATE INDEX IF NOT EXISTS idx_finalized_results_band_id ON finalized_results(band_id);
CREATE INDEX IF NOT EXISTS idx_finalized_results_final_rank ON finalized_results(final_rank);
CREATE INDEX IF NOT EXISTS idx_photos_event_id ON photos(event_id);
CREATE INDEX IF NOT EXISTS idx_photos_band_id ON photos(band_id);
CREATE INDEX IF NOT EXISTS idx_photos_photographer ON photos(photographer);
CREATE INDEX IF NOT EXISTS idx_photos_labels ON photos USING gin(labels);
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at ON photos(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_photos_captured_at ON photos(captured_at);
CREATE INDEX IF NOT EXISTS idx_photos_original_blob_url ON photos(original_blob_url) WHERE (original_blob_url IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_videos_event_id ON videos(event_id);
CREATE INDEX IF NOT EXISTS idx_videos_band_id ON videos(band_id);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_video_id);
CREATE INDEX IF NOT EXISTS idx_videos_sort_order ON videos(sort_order);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_band_id ON setlist_songs(band_id);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_title ON setlist_songs(title);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_artist ON setlist_songs(artist);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_song_type ON setlist_songs(song_type);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_status ON setlist_songs(status);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_position ON setlist_songs("position");
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider ON social_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON social_accounts(status);
CREATE INDEX IF NOT EXISTS idx_social_post_templates_sort ON social_post_templates(sort_order);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_event ON social_posts(event_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_post_results_post ON social_post_results(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_results_platform ON social_post_results(platform);
CREATE INDEX IF NOT EXISTS idx_social_post_results_status ON social_post_results(status);

-- Foreign key constraints
ALTER TABLE ONLY bands ADD CONSTRAINT bands_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY votes ADD CONSTRAINT votes_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY votes ADD CONSTRAINT votes_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;
ALTER TABLE ONLY crowd_noise_measurements ADD CONSTRAINT crowd_noise_measurements_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY crowd_noise_measurements ADD CONSTRAINT crowd_noise_measurements_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;
ALTER TABLE ONLY finalized_results ADD CONSTRAINT finalized_results_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY finalized_results ADD CONSTRAINT finalized_results_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;
ALTER TABLE ONLY photos ADD CONSTRAINT photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY photos ADD CONSTRAINT photos_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;
ALTER TABLE ONLY photos ADD CONSTRAINT photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);
ALTER TABLE ONLY videos ADD CONSTRAINT videos_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE ONLY videos ADD CONSTRAINT videos_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE SET NULL;
ALTER TABLE ONLY setlist_songs ADD CONSTRAINT setlist_songs_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;
ALTER TABLE ONLY social_posts ADD CONSTRAINT social_posts_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE ONLY social_posts ADD CONSTRAINT social_posts_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE SET NULL;
ALTER TABLE ONLY social_posts ADD CONSTRAINT social_posts_template_id_fkey FOREIGN KEY (template_id) REFERENCES social_post_templates(id) ON DELETE SET NULL;
ALTER TABLE ONLY social_post_results ADD CONSTRAINT social_post_results_post_id_fkey FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;
