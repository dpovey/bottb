/**
 * AI Caption Suggestion API
 *
 * POST /api/admin/social/suggest - Generate AI-suggested social post captions
 *
 * Uses Vercel AI SDK with OpenAI to generate contextual captions.
 * Admin-only endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { CaptionContext } from '@/lib/social/types'

interface SuggestRequestBody {
  context: CaptionContext
  platforms: string[]
  tone?: 'professional' | 'casual' | 'energetic'
  includeHashtags?: boolean
  includeEmoji?: boolean
}

function buildPrompt(body: SuggestRequestBody): string {
  const {
    context,
    platforms,
    tone = 'energetic',
    includeHashtags = true,
    includeEmoji = true,
  } = body

  const platformsStr = platforms.join(', ')

  let prompt = `Generate an engaging social media caption for ${platformsStr} about live band performance photos from Battle of the Tech Bands.

CONTEXT:
`

  if (context.event_name) {
    prompt += `- Event: ${context.event_name}\n`
  }
  if (context.event_date) {
    prompt += `- Date: ${context.event_date}\n`
  }
  if (context.event_location) {
    prompt += `- Location: ${context.event_location}\n`
  }
  if (context.band_name) {
    prompt += `- Band: ${context.band_name}\n`
  }
  if (context.band_description) {
    prompt += `- Band Description: ${context.band_description}\n`
  }
  if (context.photographer_name) {
    prompt += `- Photographer: ${context.photographer_name}\n`
  }
  if (context.setlist_songs && context.setlist_songs.length > 0) {
    prompt += `- Songs performed: ${context.setlist_songs.join(', ')}\n`
  }
  if (context.photo_count) {
    prompt += `- Number of photos: ${context.photo_count}\n`
  }

  prompt += `
STYLE REQUIREMENTS:
- Tone: ${tone}
- ${includeEmoji ? 'Include relevant emojis' : 'Do not include emojis'}
- ${includeHashtags ? 'Include 3-5 relevant hashtags at the end' : 'Do not include hashtags'}
- Battle of the Tech Bands is a corporate band competition where tech companies compete
- Keep it concise but engaging
- Focus on the energy and excitement of live music

REQUIRED HASHTAGS (if including hashtags):
- #BattleOfTheTechBands or #BOTTB
- #LiveMusic
- Add 2-3 more relevant to the context

OUTPUT:
Generate ONLY the caption text, nothing else. No explanations or labels.`

  return prompt
}

export async function POST(request: NextRequest) {
  // Check admin auth
  const session = await auth()
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if OpenAI is configured
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    )
  }

  try {
    const body: SuggestRequestBody = await request.json()

    // Validate required fields
    if (!body.context || !body.platforms || body.platforms.length === 0) {
      return NextResponse.json(
        { error: 'Context and platforms are required' },
        { status: 400 }
      )
    }

    // Build the prompt
    const prompt = buildPrompt(body)

    // Generate caption using Vercel AI SDK
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      maxRetries: 2,
      temperature: 0.8, // Slightly creative but not too wild
    })

    // Clean up the response (remove any quotation marks if present)
    let caption = result.text.trim()
    if (caption.startsWith('"') && caption.endsWith('"')) {
      caption = caption.slice(1, -1)
    }

    return NextResponse.json({
      caption,
      usage: result.usage
        ? {
            prompt_tokens: result.usage.inputTokens,
            completion_tokens: result.usage.outputTokens,
            total_tokens:
              (result.usage.inputTokens || 0) +
              (result.usage.outputTokens || 0),
          }
        : undefined,
    })
  } catch (error) {
    console.error('AI suggestion error:', error)

    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'OpenAI API key is invalid' },
          { status: 500 }
        )
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'OpenAI API quota exceeded' },
          { status: 429 }
        )
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'AI suggestion failed',
      },
      { status: 500 }
    )
  }
}
