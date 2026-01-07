--
-- PostgreSQL database dump
--

\restrict LcNtE41inI6gwlmyOk4mC3UsYJTH2GkQDJwyHwhOoecIfncR2Rx8cFpS0x3f9DG

-- Dumped from database version 17.7
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: test
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO test;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: test
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bands; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.bands (
    id character varying(255),
    name character varying(255) NOT NULL,
    description text,
    "order" integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    info jsonb DEFAULT '{}'::jsonb,
    event_id character varying(255),
    company_slug character varying(255)
);


ALTER TABLE public.bands OWNER TO test;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.companies (
    slug character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    logo_url text,
    website text,
    created_at timestamp with time zone DEFAULT now(),
    icon_url text
);


ALTER TABLE public.companies OWNER TO test;

--
-- Name: crowd_noise_measurements; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.crowd_noise_measurements (
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


ALTER TABLE public.crowd_noise_measurements OWNER TO test;

--
-- Name: events; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.events (
    id character varying(255),
    name character varying(255) NOT NULL,
    date timestamp with time zone NOT NULL,
    location character varying(255) NOT NULL,
    is_active boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    status character varying(20) DEFAULT 'upcoming'::character varying,
    info jsonb DEFAULT '{}'::jsonb,
    timezone character varying(64) DEFAULT 'Australia/Brisbane'::character varying NOT NULL,
    CONSTRAINT events_status_check CHECK (((status)::text = ANY (ARRAY[('upcoming'::character varying)::text, ('voting'::character varying)::text, ('finalized'::character varying)::text])))
);


ALTER TABLE public.events OWNER TO test;

--
-- Name: finalized_results; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.finalized_results (
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


ALTER TABLE public.finalized_results OWNER TO test;

--
-- Name: photo_clusters; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.photo_clusters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cluster_type character varying(20) NOT NULL,
    photo_ids uuid[] NOT NULL,
    representative_photo_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT photo_clusters_type_check CHECK (((cluster_type)::text = ANY (ARRAY[('near_duplicate'::character varying)::text, ('scene'::character varying)::text, ('person'::character varying)::text])))
);


ALTER TABLE public.photo_clusters OWNER TO test;

--
-- Name: photo_crops; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.photo_crops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    photo_id uuid NOT NULL,
    aspect_ratio character varying(20) NOT NULL,
    crop_box jsonb NOT NULL,
    confidence numeric(5,4),
    method character varying(20),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.photo_crops OWNER TO test;

--
-- Name: photographers; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.photographers (
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


ALTER TABLE public.photographers OWNER TO test;

--
-- Name: photos; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.photos (
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
    is_monochrome boolean DEFAULT NULL,
    slug character varying(255),
    slug_prefix character varying(255),
    CONSTRAINT photos_match_confidence_check CHECK (((match_confidence)::text = ANY (ARRAY[('exact'::character varying)::text, ('fuzzy'::character varying)::text, ('manual'::character varying)::text, ('unmatched'::character varying)::text])))
);


ALTER TABLE public.photos OWNER TO test;

--
-- Name: setlist_songs; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.setlist_songs (
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
    CONSTRAINT setlist_songs_song_type_check CHECK (((song_type)::text = ANY (ARRAY[('cover'::character varying)::text, ('mashup'::character varying)::text, ('medley'::character varying)::text, ('transition'::character varying)::text]))),
    CONSTRAINT setlist_songs_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('locked'::character varying)::text, ('conflict'::character varying)::text])))
);


ALTER TABLE public.setlist_songs OWNER TO test;

--
-- Name: social_accounts; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.social_accounts (
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
    CONSTRAINT social_accounts_provider_check CHECK (((provider)::text = ANY (ARRAY[('linkedin'::character varying)::text, ('facebook'::character varying)::text, ('instagram'::character varying)::text, ('threads'::character varying)::text]))),
    CONSTRAINT social_accounts_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('expired'::character varying)::text, ('revoked'::character varying)::text, ('error'::character varying)::text])))
);


ALTER TABLE public.social_accounts OWNER TO test;

