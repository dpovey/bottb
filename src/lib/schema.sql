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
    description text,
    CONSTRAINT events_status_check CHECK (((status)::text = ANY ((ARRAY['upcoming'::character varying, 'voting'::character varying, 'finalized'::character varying])::text[])))
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    slug character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    logo_url text,
    website text,
    created_at timestamp with time zone DEFAULT now(),
    icon_url text,
    description text
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

-- Band <-> company join (multi-company bands; bands.company_slug is the primary/lead)
CREATE TABLE IF NOT EXISTS band_companies (
    band_id character varying(255) NOT NULL,
    company_slug character varying(255) NOT NULL,
    is_primary boolean NOT NULL DEFAULT false,
    "position" integer NOT NULL DEFAULT 0
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
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
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
    is_monochrome boolean DEFAULT NULL,
    -- SEO-friendly slug (e.g., "the-fuggles-brisbane-2024-1")
    slug character varying(255) UNIQUE,
    -- Prefix for sequence grouping (e.g., "the-fuggles-brisbane-2024")
    slug_prefix character varying(255),
    -- Visibility: new uploads default to 'private' (admin-only); admins release to 'public'
    visibility character varying(20) DEFAULT 'private' NOT NULL,
    -- Public heart (like) count; kept in sync with the photo_hearts table
    heart_count integer DEFAULT 0 NOT NULL,
    -- Total download count (not deduped); admin-only metric
    download_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT photos_match_confidence_check CHECK (((match_confidence)::text = ANY ((ARRAY['exact'::character varying, 'fuzzy'::character varying, 'manual'::character varying, 'unmatched'::character varying])::text[]))),
    CONSTRAINT photos_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['private'::character varying, 'public'::character varying])::text[])))
);

CREATE INDEX IF NOT EXISTS idx_photos_visibility ON photos (visibility);

-- Photo hearts - one row per (photo, anonymous visitor) for deduped likes
CREATE TABLE IF NOT EXISTS photo_hearts (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    photo_id uuid NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    -- FingerprintJS visitor id when available, else the server vote_fingerprint hash
    visitor_key character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    -- The composite unique index has photo_id as its leading column, so it
    -- also serves per-photo lookups; no separate photo_id index is needed.
    CONSTRAINT photo_hearts_photo_visitor_unique UNIQUE (photo_id, visitor_key)
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
-- GIN index for array containment queries (p.id = ANY(pc.photo_ids))
CREATE INDEX IF NOT EXISTS idx_photo_clusters_photo_ids_gin ON photo_clusters USING gin(photo_ids);
-- Index for representative photo lookups
CREATE INDEX IF NOT EXISTS idx_photo_clusters_representative ON photo_clusters(representative_photo_id) WHERE (representative_photo_id IS NOT NULL);

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
    created_at timestamp with time zone DEFAULT now(),
    video_type character varying(20) DEFAULT 'video'::character varying NOT NULL,
    CONSTRAINT videos_video_type_check CHECK (((video_type)::text = ANY ((ARRAY['video'::character varying, 'short'::character varying])::text[])))
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
    artist_description text,
    spotify_track_id character varying(50),
    cover_artist character varying(255),
    CONSTRAINT setlist_songs_song_type_check CHECK (((song_type)::text = ANY ((ARRAY['cover'::character varying, 'mashup'::character varying, 'medley'::character varying, 'transition'::character varying])::text[]))),
    CONSTRAINT setlist_songs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'locked'::character varying, 'conflict'::character varying])::text[])))
);

