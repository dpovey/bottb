'use client'

import { useState, useRef } from 'react'
import { Video } from '@/lib/db'
import { Button, Card } from '@/components/ui'
import { CloseIcon } from '@/components/icons'

// Platform icons
function FacebookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function InstagramIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.757-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
    </svg>
  )
}

function LinkedInIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function UploadIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  )
}

function ShareIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
      />
    </svg>
  )
}

type Platform = 'facebook' | 'instagram' | 'linkedin'

interface VideoSocialPostProps {
  video: Video
  onClose: () => void
}

export function VideoSocialPost({ video, onClose }: VideoSocialPostProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(
    new Set()
  )
  const [caption, setCaption] = useState(video.title)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const togglePlatform = (platform: Platform) => {
    const newSelection = new Set(selectedPlatforms)
    if (newSelection.has(platform)) {
      newSelection.delete(platform)
    } else {
      newSelection.add(platform)
    }
    setSelectedPlatforms(newSelection)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file')
        return
      }
      // Validate file size (max 1GB for now)
      if (file.size > 1024 * 1024 * 1024) {
        setError('Video file must be less than 1GB')
        return
      }
      setVideoFile(file)
      setError(null)
    }
  }

  const handlePost = async () => {
    if (selectedPlatforms.size === 0) {
      setError('Please select at least one platform')
      return
    }
    if (!videoFile) {
      setError('Please upload your video file')
      return
    }

    setIsPosting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      // Create FormData to upload the video
      const formData = new FormData()
      formData.append('video', videoFile)
      formData.append('caption', caption)
      formData.append('platforms', JSON.stringify([...selectedPlatforms]))
      formData.append('videoId', video.id)
      formData.append('youtubeVideoId', video.youtube_video_id)

      const response = await fetch('/api/admin/social/video', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post video')
      }

      // Show success message
      const successPlatforms = Object.entries(data.results || {})
        .filter(([_, result]) => (result as { success: boolean }).success)
        .map(([platform]) => platform)

      if (successPlatforms.length > 0) {
        setSuccessMessage(`Posted to ${successPlatforms.join(', ')}!`)
      }

      // Check for any failures
      const failures = Object.entries(data.results || {})
        .filter(([_, result]) => !(result as { success: boolean }).success)
        .map(
          ([platform, result]) =>
            `${platform}: ${(result as { error?: string }).error || 'Unknown error'}`
        )

      if (failures.length > 0) {
        setError(`Some posts failed:\n${failures.join('\n')}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post video')
    } finally {
      setIsPosting(false)
    }
  }

  const isShort = video.video_type === 'short'
  const youtubeUrl = isShort
    ? `https://www.youtube.com/shorts/${video.youtube_video_id}`
    : `https://www.youtube.com/watch?v=${video.youtube_video_id}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShareIcon className="w-6 h-6" />
            Share Video to Social Media
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Video Preview */}
        <div className="flex gap-4 mb-6 p-4 bg-white/5 rounded-lg">
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                video.thumbnail_url ||
                `https://i.ytimg.com/vi/${video.youtube_video_id}/hq720.jpg`
              }
              alt={video.title}
              className={`object-cover rounded-lg hover:opacity-80 transition-opacity ${
                isShort ? 'w-20 h-36' : 'w-40 h-24'
              }`}
            />
          </a>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white">{video.title}</h3>
            <p className="text-sm text-gray-400 mt-1">
              {video.event_name && <span>{video.event_name}</span>}
              {video.band_name && <span> • {video.band_name}</span>}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              YouTube ID: {video.youtube_video_id}
            </p>
          </div>
        </div>

        {/* Caption */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Caption
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 text-white placeholder-gray-500 focus:border-accent focus:outline-hidden resize-none"
            placeholder="Write a caption for your video..."
          />
          <p className="text-xs text-gray-500 mt-1">
            {caption.length} characters
          </p>
        </div>

        {/* Video File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Video File
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              videoFile
                ? 'border-green-500/50 bg-green-500/10'
                : 'border-white/20 hover:border-white/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {videoFile ? (
              <div>
                <p className="text-green-400 font-medium">{videoFile.name}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setVideoFile(null)
                  }}
                  className="mt-2 text-sm text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <UploadIcon className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-300">
                  Click to upload your original video file
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  MP4, MOV, or other video formats • Max 1GB
                </p>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Upload your original video file (not from YouTube) to share on
            social platforms.
          </p>
        </div>

        {/* Platform Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Post to
          </label>
          <div className="flex gap-3">
            <PlatformButton
              platform="facebook"
              icon={<FacebookIcon />}
              label="Facebook"
              isSelected={selectedPlatforms.has('facebook')}
              onClick={() => togglePlatform('facebook')}
            />
            <PlatformButton
              platform="instagram"
              icon={<InstagramIcon />}
              label="Instagram"
              isSelected={selectedPlatforms.has('instagram')}
              onClick={() => togglePlatform('instagram')}
              hint={isShort ? 'Reels' : 'Reels (landscape)'}
            />
            <PlatformButton
              platform="linkedin"
              icon={<LinkedInIcon />}
              label="LinkedIn"
              isSelected={selectedPlatforms.has('linkedin')}
              onClick={() => togglePlatform('linkedin')}
            />
          </div>
        </div>

        {/* Instagram note for landscape videos */}
        {selectedPlatforms.has('instagram') && !isShort && (
          <div className="mb-6 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-sm text-yellow-300">
              <strong>Note:</strong> Instagram prefers vertical videos (9:16)
              for Reels. Your landscape video will be posted as a Reel but may
              appear with letterboxing. For best results, consider uploading a
              vertical version.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 bg-error/20 border border-error/50 rounded-lg">
            <p className="text-error whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* Success */}
        {successMessage && (
          <div className="mb-6 p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
            <p className="text-green-300">{successMessage}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={handlePost}
            disabled={isPosting || selectedPlatforms.size === 0 || !videoFile}
          >
            {isPosting ? 'Posting...' : 'Post Video'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

interface PlatformButtonProps {
  platform: Platform
  icon: React.ReactNode
  label: string
  isSelected: boolean
  onClick: () => void
  hint?: string
}

function PlatformButton({
  icon,
  label,
  isSelected,
  onClick,
  hint,
}: PlatformButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
        isSelected
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-white/20 hover:border-white/40 text-gray-400 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </button>
  )
}

// Button to trigger the modal
interface VideoShareButtonProps {
  video: Video
}

export function VideoShareButton({ video }: VideoShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
        title="Share to social media"
      >
        <ShareIcon className="w-5 h-5" />
      </button>
      {isOpen && (
        <VideoSocialPost video={video} onClose={() => setIsOpen(false)} />
      )}
    </>
  )
}