--
-- Name: social_post_results; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.social_post_results (
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
    CONSTRAINT social_post_results_platform_check CHECK (((platform)::text = ANY (ARRAY[('linkedin'::character varying)::text, ('facebook'::character varying)::text, ('instagram'::character varying)::text]))),
    CONSTRAINT social_post_results_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('success'::character varying)::text, ('failed'::character varying)::text])))
);


ALTER TABLE public.social_post_results OWNER TO test;

--
-- Name: social_post_templates; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.social_post_templates (
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


ALTER TABLE public.social_post_templates OWNER TO test;

--
-- Name: social_posts; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.social_posts (
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
    CONSTRAINT social_posts_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text, ('partial'::character varying)::text, ('failed'::character varying)::text])))
);


ALTER TABLE public.social_posts OWNER TO test;

--
-- Name: users; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255),
    is_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    last_login timestamp with time zone
);


ALTER TABLE public.users OWNER TO test;

--
-- Name: videos; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.videos (
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


ALTER TABLE public.videos OWNER TO test;

--
-- Name: votes; Type: TABLE; Schema: public; Owner: test
--

CREATE TABLE public.votes (
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
    CONSTRAINT votes_status_check CHECK (((status)::text = ANY (ARRAY[('approved'::character varying)::text, ('pending'::character varying)::text]))),
    CONSTRAINT votes_visuals_check CHECK (((visuals >= 0) AND (visuals <= 20))),
    CONSTRAINT votes_voter_type_check CHECK (((voter_type)::text = ANY (ARRAY[('crowd'::character varying)::text, ('judge'::character varying)::text])))
);


ALTER TABLE public.votes OWNER TO test;

--
-- Data for Name: bands; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.bands (id, name, description, "order", created_at, info, event_id, company_slug) FROM stdin;
test-band-1	The Code Rockers	Frontend specialists who know how to make the crowd dance	1	2026-01-03 02:57:54.451411+00	{"genre": "Rock", "logo_url": "/images/test/thumbnail-1.jpg"}	test-voting-event	atlassian
test-band-2	Database Divas	Backend engineers with killer vocals	2	2026-01-03 02:57:54.452421+00	{"genre": "Pop Rock", "logo_url": "/images/test/thumbnail-2.jpg"}	test-voting-event	canva
test-band-3	API Avengers	Full-stack superheroes of the tech world	3	2026-01-03 02:57:54.452925+00	{"genre": "Alternative", "logo_url": "/images/test/thumbnail-1.jpg"}	test-voting-event	google
test-finalized-band-1	Cloud Crusaders	DevOps warriors with epic stage presence	1	2026-01-03 02:57:54.453372+00	{"genre": "Metal", "logo_url": "/images/test/thumbnail-1.jpg"}	test-finalized-event	atlassian
test-finalized-band-2	Algorithm Angels	Data scientists who rock the algorithms	2	2026-01-03 02:57:54.453783+00	{"genre": "Indie", "logo_url": "/images/test/thumbnail-2.jpg"}	test-finalized-event	canva
test-upcoming-band-1	Syntax Error	Debugging by day, rocking by night	1	2026-01-03 02:57:54.454191+00	{"genre": "Punk", "logo_url": "/images/test/thumbnail-1.jpg"}	test-upcoming-event	google
test-upcoming-band-2	Null Pointers	Exception handlers of rock and roll	2	2026-01-03 02:57:54.454751+00	{"genre": "Grunge", "logo_url": "/images/test/thumbnail-2.jpg"}	test-upcoming-event	atlassian
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.companies (slug, name, logo_url, website, created_at, icon_url) FROM stdin;
atlassian	Atlassian	/images/test/thumbnail-1.jpg	https://atlassian.com	2026-01-03 02:57:54.447751+00	/images/test/thumbnail-1.jpg
canva	Canva	/images/test/thumbnail-2.jpg	https://canva.com	2026-01-03 02:57:54.44935+00	/images/test/thumbnail-2.jpg
google	Google	/images/test/thumbnail-1.jpg	https://google.com	2026-01-03 02:57:54.449972+00	/images/test/thumbnail-1.jpg
\.


--
-- Data for Name: crowd_noise_measurements; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.crowd_noise_measurements (id, energy_level, peak_volume, recording_duration, created_at, crowd_score, event_id, band_id) FROM stdin;
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.events (id, name, date, location, is_active, created_at, status, info, timezone) FROM stdin;
test-upcoming-event	Sydney Tech Battle 2025	2025-06-15 08:00:00+00	Sydney Convention Centre	f	2026-01-03 02:57:54.444875+00	upcoming	{}	Australia/Sydney
test-voting-event	Brisbane Rock Night 2025	2025-03-20 08:00:00+00	Brisbane Powerhouse	t	2026-01-03 02:57:54.445828+00	voting	{}	Australia/Brisbane
test-finalized-event	Melbourne Tech Bands 2024	2024-11-15 08:00:00+00	Melbourne Arts Centre	f	2026-01-03 02:57:54.446584+00	finalized	{}	Australia/Melbourne
\.


--
-- Data for Name: finalized_results; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.finalized_results (id, event_id, band_id, band_name, final_rank, avg_song_choice, avg_performance, avg_crowd_vibe, crowd_vote_count, judge_vote_count, total_crowd_votes, crowd_noise_energy, crowd_noise_peak, crowd_noise_score, judge_score, crowd_score, total_score, finalized_at, avg_visuals, visuals_score) FROM stdin;
09a251f7-b726-4419-9c8b-077d7c4f6c0e	test-finalized-event	test-finalized-band-1	Cloud Crusaders	1	17.00	26.00	24.50	3	2	5	\N	\N	\N	67.50	18.00	85.50	2026-01-03 02:57:54.465816+00	\N	\N
2263d30f-26b8-4fad-8adf-d1afe584f773	test-finalized-event	test-finalized-band-2	Algorithm Angels	2	14.50	21.50	19.50	2	2	5	\N	\N	\N	55.50	14.50	70.00	2026-01-03 02:57:54.466884+00	\N	\N
\.


--
-- Data for Name: photo_clusters; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.photo_clusters (id, cluster_type, photo_ids, representative_photo_id, metadata, created_at) FROM stdin;
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	near_duplicate	{11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222}	11111111-1111-1111-1111-111111111111	\N	2026-01-03 02:57:54.467415+00
bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	scene	{33333333-3333-3333-3333-333333333333,44444444-4444-4444-4444-444444444444,55555555-5555-5555-5555-555555555555}	33333333-3333-3333-3333-333333333333	\N	2026-01-03 02:57:54.467978+00
\.


--
-- Data for Name: photo_crops; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.photo_crops (id, photo_id, aspect_ratio, crop_box, confidence, method, created_at) FROM stdin;
\.


--
-- Data for Name: photographers; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.photographers (slug, name, bio, location, website, instagram, email, created_at, avatar_url) FROM stdin;
test-photographer	John Doe Photography	Professional event photographer	Sydney, Australia	https://example.com	johndoephoto	john@example.com	2026-01-03 02:57:54.450506+00	/images/test/thumbnail-1.jpg
\.


--
-- Data for Name: photos; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.photos (id, event_id, band_id, photographer, blob_url, blob_pathname, original_filename, width, height, file_size, content_type, xmp_metadata, matched_event_name, matched_band_name, match_confidence, uploaded_by, uploaded_at, created_at, labels, hero_focal_point, captured_at, original_blob_url, is_monochrome, slug, slug_prefix) FROM stdin;
11111111-1111-1111-1111-111111111111	test-finalized-event	test-finalized-band-1	test-photographer	/images/test/hero-concert.jpg	photos/test-photo-1/large.webp	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-01-03 02:57:54.462206+00	2026-01-03 02:57:54.462206+00	{global_hero}	{"x": 50, "y": 50}	\N	\N	\N	\N	\N
22222222-2222-2222-2222-222222222222	test-finalized-event	test-finalized-band-1	test-photographer	/images/test/band-stage.jpg	photos/test-photo-2/large.webp	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-01-03 02:57:54.463351+00	2026-01-03 02:57:54.463351+00	{band_hero}	{"x": 50, "y": 40}	\N	\N	\N	\N	\N
33333333-3333-3333-3333-333333333333	test-finalized-event	test-finalized-band-2	test-photographer	/images/test/crowd-energy.jpg	photos/test-photo-3/large.webp	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-01-03 02:57:54.463924+00	2026-01-03 02:57:54.463924+00	{event_hero}	{"x": 50, "y": 50}	\N	\N	\N	\N	\N
44444444-4444-4444-4444-444444444444	test-voting-event	test-band-1	test-photographer	/images/test/thumbnail-1.jpg	photos/test-photo-4/large.webp	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-01-03 02:57:54.464632+00	2026-01-03 02:57:54.464632+00	{}	{"x": 50, "y": 50}	\N	\N	\N	\N	\N
55555555-5555-5555-5555-555555555555	test-voting-event	test-band-2	test-photographer	/images/test/thumbnail-2.jpg	photos/test-photo-5/large.webp	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-01-03 02:57:54.465174+00	2026-01-03 02:57:54.465174+00	{}	{"x": 50, "y": 50}	\N	\N	\N	\N	\N
\.


--
-- Data for Name: setlist_songs; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.setlist_songs (id, band_id, "position", song_type, title, artist, additional_songs, transition_to_title, transition_to_artist, youtube_video_id, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: social_accounts; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.social_accounts (id, provider, provider_account_id, provider_account_name, organization_urn, page_id, ig_business_account_id, access_token_encrypted, refresh_token_encrypted, access_token_expires_at, refresh_token_expires_at, scopes, status, last_error, connected_by, connected_at, updated_at) FROM stdin;
\.


--
-- Data for Name: social_post_results; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.social_post_results (id, post_id, platform, status, external_post_id, external_post_url, error_code, error_message, response_data, attempted_at) FROM stdin;
\.


--
-- Data for Name: social_post_templates; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.social_post_templates (id, name, description, title_template, caption_template, include_photographer_credit, include_event_link, default_hashtags, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: social_posts; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.social_posts (id, platforms, title, caption, photo_ids, event_id, band_id, template_id, include_photographer_credit, include_event_link, hashtags, ig_collaborator_handles, ig_crop_info, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.users (id, email, password_hash, name, is_admin, created_at, last_login) FROM stdin;
a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d	admin@test.com	$2b$12$GpILut1ZnXifnEqJKEUHmOA/1P2oWtYrFfTgfDwy4tpTxw23vIot.	Test Admin	t	2026-01-03 02:57:54.44082+00	\N
\.


--
-- Data for Name: videos; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.videos (id, youtube_video_id, title, event_id, band_id, duration_seconds, thumbnail_url, published_at, sort_order, created_at, video_type) FROM stdin;
\.


--
-- Data for Name: votes; Type: TABLE DATA; Schema: public; Owner: test
--

COPY public.votes (id, voter_type, song_choice, performance, crowd_vibe, crowd_vote, created_at, fingerprintjs_visitor_id, fingerprintjs_confidence, fingerprintjs_components, vote_fingerprint, ip_address, user_agent, browser_name, browser_version, os_name, os_version, device_type, screen_resolution, timezone, language, google_click_id, facebook_pixel_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, fingerprintjs_confidence_comment, event_id, band_id, status, email, name, visuals) FROM stdin;
b0c159be-3564-4ee2-b349-728134e05deb	judge	18	27	25	\N	2026-01-03 02:57:54.455599+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	test-finalized-event	test-finalized-band-1	approved	\N	Judge Alpha	\N
aec29624-3b7b-4a74-8baf-df59f719766f	judge	16	25	24	\N	2026-01-03 02:57:54.457142+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	test-finalized-event	test-finalized-band-1	approved	\N	Judge Beta	\N
657d10b1-a1e2-4cdc-b590-8b52846fee65	judge	15	22	20	\N	2026-01-03 02:57:54.457843+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	test-finalized-event	test-finalized-band-2	approved	\N	Judge Alpha	\N
8c51ddc7-6a63-46fe-a56b-1ca0ee070df6	judge	14	21	19	\N	2026-01-03 02:57:54.458628+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	test-finalized-event	test-finalized-band-2	approved	\N	Judge Beta	\N
0717177f-20c4-48a1-8b66-b3c921336a1c	crowd	\N	\N	\N	18	2026-01-03 02:57:54.459212+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	test-finalized-event	test-finalized-band-1	approved	\N	\N	\N
dcc68747-7bdc-4939-8e91-125bcdb86e87	crowd	\N	\N	\N	17	2026-01-03 02:57:54.459751+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	test-finalized-event	test-finalized-band-1	approved	\N	\N	\N
b8811632-dc1c-40e1-a9d9-4a6ec523088d	crowd	\N	\N	\N	19	2026-01-03 02:57:54.46049+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	test-finalized-event	test-finalized-band-1	approved	\N	\N	\N
46a536fb-4031-4bb9-8f73-5fafbd7334f5	crowd	\N	\N	\N	15	2026-01-03 02:57:54.461092+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	test-finalized-event	test-finalized-band-2	approved	\N	\N	\N
130b239d-5812-4d6b-8834-17f7db530ad2	crowd	\N	\N	\N	14	2026-01-03 02:57:54.461516+00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	test-finalized-event	test-finalized-band-2	approved	\N	\N	\N
\.


--
-- Name: bands bands_slug_unique; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.bands
    ADD CONSTRAINT bands_slug_unique UNIQUE (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (slug);


--
-- Name: crowd_noise_measurements crowd_noise_measurements_event_band_unique; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.crowd_noise_measurements
    ADD CONSTRAINT crowd_noise_measurements_event_band_unique UNIQUE (event_id, band_id);


--
-- Name: crowd_noise_measurements crowd_noise_measurements_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.crowd_noise_measurements
    ADD CONSTRAINT crowd_noise_measurements_pkey PRIMARY KEY (id);


--
-- Name: events events_slug_unique; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_slug_unique UNIQUE (id);


--
-- Name: finalized_results finalized_results_event_id_band_id_key; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.finalized_results
    ADD CONSTRAINT finalized_results_event_id_band_id_key UNIQUE (event_id, band_id);


--
-- Name: finalized_results finalized_results_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.finalized_results
    ADD CONSTRAINT finalized_results_pkey PRIMARY KEY (id);


--
-- Name: photographers photographers_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.photographers
    ADD CONSTRAINT photographers_pkey PRIMARY KEY (slug);


--
-- Name: photos photos_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);


--
-- Name: photos photos_slug_unique; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_slug_unique UNIQUE (slug);


--
-- Name: setlist_songs setlist_songs_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.setlist_songs
    ADD CONSTRAINT setlist_songs_pkey PRIMARY KEY (id);


--
-- Name: social_accounts social_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (id);


--
-- Name: social_accounts social_accounts_provider_key; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_accounts
    ADD CONSTRAINT social_accounts_provider_key UNIQUE (provider);


--
-- Name: social_post_results social_post_results_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_post_results
    ADD CONSTRAINT social_post_results_pkey PRIMARY KEY (id);


--
-- Name: social_post_results social_post_results_post_id_platform_key; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_post_results
    ADD CONSTRAINT social_post_results_post_id_platform_key UNIQUE (post_id, platform);


--
-- Name: social_post_templates social_post_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_post_templates
    ADD CONSTRAINT social_post_templates_pkey PRIMARY KEY (id);


--
-- Name: social_posts social_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: videos videos_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_pkey PRIMARY KEY (id);


--
-- Name: videos videos_youtube_video_id_key; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_youtube_video_id_key UNIQUE (youtube_video_id);


--
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (id);


--
-- Name: votes votes_vote_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_vote_fingerprint_key UNIQUE (vote_fingerprint);


--
-- Name: idx_bands_company_slug; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_bands_company_slug ON public.bands USING btree (company_slug);


--
-- Name: idx_bands_event_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_bands_event_id ON public.bands USING btree (event_id);


--
-- Name: idx_bands_info_gin; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_bands_info_gin ON public.bands USING gin (info);


--
-- Name: idx_companies_name; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_companies_name ON public.companies USING btree (name);


--
-- Name: idx_crowd_noise_band_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_crowd_noise_band_id ON public.crowd_noise_measurements USING btree (band_id);


--
-- Name: idx_crowd_noise_created_at; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_crowd_noise_created_at ON public.crowd_noise_measurements USING btree (created_at);


--
-- Name: idx_crowd_noise_event_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_crowd_noise_event_id ON public.crowd_noise_measurements USING btree (event_id);


--
-- Name: idx_events_info_gin; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_events_info_gin ON public.events USING gin (info);


--
-- Name: idx_finalized_results_band_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_finalized_results_band_id ON public.finalized_results USING btree (band_id);


--
-- Name: idx_finalized_results_event_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_finalized_results_event_id ON public.finalized_results USING btree (event_id);


--
-- Name: idx_finalized_results_final_rank; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_finalized_results_final_rank ON public.finalized_results USING btree (final_rank);


--
-- Name: idx_photo_clusters_type; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photo_clusters_type ON public.photo_clusters USING btree (cluster_type);


--
-- Name: idx_photo_clusters_photo_ids_gin; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photo_clusters_photo_ids_gin ON public.photo_clusters USING gin (photo_ids);


--
-- Name: idx_photo_clusters_representative; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photo_clusters_representative ON public.photo_clusters USING btree (representative_photo_id) WHERE (representative_photo_id IS NOT NULL);


--
-- Name: idx_photo_crops_photo_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photo_crops_photo_id ON public.photo_crops USING btree (photo_id);


--
-- Name: idx_photographers_name; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photographers_name ON public.photographers USING btree (name);


--
-- Name: idx_photos_band_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_band_id ON public.photos USING btree (band_id);


--
-- Name: idx_photos_captured_at; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_captured_at ON public.photos USING btree (captured_at);


--
-- Name: idx_photos_event_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_event_id ON public.photos USING btree (event_id);


--
-- Name: idx_photos_labels; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_labels ON public.photos USING gin (labels);


--
-- Name: idx_photos_original_blob_url; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_original_blob_url ON public.photos USING btree (original_blob_url) WHERE (original_blob_url IS NOT NULL);


--
-- Name: idx_photos_photographer; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_photographer ON public.photos USING btree (photographer);


--
-- Name: idx_photos_uploaded_at; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_uploaded_at ON public.photos USING btree (uploaded_at);


--
-- Name: idx_photos_slug; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_slug ON public.photos USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: idx_photos_slug_prefix; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_slug_prefix ON public.photos USING btree (slug_prefix) WHERE (slug_prefix IS NOT NULL);


--
-- Name: idx_photos_is_monochrome; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_photos_is_monochrome ON public.photos USING btree (is_monochrome) WHERE (is_monochrome IS NOT NULL);


--
-- Name: idx_setlist_songs_artist; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_setlist_songs_artist ON public.setlist_songs USING btree (artist);


--
-- Name: idx_setlist_songs_band_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_setlist_songs_band_id ON public.setlist_songs USING btree (band_id);


--
-- Name: idx_setlist_songs_position; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_setlist_songs_position ON public.setlist_songs USING btree ("position");


--
-- Name: idx_setlist_songs_song_type; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_setlist_songs_song_type ON public.setlist_songs USING btree (song_type);


--
-- Name: idx_setlist_songs_status; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_setlist_songs_status ON public.setlist_songs USING btree (status);


--
-- Name: idx_setlist_songs_title; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_setlist_songs_title ON public.setlist_songs USING btree (title);


--
-- Name: idx_social_accounts_provider; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_social_accounts_provider ON public.social_accounts USING btree (provider);


--
-- Name: idx_social_accounts_status; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_social_accounts_status ON public.social_accounts USING btree (status);


--
-- Name: idx_social_post_results_platform; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_social_post_results_platform ON public.social_post_results USING btree (platform);


--
-- Name: idx_social_post_results_post; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_social_post_results_post ON public.social_post_results USING btree (post_id);


--
-- Name: idx_social_post_results_status; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_social_post_results_status ON public.social_post_results USING btree (status);


--
-- Name: idx_social_post_templates_sort; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_social_post_templates_sort ON public.social_post_templates USING btree (sort_order);


--
-- Name: idx_social_posts_created; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_social_posts_created ON public.social_posts USING btree (created_at DESC);


--
-- Name: idx_social_posts_event; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_social_posts_event ON public.social_posts USING btree (event_id);


--
-- Name: idx_social_posts_status; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_social_posts_status ON public.social_posts USING btree (status);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_is_admin; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_users_is_admin ON public.users USING btree (is_admin);


--
-- Name: idx_videos_band_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_videos_band_id ON public.videos USING btree (band_id);


--
-- Name: idx_videos_event_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_videos_event_id ON public.videos USING btree (event_id);


--
-- Name: idx_videos_sort_order; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_videos_sort_order ON public.videos USING btree (sort_order);


--
-- Name: idx_videos_youtube_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_videos_youtube_id ON public.videos USING btree (youtube_video_id);


--
-- Name: idx_videos_video_type; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_videos_video_type ON public.videos USING btree (video_type);


--
-- Name: idx_votes_band_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_votes_band_id ON public.votes USING btree (band_id);


--
-- Name: idx_votes_created_at; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_votes_created_at ON public.votes USING btree (created_at);


--
-- Name: idx_votes_email; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_votes_email ON public.votes USING btree (email);


--
-- Name: idx_votes_event_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_votes_event_id ON public.votes USING btree (event_id);


--
-- Name: idx_votes_fingerprint; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_votes_fingerprint ON public.votes USING btree (vote_fingerprint);


--
-- Name: idx_votes_fingerprintjs_visitor_id; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_votes_fingerprintjs_visitor_id ON public.votes USING btree (fingerprintjs_visitor_id);


--
-- Name: idx_votes_ip_address; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_votes_ip_address ON public.votes USING btree (ip_address);


--
-- Name: idx_votes_voter_type; Type: INDEX; Schema: public; Owner: test
--

CREATE INDEX idx_votes_voter_type ON public.votes USING btree (voter_type);


--
-- Name: photo_crops_photo_aspect_unique; Type: INDEX; Schema: public; Owner: test
--

CREATE UNIQUE INDEX photo_crops_photo_aspect_unique ON public.photo_crops USING btree (photo_id, aspect_ratio);


--
-- Name: bands bands_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.bands
    ADD CONSTRAINT bands_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: crowd_noise_measurements crowd_noise_measurements_band_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.crowd_noise_measurements
    ADD CONSTRAINT crowd_noise_measurements_band_id_fkey FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;


--
-- Name: crowd_noise_measurements crowd_noise_measurements_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.crowd_noise_measurements
    ADD CONSTRAINT crowd_noise_measurements_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: finalized_results finalized_results_band_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.finalized_results
    ADD CONSTRAINT finalized_results_band_id_fkey FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;


--
-- Name: finalized_results finalized_results_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.finalized_results
    ADD CONSTRAINT finalized_results_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: photo_crops photo_crops_photo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.photo_crops
    ADD CONSTRAINT photo_crops_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES public.photos(id) ON DELETE CASCADE;


--
-- Name: photos photos_band_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_band_id_fkey FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;


--
-- Name: photos photos_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: photos photos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: setlist_songs setlist_songs_band_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.setlist_songs
    ADD CONSTRAINT setlist_songs_band_id_fkey FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;


--
-- Name: social_post_results social_post_results_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_post_results
    ADD CONSTRAINT social_post_results_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.social_posts(id) ON DELETE CASCADE;


--
-- Name: social_posts social_posts_band_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_band_id_fkey FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE SET NULL;


--
-- Name: social_posts social_posts_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: social_posts social_posts_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.social_post_templates(id) ON DELETE SET NULL;


--
-- Name: videos videos_band_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_band_id_fkey FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE SET NULL;


--
-- Name: videos videos_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: votes votes_band_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_band_id_fkey FOREIGN KEY (band_id) REFERENCES public.bands(id) ON DELETE CASCADE;


--
-- Name: votes votes_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: test
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: test
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict LcNtE41inI6gwlmyOk4mC3UsYJTH2GkQDJwyHwhOoecIfncR2Rx8cFpS0x3f9DG