-- Artist metadata table (caches MusicBrainz data for setlist artists)
CREATE TABLE IF NOT EXISTS artist_metadata (
    artist_name_normalized character varying(255) NOT NULL PRIMARY KEY,
    display_name character varying(255) NOT NULL,
    musicbrainz_id character varying(36),
    formed_year integer,
    country character varying(100),
    genres text[],
    description text,
    spotify_artist_id character varying(50),
    first_performed_at character varying(255),
    total_performances integer DEFAULT 0,
    fetched_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
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
ALTER TABLE ONLY band_companies ADD CONSTRAINT band_companies_pkey PRIMARY KEY (band_id, company_slug);
ALTER TABLE ONLY votes ADD CONSTRAINT votes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY votes ADD CONSTRAINT votes_vote_fingerprint_key UNIQUE (vote_fingerprint);
ALTER TABLE ONLY crowd_noise_measurements ADD CONSTRAINT crowd_noise_measurements_pkey PRIMARY KEY (id);
ALTER TABLE ONLY crowd_noise_measurements ADD CONSTRAINT crowd_noise_measurements_event_band_unique UNIQUE (event_id, band_id);
ALTER TABLE ONLY finalized_results ADD CONSTRAINT finalized_results_pkey PRIMARY KEY (id);
ALTER TABLE ONLY finalized_results ADD CONSTRAINT finalized_results_event_id_band_id_key UNIQUE (event_id, band_id);
-- photos_pkey is defined inline in CREATE TABLE
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
CREATE INDEX IF NOT EXISTS idx_band_companies_company ON band_companies(company_slug);
CREATE UNIQUE INDEX IF NOT EXISTS uq_band_companies_primary ON band_companies(band_id) WHERE is_primary;
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
CREATE INDEX IF NOT EXISTS idx_photos_is_monochrome ON photos(is_monochrome) WHERE (is_monochrome IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_photos_original_blob_url ON photos(original_blob_url) WHERE (original_blob_url IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_photos_slug ON photos(slug) WHERE (slug IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_photos_slug_prefix ON photos(slug_prefix) WHERE (slug_prefix IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_videos_event_id ON videos(event_id);
CREATE INDEX IF NOT EXISTS idx_videos_band_id ON videos(band_id);
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_video_id);
CREATE INDEX IF NOT EXISTS idx_videos_sort_order ON videos(sort_order);
CREATE INDEX IF NOT EXISTS idx_videos_video_type ON videos(video_type);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_band_id ON setlist_songs(band_id);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_title ON setlist_songs(title);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_artist ON setlist_songs(artist);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_song_type ON setlist_songs(song_type);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_status ON setlist_songs(status);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_position ON setlist_songs("position");
CREATE INDEX IF NOT EXISTS idx_setlist_songs_spotify_track_id ON setlist_songs(spotify_track_id) WHERE (spotify_track_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_artist_metadata_display_name ON artist_metadata(display_name);
CREATE INDEX IF NOT EXISTS idx_artist_metadata_musicbrainz_id ON artist_metadata(musicbrainz_id) WHERE (musicbrainz_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_artist_metadata_spotify_artist_id ON artist_metadata(spotify_artist_id) WHERE (spotify_artist_id IS NOT NULL);
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
ALTER TABLE ONLY bands ADD CONSTRAINT bands_company_slug_fkey FOREIGN KEY (company_slug) REFERENCES companies(slug) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE ONLY band_companies ADD CONSTRAINT band_companies_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE CASCADE;
ALTER TABLE ONLY band_companies ADD CONSTRAINT band_companies_company_slug_fkey FOREIGN KEY (company_slug) REFERENCES companies(slug) ON DELETE CASCADE ON UPDATE CASCADE;
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

-- Merchandise shop orders (one row per paid Stripe Checkout Session)
CREATE TABLE IF NOT EXISTS merch_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    stripe_session_id character varying(255) NOT NULL,
    stripe_payment_intent_id character varying(255),
    product character varying(64) NOT NULL,
    items jsonb DEFAULT '[]' NOT NULL,
    size character varying(8),
    quantity integer NOT NULL,
    amount_subtotal integer NOT NULL,
    amount_shipping integer DEFAULT 0 NOT NULL,
    amount_total integer NOT NULL,
    currency character varying(8) DEFAULT 'aud' NOT NULL,
    customer_name character varying(255),
    customer_email character varying(255),
    customer_phone character varying(64),
    shipping_address jsonb,
    status character varying(20) DEFAULT 'paid' NOT NULL,
    fulfillment_emailed_at timestamp with time zone,
    invoice_emailed_at timestamp with time zone,
    fulfilled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY merch_orders ADD CONSTRAINT merch_orders_stripe_session_id_unique UNIQUE (stripe_session_id);
CREATE INDEX idx_merch_orders_status_created ON merch_orders (status, created_at);

-- Videographers (mirrors photographers). A videographer shoots a whole event,
-- so they are linked to events via the event_videographers join table.
CREATE TABLE IF NOT EXISTS videographers (
    slug character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    bio text,
    location character varying(255),
    website text,
    instagram text,
    email text,
    avatar_url text,
    role character varying(60) DEFAULT 'Videographer'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY videographers ADD CONSTRAINT videographers_pkey PRIMARY KEY (slug);
CREATE INDEX IF NOT EXISTS idx_videographers_name ON videographers(name);

CREATE TABLE IF NOT EXISTS event_videographers (
    event_id character varying(255) NOT NULL,
    videographer_slug character varying(255) NOT NULL
);
ALTER TABLE ONLY event_videographers ADD CONSTRAINT event_videographers_pkey PRIMARY KEY (event_id, videographer_slug);
CREATE INDEX IF NOT EXISTS idx_event_videographers_slug ON event_videographers(videographer_slug);
ALTER TABLE ONLY event_videographers ADD CONSTRAINT event_videographers_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY event_videographers ADD CONSTRAINT event_videographers_videographer_slug_fkey FOREIGN KEY (videographer_slug) REFERENCES videographers(slug) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Social parties and handles
--
-- Social accounts are shared nationally (one Facebook page, one Instagram,
-- one TikTok, one YouTube channel across every city), so handles are neither
-- per-event nor per-city. They are also not a companies concern: sponsors,
-- charities, venues, photographers and videographers all need the same
-- per-platform information and only some of them are companies.
--
-- social_handles.status distinguishes:
--   'active'  - they have an account and this is it
--   'none'    - somebody looked and they genuinely have no account here
--   'unknown' - somebody looked and could not tell
--   (no row)  - nobody has ever checked
--
-- mention_name holds the full name a platform's typeahead needs. LinkedIn
-- matches on the name as LinkedIn holds it: "Jumbo Interactive Limited"
-- resolves, "Jumbo Interactive" silently returns nothing.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS social_parties (
    slug character varying(255) NOT NULL,
    kind character varying(20) NOT NULL,
    name character varying(255) NOT NULL,
    company_slug character varying(255),
    photographer_slug character varying(255),
    videographer_slug character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_parties_kind_check CHECK (kind::text = ANY (ARRAY['self','company','charity','venue','sponsor','partner','photographer','videographer','person']::text[]))
);
ALTER TABLE ONLY social_parties ADD CONSTRAINT social_parties_pkey PRIMARY KEY (slug);
ALTER TABLE ONLY social_parties ADD CONSTRAINT social_parties_company_slug_fkey FOREIGN KEY (company_slug) REFERENCES companies(slug) ON DELETE SET NULL;
ALTER TABLE ONLY social_parties ADD CONSTRAINT social_parties_photographer_slug_fkey FOREIGN KEY (photographer_slug) REFERENCES photographers(slug) ON DELETE SET NULL;
ALTER TABLE ONLY social_parties ADD CONSTRAINT social_parties_videographer_slug_fkey FOREIGN KEY (videographer_slug) REFERENCES videographers(slug) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS social_parties_kind_index ON social_parties(kind);
CREATE INDEX IF NOT EXISTS social_parties_company_slug_index ON social_parties(company_slug);

CREATE TABLE IF NOT EXISTS social_handles (
    party_slug character varying(255) NOT NULL,
    platform character varying(20) NOT NULL,
    status character varying(10) DEFAULT 'unknown'::character varying NOT NULL,
    handle character varying(255),
    mention_name character varying(255),
    url text,
    external_id character varying(64),
    collab_policy character varying(10) DEFAULT 'unknown'::character varying NOT NULL,
    verified_at timestamp with time zone,
    verified_by character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT social_handles_platform_check CHECK (platform::text = ANY (ARRAY['facebook','instagram','linkedin','tiktok','youtube','threads']::text[])),
    CONSTRAINT social_handles_status_check CHECK (status::text = ANY (ARRAY['active','none','unknown']::text[])),
    CONSTRAINT social_handles_collab_policy_check CHECK (collab_policy::text = ANY (ARRAY['yes','never','unknown','n/a']::text[])),
    CONSTRAINT social_handles_active_has_identity_check CHECK (status::text <> 'active' OR handle IS NOT NULL OR mention_name IS NOT NULL OR external_id IS NOT NULL)
);
ALTER TABLE ONLY social_handles ADD CONSTRAINT social_handles_pkey PRIMARY KEY (party_slug, platform);
ALTER TABLE ONLY social_handles ADD CONSTRAINT social_handles_party_slug_fkey FOREIGN KEY (party_slug) REFERENCES social_parties(slug) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS social_handles_platform_index ON social_handles(platform);

-- Who is credited on a given event's posts. `kind` is what a party
-- intrinsically is; `role` is what it did at this event. Jumbo Interactive is
-- a company (kind) that was both national sponsor and a band's company (two
-- roles) at Brisbane 2026.
CREATE TABLE IF NOT EXISTS event_parties (
    event_id character varying(255) NOT NULL,
    party_slug character varying(255) NOT NULL,
    role character varying(40) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_parties_role_check CHECK (role::text = ANY (ARRAY['host','national-sponsor','sponsor','charity','venue','band-company','photographer','videographer','partner','crew','judge']::text[]))
);
ALTER TABLE ONLY event_parties ADD CONSTRAINT event_parties_pkey PRIMARY KEY (event_id, party_slug, role);
ALTER TABLE ONLY event_parties ADD CONSTRAINT event_parties_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE ONLY event_parties ADD CONSTRAINT event_parties_party_slug_fkey FOREIGN KEY (party_slug) REFERENCES social_parties(slug) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS event_parties_party_slug_index ON event_parties(party_slug);

-- Flat, one-row-per-party view of the handles, so simple lookups stay simple.
CREATE OR REPLACE VIEW party_handles AS
SELECT
  p.slug AS party_slug,
  p.kind,
  p.name,
  p.company_slug,
  p.photographer_slug,
  p.videographer_slug,
  MAX(h.status) FILTER (WHERE h.platform = 'linkedin') AS linkedin_status,
  MAX(h.handle) FILTER (WHERE h.platform = 'linkedin') AS linkedin_handle,
  MAX(h.mention_name) FILTER (WHERE h.platform = 'linkedin') AS linkedin_mention_name,
  MAX(h.url) FILTER (WHERE h.platform = 'linkedin') AS linkedin_url,
  MAX(h.collab_policy) FILTER (WHERE h.platform = 'linkedin') AS linkedin_collab_policy,
  MAX(h.status) FILTER (WHERE h.platform = 'facebook') AS facebook_status,
  MAX(h.handle) FILTER (WHERE h.platform = 'facebook') AS facebook_handle,
  MAX(h.mention_name) FILTER (WHERE h.platform = 'facebook') AS facebook_mention_name,
  MAX(h.url) FILTER (WHERE h.platform = 'facebook') AS facebook_url,
  MAX(h.collab_policy) FILTER (WHERE h.platform = 'facebook') AS facebook_collab_policy,
  MAX(h.status) FILTER (WHERE h.platform = 'instagram') AS instagram_status,
  MAX(h.handle) FILTER (WHERE h.platform = 'instagram') AS instagram_handle,
  MAX(h.mention_name) FILTER (WHERE h.platform = 'instagram') AS instagram_mention_name,
  MAX(h.url) FILTER (WHERE h.platform = 'instagram') AS instagram_url,
  MAX(h.collab_policy) FILTER (WHERE h.platform = 'instagram') AS instagram_collab_policy,
  MAX(h.status) FILTER (WHERE h.platform = 'tiktok') AS tiktok_status,
  MAX(h.handle) FILTER (WHERE h.platform = 'tiktok') AS tiktok_handle,
  MAX(h.mention_name) FILTER (WHERE h.platform = 'tiktok') AS tiktok_mention_name,
  MAX(h.url) FILTER (WHERE h.platform = 'tiktok') AS tiktok_url,
  MAX(h.collab_policy) FILTER (WHERE h.platform = 'tiktok') AS tiktok_collab_policy,
  MAX(h.status) FILTER (WHERE h.platform = 'youtube') AS youtube_status,
  MAX(h.handle) FILTER (WHERE h.platform = 'youtube') AS youtube_handle,
  MAX(h.mention_name) FILTER (WHERE h.platform = 'youtube') AS youtube_mention_name,
  MAX(h.url) FILTER (WHERE h.platform = 'youtube') AS youtube_url,
  MAX(h.collab_policy) FILTER (WHERE h.platform = 'youtube') AS youtube_collab_policy
FROM social_parties p
LEFT JOIN social_handles h ON h.party_slug = p.slug
GROUP BY p.slug, p.kind, p.name, p.company_slug, p.photographer_slug, p.videographer_slug;

-- The column ergonomics, keyed by company.
-- ph.* already carries company_slug, so selecting c.slug under the same name
-- would make CREATE VIEW fail on a duplicate column.
CREATE OR REPLACE VIEW company_handles AS
SELECT
  c.name AS company_name,
  ph.*
FROM companies c
JOIN party_handles ph ON ph.company_slug = c.slug;

-- ---------------------------------------------------------------------------
-- posts: one row per publication per platform.
--
-- Distinct from social_posts/social_post_results, which are the admin UI's
-- queue (a submitted job and its per-platform attempts). `posts` records what
-- is actually live on a platform, however it got there - Graph API, a browser
-- drag, a native platform scheduler, or a human.
--
-- posted_at_estimated says whether posted_at was read back from the platform
-- or inferred from a schedule. Those are different kinds of fact.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_key character varying(255),
    platform character varying(20) NOT NULL,
    external_id character varying(128),
    permalink text,
    status character varying(20) DEFAULT 'scheduled'::character varying NOT NULL,
    content_type character varying(20),
    event_id character varying(255),
    band_id character varying(255),
    video_id uuid,
    photo_ids uuid[],
    title text,
    caption text,
    collaborators text[],
    mentions text[],
    media_url text,
    scheduled_for timestamp with time zone,
    posted_at timestamp with time zone,
    posted_at_estimated boolean DEFAULT false NOT NULL,
    posted_tz character varying(64),
    posted_via character varying(20),
    permalink_verified_at timestamp with time zone,
    -- UTM tagging so social reach joins to website analytics in PostHog.
    -- utm_campaign is the event slug (joins to events.id); utm_source is the
    -- platform; utm_medium distinguishes LINK PLACEMENT ('social',
    -- 'social_bio', 'social_story') because Instagram captions are not
    -- clickable; utm_content is a per-post slug and is what makes a specific
    -- post attributable. Historical posts have none - leave them null.
    utm_campaign character varying(120),
    utm_source character varying(60),
    utm_medium character varying(60),
    utm_content character varying(120),
    source character varying(64),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT posts_platform_check CHECK (platform::text = ANY (ARRAY['facebook','instagram','linkedin','tiktok','youtube','threads']::text[])),
    CONSTRAINT posts_status_check CHECK (status::text = ANY (ARRAY['scheduled','published','withdrawn','deleted','failed']::text[])),
    CONSTRAINT posts_content_type_check CHECK (content_type IS NULL OR content_type::text = ANY (ARRAY['reel','short','video','photo','carousel','story','text','link']::text[])),
    -- Deliberately NOT constrained: a published post with a null posted_at.
    -- "It is live and nobody wrote down when" is a real state, and forcing a
    -- time would only make somebody invent one. posted_at_estimated carries
    -- the distinction that matters.
    CONSTRAINT posts_posted_via_check CHECK (posted_via IS NULL OR posted_via::text = ANY (ARRAY['api','browser','manual','native_schedule']::text[]))
);
ALTER TABLE ONLY posts ADD CONSTRAINT posts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY posts ADD CONSTRAINT posts_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE ONLY posts ADD CONSTRAINT posts_band_id_fkey FOREIGN KEY (band_id) REFERENCES bands(id) ON DELETE SET NULL;
ALTER TABLE ONLY posts ADD CONSTRAINT posts_video_id_fkey FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS posts_platform_external_id_key ON posts(platform, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS posts_permalink_key ON posts(permalink) WHERE permalink IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_group_key_index ON posts(group_key);
CREATE INDEX IF NOT EXISTS posts_event_id_index ON posts(event_id);
CREATE INDEX IF NOT EXISTS posts_band_id_index ON posts(band_id);
CREATE INDEX IF NOT EXISTS posts_status_index ON posts(status);
CREATE INDEX IF NOT EXISTS posts_platform_posted_at_idx ON posts(platform, posted_at);
CREATE INDEX IF NOT EXISTS posts_utm_campaign_index ON posts(utm_campaign);
CREATE UNIQUE INDEX IF NOT EXISTS posts_utm_content_key ON posts(utm_campaign, utm_content) WHERE utm_content IS NOT NULL;

CREATE OR REPLACE FUNCTION posts_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION posts_set_updated_at();
