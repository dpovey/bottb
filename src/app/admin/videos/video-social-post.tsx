'use client'

import { useState, useCallback } from 'react'
import { upload } from '@vercel/blob/client'
import { Video } from '@/lib/db'
import { Button, Card, FileDropzone, SchedulePicker } from '@/components/ui'
import {
  CloseIcon,
  ShareIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  SpinnerIcon,
} from '@/components/icons'

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
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Scheduling state
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledTime, setScheduledTime] = useState<string | null>(null)

  const togglePlatform = (platform: Platform) => {
    const newSelection = new Set(selectedPlatforms)
    if (newSelection.has(platform)) {
      newSelection.delete(platform)
    } else {
      newSelection.add(platform)
    }
    setSelectedPlatforms(newSelection)
  }

  // Eager upload: start uploading as soon as file is selected
  const handleFileSelect = useCallback(async (file: File | null) => {
    setVideoFile(file)
    setUploadedUrl(null)
    setUploadProgress(null)
    setError(null)

    if (!file) return

    try {
      setUploadProgress(0)
      const blob = await upload(
        `videos/social-${Date.now()}-${file.name}`,
        file,
        {
          access: 'public',
          handleUploadUrl: '/api/admin/social/video/upload',
          onUploadProgress: (progress) => {
            setUploadProgress(Math.round(progress.percentage))
          },
        }
      )
      setUploadedUrl(blob.url)
      setUploadProgress(100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video')
      setUploadProgress(null)
    }
  }, [])

  const handlePost = async () => {
    if (selectedPlatforms.size === 0) {
      setError('Please select at least one platform')
      return
    }
    if (!uploadedUrl) {
      setError('Please wait for the video to finish uploading')
      return
    }
    if (scheduleEnabled && !scheduledTime) {
      setError('Please select a date and time for scheduling')
      return
    }

    setIsPosting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/admin/social/video/post', {
        method: 'POST',
        credentials: 'include', // Include cookies for Vercel auth
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: uploadedUrl,
          caption,
          platforms: [...selectedPlatforms],
          videoId: video.id,
          youtubeVideoId: video.youtube_video_id,
          filename: videoFile?.name || 'video.mp4',
          scheduledTime: scheduleEnabled ? scheduledTime : null,
        }),
      })

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        const text = await response.text()
        throw new Error(text || `Server error: ${response.status}`)
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post video')
      }

      // Show success message
      const successPlatforms = Object.entries(data.results || {})
        .filter(([_, result]) => (result as { success: boolean }).success)
        .map(([platform]) => platform)

      if (successPlatforms.length > 0) {
        if (scheduleEnabled && scheduledTime) {
          const date = new Date(scheduledTime)
          setSuccessMessage(
            `Scheduled for ${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${successPlatforms.join(', ')}!`
          )
        } else {
          setSuccessMessage(`Posted to ${successPlatforms.join(', ')}!`)
        }
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

  const isUploading = uploadProgress !== null && uploadProgress < 100
  const isReadyToPost =
    uploadedUrl && !isUploading && selectedPlatforms.size > 0

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
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white cursor-pointer"
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

        {/* Video File Upload - Eager upload on select */}
        <FileDropzone
          label="Video File"
          accept="video/*"
          maxSize={1024 * 1024 * 1024} // 1GB
          file={videoFile}
          onFileSelect={handleFileSelect}
          progress={uploadProgress}
          placeholder="Click or drag to upload your original video file"
          helperText="MP4, MOV, or other video formats • Max 1GB • Uploads immediately"
          className="mb-6"
        />

        {/* Platform Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Post to
          </label>
          <div className="flex gap-3">
            <PlatformButton
              platform="facebook"
              icon={<FacebookIcon className="w-5 h-5" />}
              label="Facebook"
              isSelected={selectedPlatforms.has('facebook')}
              onClick={() => togglePlatform('facebook')}
            />
            <PlatformButton
              platform="instagram"
              icon={<InstagramIcon className="w-5 h-5" />}
              label="Instagram"
              isSelected={selectedPlatforms.has('instagram')}
              onClick={() => togglePlatform('instagram')}
              hint={isShort ? 'Reels' : 'Reels (landscape)'}
            />
            <PlatformButton
              platform="linkedin"
              icon={<LinkedInIcon className="w-5 h-5" />}
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

        {/* Scheduling */}
        <SchedulePicker
          enabled={scheduleEnabled}
          onEnabledChange={setScheduleEnabled}
          toggleLabel="Schedule for later"
          value={scheduledTime}
          onChange={setScheduledTime}
          helperText="Post will be published at the scheduled time"
          className="mb-6"
        />

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
            disabled={isPosting || !isReadyToPost}
          >
            {isPosting ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin" />
                Posting...
              </>
            ) : isUploading ? (
              `Uploading... ${uploadProgress}%`
            ) : scheduleEnabled ? (
              'Schedule Post'
            ) : (
              'Post Video'
            )}
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
      className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
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
        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white cursor-pointer"
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
