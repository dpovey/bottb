// Shared types and interfaces for user context
// Server-side functions are in user-context-server.ts
// Client-side functions are in user-context-client.ts

export interface UserContext {
  ip_address?: string
  user_agent?: string
  browser_name?: string
  browser_version?: string
  os_name?: string
  os_version?: string
  device_type?: string
  screen_resolution?: string
  timezone?: string
  language?: string
  google_click_id?: string
  facebook_pixel_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  vote_fingerprint?: string
  // FingerprintJS fields
  fingerprintjs_visitor_id?: string
  fingerprintjs_confidence?: number
  fingerprintjs_confidence_comment?: string
}

export interface BrowserInfo {
  name: string
  version: string
  os: string
  osVersion: string
  deviceType: string
}
