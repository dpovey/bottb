import { http, HttpResponse } from 'msw'

export const handlers = [
  // Events API
  http.get('/api/events', () => {
    return HttpResponse.json([
      {
        id: 'event-1',
        name: 'Test Event 1',
        date: '2024-12-25T18:30:00Z',
        location: 'Test Venue 1',
        status: 'voting',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'event-2',
        name: 'Test Event 2',
        date: '2024-12-26T18:30:00Z',
        location: 'Test Venue 2',
        status: 'upcoming',
        is_active: false,
        created_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 'event-3',
        name: 'Test Event 3',
        date: '2023-12-10T00:00:00Z',
        location: 'Test Venue 3',
        status: 'finalized',
        is_active: false,
        created_at: '2023-01-01T00:00:00Z',
      },
    ])
  }),

  http.get('/api/events/:eventId', ({ params }) => {
    const { eventId } = params

    // Return 404 for specific test cases
    if (eventId === 'not-found-event') {
      return HttpResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Return different statuses for testing
    if (eventId === 'upcoming-event') {
      return HttpResponse.json({
        id: eventId,
        name: 'Upcoming Event',
        date: '2024-12-25T18:30:00Z',
        location: 'Test Venue',
        status: 'upcoming',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
      })
    }

    if (eventId === 'finalized-event') {
      return HttpResponse.json({
        id: eventId,
        name: 'Finalized Event',
        date: '2024-12-25T18:30:00Z',
        location: 'Test Venue',
        status: 'finalized',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
      })
    }

    return HttpResponse.json({
      id: eventId,
      name: 'Test Event',
      date: '2024-12-25T18:30:00Z',
      location: 'Test Venue',
      status: 'voting',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
    })
  }),

  http.get('/api/events/active', () => {
    return HttpResponse.json({
      id: 'active-event-1',
      name: 'Active Event',
      date: '2024-12-25T18:30:00Z',
      location: 'Active Venue',
      status: 'voting',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
    })
  }),

  http.get('/api/events/upcoming', () => {
    return HttpResponse.json([
      {
        id: 'upcoming-event-1',
        name: 'Upcoming Event 1',
        date: '2024-12-25T18:30:00Z',
        location: 'Upcoming Venue 1',
        status: 'upcoming',
        is_active: false,
        created_at: '2024-01-01T00:00:00Z',
      },
    ])
  }),

  http.get('/api/events/past', () => {
    return HttpResponse.json([
      {
        id: 'past-event-1',
        name: 'Past Event 1',
        date: '2023-12-25T18:30:00Z',
        location: 'Past Venue 1',
        status: 'finalized',
        is_active: false,
        created_at: '2023-01-01T00:00:00Z',
      },
    ])
  }),

  // Bands API
  http.get('/api/bands/:eventId', ({ params }) => {
    const { eventId } = params

    // Return empty array for specific test cases
    if (eventId === 'no-bands-event') {
      return HttpResponse.json([])
    }

    return HttpResponse.json([
      {
        id: 'band-1',
        event_id: eventId,
        name: 'Test Band 1',
        description: 'A test band',
        order: 1,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'band-2',
        event_id: eventId,
        name: 'Test Band 2',
        description: 'Another test band',
        order: 2,
        created_at: '2024-01-01T00:00:00Z',
      },
    ])
  }),

  // Votes API
  http.post('/api/votes', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>

    // Simulate already voted error for specific test cases
    if (body.event_id === 'already-voted-event') {
      return HttpResponse.json({ error: 'Already Voted' }, { status: 400 })
    }

    // Simulate status validation errors
    if (body.event_id === 'upcoming-event') {
      return HttpResponse.json(
        {
          error: 'Voting is not currently open for this event',
          eventStatus: 'upcoming',
        },
        { status: 403 }
      )
    }

    if (body.event_id === 'finalized-event') {
      return HttpResponse.json(
        {
          error: 'Voting is not currently open for this event',
          eventStatus: 'finalized',
        },
        { status: 403 }
      )
    }

    if (body.event_id === 'not-found-event') {
      return HttpResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return HttpResponse.json({
      id: 'vote-1',
      ...body,
      created_at: '2024-01-01T00:00:00Z',
    })
  }),

  http.post('/api/votes/batch', async ({ request }) => {
    const body = (await request.json()) as { votes: Record<string, unknown>[] }

    // Simulate already voted error for specific test cases
    if (
      body.votes.some(
        (vote: Record<string, unknown>) =>
          vote.event_id === 'already-voted-event'
      )
    ) {
      return HttpResponse.json({ error: 'Already Voted' }, { status: 400 })
    }

    // Simulate status validation errors
    if (
      body.votes.some(
        (vote: Record<string, unknown>) => vote.event_id === 'upcoming-event'
      )
    ) {
      return HttpResponse.json(
        {
          error: 'Voting is not currently open for this event',
          eventStatus: 'upcoming',
        },
        { status: 403 }
      )
    }

    if (
      body.votes.some(
        (vote: Record<string, unknown>) => vote.event_id === 'finalized-event'
      )
    ) {
      return HttpResponse.json(
        {
          error: 'Voting is not currently open for this event',
          eventStatus: 'finalized',
        },
        { status: 403 }
      )
    }

    if (
      body.votes.some(
        (vote: Record<string, unknown>) => vote.event_id === 'not-found-event'
      )
    ) {
      return HttpResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    return HttpResponse.json({
      votes: body.votes.map((vote: Record<string, unknown>, index: number) => ({
        id: `vote-${index + 1}`,
        ...vote,
        created_at: '2024-01-01T00:00:00Z',
      })),
    })
  }),

  // Event scores API
  http.get('/api/events/:eventId/scores', () => {
    return HttpResponse.json([
      {
        id: 'band-1',
        name: 'Test Band 1',
        order: 1,
        avg_song_choice: 15.5,
        avg_performance: 25.0,
        avg_crowd_vibe: 22.5,
        avg_crowd_vote: 18.0,
        crowd_vote_count: 10,
        judge_vote_count: 3,
        total_crowd_votes: 50,
      },
      {
        id: 'band-2',
        name: 'Test Band 2',
        order: 2,
        avg_song_choice: 12.0,
        avg_performance: 20.0,
        avg_crowd_vibe: 18.0,
        avg_crowd_vote: 15.0,
        crowd_vote_count: 8,
        judge_vote_count: 2,
        total_crowd_votes: 50,
      },
    ])
  }),

  // Event status update API
  http.patch('/api/events/:eventId/status', async ({ request, params }) => {
    const { eventId } = params
    const body = (await request.json()) as { status: string }

    // Return 404 for specific test cases
    if (eventId === 'non-existent') {
      return HttpResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Return 400 for invalid status
    if (
      !body.status ||
      !['upcoming', 'voting', 'finalized'].includes(body.status)
    ) {
      return HttpResponse.json(
        {
          error: "Invalid status. Must be 'upcoming', 'voting', or 'finalized'",
        },
        { status: 400 }
      )
    }

    // Return success response
    return HttpResponse.json({
      success: true,
      message: `Event status updated to ${body.status}`,
      event: {
        id: eventId,
        name: 'Test Event',
        location: 'Test Location',
        status: body.status,
        date: '2024-01-01T00:00:00Z',
        is_active: body.status === 'voting',
        created_at: '2024-01-01T00:00:00Z',
      },
    })
  }),

  // Photos API
  http.get('/api/photos', ({ request }) => {
    const url = new URL(request.url)
    const eventId =
      url.searchParams.get('event') || url.searchParams.get('eventId')
    const photographer = url.searchParams.get('photographer')
    const companySlug =
      url.searchParams.get('company') || url.searchParams.get('companySlug')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const skipMeta = url.searchParams.get('skipMeta') === 'true'

    const mockPhotos = [
      {
        id: 'photo-1',
        blob_url: 'https://example.com/photos/photo-1/large.webp',
        blob_pathname: 'photos/photo-1/large.webp',
        event_id: 'event-1',
        band_id: 'band-1',
        photographer: 'John Doe',
        event_name: 'Test Event',
        band_name: 'Test Band',
        labels: [],
        hero_focal_point: { x: 50, y: 50 },
        uploaded_at: '2024-01-01T00:00:00Z',
        thumbnail_url: 'https://example.com/photos/photo-1/thumbnail.webp',
      },
      {
        id: 'photo-2',
        blob_url: 'https://example.com/photos/photo-2/large.webp',
        blob_pathname: 'photos/photo-2/large.webp',
        event_id: 'event-1',
        band_id: 'band-2',
        photographer: 'Jane Smith',
        event_name: 'Test Event',
        band_name: 'Another Band',
        labels: ['band_hero'],
        hero_focal_point: { x: 30, y: 70 },
        uploaded_at: '2024-01-02T00:00:00Z',
        thumbnail_url: 'https://example.com/photos/photo-2/thumbnail.webp',
      },
    ]

    // Filter photos if filters provided
    let filteredPhotos = mockPhotos
    if (eventId) {
      filteredPhotos = filteredPhotos.filter((p) => p.event_id === eventId)
    }
    if (photographer) {
      filteredPhotos = filteredPhotos.filter(
        (p) => p.photographer === photographer
      )
    }
    if (companySlug && companySlug !== 'none') {
      // For testing, assume all photos have company-1
      filteredPhotos = companySlug === 'company-1' ? filteredPhotos : []
    }

    const response: Record<string, unknown> = {
      photos: filteredPhotos.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total: filteredPhotos.length,
        totalPages: Math.ceil(filteredPhotos.length / limit),
      },
    }

    if (!skipMeta) {
      response.photographers = ['John Doe', 'Jane Smith']
      response.companies = [{ slug: 'company-1', name: 'Test Company' }]
      response.availableFilters = {
        companies: [{ slug: 'company-1', name: 'Test Company', count: 2 }],
        events: [{ id: 'event-1', name: 'Test Event', count: 2 }],
        photographers: [
          { name: 'John Doe', count: 1 },
          { name: 'Jane Smith', count: 1 },
        ],
        hasPhotosWithoutCompany: false,
      }
    } else {
      response.photographers = []
      response.companies = []
      response.availableFilters = null
    }

    return HttpResponse.json(response)
  }),

  http.get('/api/photos/:photoId', ({ params }) => {
    const { photoId } = params

    if (photoId === 'not-found') {
      return HttpResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    return HttpResponse.json({
      id: photoId,
      blob_url: `https://example.com/photos/${photoId}/large.webp`,
      blob_pathname: `photos/${photoId}/large.webp`,
      event_id: 'event-1',
      band_id: 'band-1',
      photographer: 'John Doe',
      event_name: 'Test Event',
      band_name: 'Test Band',
      labels: [],
      hero_focal_point: { x: 50, y: 50 },
      uploaded_at: '2024-01-01T00:00:00Z',
      thumbnail_url: `https://example.com/photos/${photoId}/thumbnail.webp`,
    })
  }),

  http.delete('/api/photos/:photoId', ({ params }) => {
    const { photoId } = params

    if (photoId === 'not-found') {
      return HttpResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    return HttpResponse.json({
      success: true,
      message: `Photo "${photoId}" deleted successfully`,
      deletedId: photoId,
    })
  }),

  http.get('/api/photos/:photoId/labels', ({ params }) => {
    const { photoId } = params

    if (photoId === 'not-found') {
      return HttpResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    return HttpResponse.json({
      photoId,
      labels: [],
      heroFocalPoint: { x: 50, y: 50 },
      availableLabels: [
        'band_hero',
        'event_hero',
        'global_hero',
        'photographer_hero',
      ],
    })
  }),

  http.patch('/api/photos/:photoId/labels', async ({ params, request }) => {
    const { photoId } = params

    if (photoId === 'not-found') {
      return HttpResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const body = (await request.json()) as {
      labels?: string[]
      heroFocalPoint?: { x: number; y: number }
    }

    return HttpResponse.json({
      success: true,
      photoId,
      labels: body.labels || [],
      heroFocalPoint: body.heroFocalPoint || { x: 50, y: 50 },
    })
  }),

  http.get('/api/photos/heroes', () => {
    return HttpResponse.json({
      global: {
        id: 'hero-photo-1',
        blob_url: 'https://example.com/photos/hero-1/large.webp',
        labels: ['global_hero'],
      },
      events: {},
      bands: {},
      photographers: {},
    })
  }),

  // Photographers API
  http.get('/api/photographers', () => {
    return HttpResponse.json([
      { name: 'John Doe', photo_count: 10 },
      { name: 'Jane Smith', photo_count: 5 },
    ])
  }),

  http.get('/api/photographers/:name', ({ params }) => {
    const { name } = params

    if (name === 'not-found') {
      return HttpResponse.json(
        { error: 'Photographer not found' },
        { status: 404 }
      )
    }

    return HttpResponse.json({
      name,
      photo_count: 10,
      photos: [
        {
          id: 'photo-1',
          blob_url: 'https://example.com/photos/photo-1/large.webp',
          thumbnail_url: 'https://example.com/photos/photo-1/thumbnail.webp',
        },
      ],
    })
  }),

  // Videos API
  http.get('/api/videos', () => {
    return HttpResponse.json([
      {
        id: 'video-1',
        title: 'Test Video 1',
        youtube_id: 'abc123',
        event_id: 'event-1',
        band_id: 'band-1',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'video-2',
        title: 'Test Video 2',
        youtube_id: 'def456',
        event_id: 'event-1',
        band_id: 'band-2',
        created_at: '2024-01-02T00:00:00Z',
      },
    ])
  }),

  http.get('/api/videos/:videoId', ({ params }) => {
    const { videoId } = params

    if (videoId === 'not-found') {
      return HttpResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    return HttpResponse.json({
      id: videoId,
      title: 'Test Video',
      youtube_id: 'abc123',
      event_id: 'event-1',
      band_id: 'band-1',
      created_at: '2024-01-01T00:00:00Z',
    })
  }),

  http.post('/api/videos', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>

    return HttpResponse.json({
      id: 'new-video-1',
      ...body,
      created_at: '2024-01-01T00:00:00Z',
    })
  }),

  http.delete('/api/videos/:videoId', ({ params }) => {
    const { videoId } = params

    if (videoId === 'not-found') {
      return HttpResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    return HttpResponse.json({
      success: true,
      message: `Video "${videoId}" deleted successfully`,
      deletedId: videoId,
    })
  }),

  // Fallback handler for unhandled requests
  http.all('*', () => {
    return HttpResponse.json(
      { error: 'No handler found for this request' },
      { status: 404 }
    )
  }),
]
