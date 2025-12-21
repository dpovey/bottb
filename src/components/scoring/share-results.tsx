'use client'

import { useState } from 'react'
import {
  TwitterIcon,
  LinkedInIcon,
  FacebookIcon,
  LinkIcon,
  CheckIcon,
} from '@/components/icons'

interface ShareResultsProps {
  eventName: string
  winnerName: string
  eventUrl: string
}

/**
 * Social share buttons for results page
 */
export function ShareResults({
  eventName,
  winnerName,
  eventUrl,
}: ShareResultsProps) {
  const [copied, setCopied] = useState(false)

  const shareText = `🏆 ${winnerName} wins ${eventName}! Check out the full results from Battle of the Tech Bands.`
  const encodedText = encodeURIComponent(shareText)
  const encodedUrl = encodeURIComponent(eventUrl)

  const shareLinks = [
    {
      name: 'Twitter',
      icon: TwitterIcon,
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      color: 'hover:text-[#1DA1F2]',
    },
    {
      name: 'LinkedIn',
      icon: LinkedInIcon,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'hover:text-[#0A66C2]',
    },
    {
      name: 'Facebook',
      icon: FacebookIcon,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      color: 'hover:text-[#1877F2]',
    },
  ]

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs tracking-widest uppercase text-text-dim">
        Share Results
      </p>
      <div className="flex items-center gap-3">
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-muted transition-all hover:bg-white/10 hover:border-white/20 ${link.color}`}
            aria-label={`Share on ${link.name}`}
          >
            <link.icon className="w-5 h-5" />
          </a>
        ))}
        <button
          onClick={handleCopyLink}
          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
            copied
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-white/5 border-white/10 text-text-muted hover:bg-white/10 hover:border-white/20 hover:text-white'
          }`}
          aria-label={copied ? 'Link copied' : 'Copy link'}
        >
          {copied ? (
            <CheckIcon className="w-5 h-5" />
          ) : (
            <LinkIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  )
}
