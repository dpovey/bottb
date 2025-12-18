"use client";

import { useState, useEffect, useCallback } from "react";
import { Photo } from "@/lib/db";
import {
  SocialPlatform,
  SocialAccount,
  SocialPostTemplate,
  SocialPostResult,
} from "@/lib/social/types";

// Platform icons
const PlatformIcon = {
  linkedin: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  facebook: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  instagram: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
    </svg>
  ),
};

interface ShareComposerModalProps {
  photos: Photo[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function ShareComposerModal({
  photos,
  onClose,
  onSuccess,
}: ShareComposerModalProps) {
  // Connected accounts state
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [templates, setTemplates] = useState<SocialPostTemplate[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Form state
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    []
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [includePhotographerCredit, setIncludePhotographerCredit] =
    useState(true);
  const [includeEventLink, setIncludeEventLink] = useState(true);

  // Posting state
  const [isPosting, setIsPosting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [postResults, setPostResults] = useState<SocialPostResult[] | null>(
    null
  );
  const [postError, setPostError] = useState<string | null>(null);

  // Get photo context
  const firstPhoto = photos[0];
  const photographer = firstPhoto?.photographer || "Unknown photographer";
  const bandName = firstPhoto?.band_name || "";
  const eventName = firstPhoto?.event_name || "";
  const companyName = firstPhoto?.company_name || "";

  // Fetch connected accounts and templates
  useEffect(() => {
    async function fetchData() {
      try {
        const [accountsRes, templatesRes] = await Promise.all([
          fetch("/api/admin/social/accounts"),
          fetch("/api/admin/social/templates"),
        ]);

        if (accountsRes.ok) {
          const data = await accountsRes.json();
          setAccounts(data.accounts || []);

          // Auto-select all connected platforms
          const connectedPlatforms = (data.accounts || [])
            .filter((a: SocialAccount) => a.status === "active")
            .map((a: SocialAccount) => a.provider as SocialPlatform);
          setSelectedPlatforms(
            Array.from(new Set(connectedPlatforms)) as SocialPlatform[]
          );
        }

        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data.templates || []);
        }
      } catch (error) {
        console.error("Failed to fetch social data:", error);
      } finally {
        setLoadingAccounts(false);
      }
    }

    fetchData();
  }, []);

  // Toggle platform selection
  const togglePlatform = (platform: SocialPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  // Check if platform is connected
  const isPlatformConnected = (platform: SocialPlatform) => {
    return accounts.some(
      (a) => a.provider === platform && a.status === "active"
    );
  };

  // Apply template
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);

    if (templateId) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        if (template.title_template) {
          setTitle(applyPlaceholders(template.title_template));
        }
        if (template.caption_template) {
          setCaption(applyPlaceholders(template.caption_template));
        }
        setIncludePhotographerCredit(template.include_photographer_credit);
        setIncludeEventLink(template.include_event_link);
      }
    }
  };

  // Apply placeholders to template text
  const applyPlaceholders = (text: string) => {
    return text
      .replace(/{band_name}/g, bandName || "")
      .replace(/{event_name}/g, eventName || "")
      .replace(/{photographer}/g, photographer || "")
      .replace(/{company_name}/g, companyName || "")
      .replace(/{photo_count}/g, photos.length.toString());
  };

  // Generate AI caption
  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetch("/api/admin/social/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: eventName,
          band_name: bandName,
          company_name: companyName,
          photographer_name: photographer,
          photo_count: photos.length,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCaption(data.suggestion || "");
      } else {
        const error = await response.json();
        setPostError(error.error || "Failed to generate AI suggestion");
      }
    } catch (error) {
      console.error("AI generation failed:", error);
      setPostError("Failed to generate AI suggestion");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Submit post
  const handleSubmit = useCallback(async () => {
    if (selectedPlatforms.length === 0) {
      setPostError("Please select at least one platform");
      return;
    }

    if (!caption.trim()) {
      setPostError("Please enter a caption");
      return;
    }

    setIsPosting(true);
    setPostError(null);
    setPostResults(null);

    try {
      const response = await fetch("/api/admin/social/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          title: title || undefined,
          caption,
          photo_ids: photos.map((p) => p.id),
          event_id: firstPhoto?.event_id || undefined,
          band_id: firstPhoto?.band_id || undefined,
          template_id: selectedTemplateId || undefined,
          include_photographer_credit: includePhotographerCredit,
          include_event_link: includeEventLink,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setPostResults(data.results || []);
        onSuccess?.();
      } else {
        setPostError(data.error || "Failed to post");
      }
    } catch (error) {
      console.error("Post failed:", error);
      setPostError("Failed to post. Please try again.");
    } finally {
      setIsPosting(false);
    }
  }, [
    selectedPlatforms,
    caption,
    title,
    photos,
    firstPhoto,
    selectedTemplateId,
    includePhotographerCredit,
    includeEventLink,
    onSuccess,
  ]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPosting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isPosting]);

  const hasResults = postResults && postResults.length > 0;
  const allSuccess =
    hasResults && postResults.every((r) => r.status === "success");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={!isPosting ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-bg-elevated rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-xl">Share to Social</h2>
            <p className="text-sm text-text-muted">
              Post photos to connected platforms
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isPosting}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-text-muted hover:text-white disabled:opacity-50"
            title="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Photo Preview */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-text-muted mb-3">
              Photos ({photos.length} selected)
            </label>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2">
              {photos.slice(0, 8).map((photo) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-lg overflow-hidden bg-bg relative"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnail_url || photo.blob_url}
                    alt={photo.original_filename || "Photo"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {photos.length > 8 && (
                <div className="aspect-square rounded-lg bg-bg-elevated flex items-center justify-center text-text-muted text-sm font-medium">
                  +{photos.length - 8}
                </div>
              )}
            </div>
            <p className="text-xs text-text-dim mt-2">
              {bandName && `${bandName} @ `}
              {eventName || "Event"}
              {photographer && ` · Photo by ${photographer}`}
            </p>
          </div>

          {/* Platform Selection */}
          <div>
            <label className="block text-xs tracking-widest uppercase text-text-muted mb-3">
              Share to
            </label>
            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-text-muted text-sm">
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-4 bg-warning/10 border border-warning/30 rounded-lg text-warning text-sm">
                No social accounts connected.{" "}
                <a
                  href="/admin/social"
                  className="underline hover:no-underline"
                >
                  Connect accounts →
                </a>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(["linkedin", "facebook", "instagram"] as SocialPlatform[]).map(
                  (platform) => {
                    const connected = isPlatformConnected(platform);
                    const selected = selectedPlatforms.includes(platform);

                    return (
                      <button
                        key={platform}
                        onClick={() => connected && togglePlatform(platform)}
                        disabled={!connected || isPosting}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                          selected
                            ? "border-accent bg-accent/10 text-white"
                            : connected
                              ? "border-white/10 hover:border-white/30 text-text-muted hover:text-white"
                              : "border-white/10 opacity-40 cursor-not-allowed"
                        }`}
                      >
                        {PlatformIcon[platform]}
                        <span className="text-sm font-medium capitalize">
                          {platform}
                        </span>
                        {selected && (
                          <svg
                            className="w-4 h-4 text-accent ml-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                        {!connected && (
                          <span className="text-[10px] text-text-dim ml-1">
                            Not connected
                          </span>
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* Template Selection */}
          {templates.length > 0 && (
            <div>
              <label className="block text-xs tracking-widest uppercase text-text-muted mb-2">
                Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                disabled={isPosting}
                className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent/50 hover:border-white/20 transition-colors appearance-none"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23666666' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: "right 0.75rem center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "1.25em 1.25em",
                }}
              >
                <option value="">Custom post</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title (LinkedIn) */}
          {selectedPlatforms.includes("linkedin") && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs tracking-widest uppercase text-text-muted">
                  Title
                </label>
                <span className="text-xs text-text-dim">LinkedIn only</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Bandlassian rocks Sydney Tech Battle 2025!"
                disabled={isPosting}
                className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder:text-text-dim focus:outline-none focus:border-accent/50 hover:border-white/20 transition-colors disabled:opacity-50"
              />
            </div>
          )}

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs tracking-widest uppercase text-text-muted">
                Caption
              </label>
              <button
                onClick={handleGenerateAI}
                disabled={isPosting || isGeneratingAI}
                className="border border-accent/50 text-accent hover:bg-accent/10 px-3 py-1 rounded text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isGeneratingAI ? (
                  <>
                    <svg
                      className="w-3.5 h-3.5 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Suggest with AI
                  </>
                )}
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption here..."
              disabled={isPosting}
              className="w-full min-h-[120px] px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder:text-text-dim focus:outline-none focus:border-accent/50 hover:border-white/20 transition-colors resize-y disabled:opacity-50"
            />
            <p className="text-xs text-text-dim mt-2">
              Tip: Use @handles for Instagram to tag photographers
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includePhotographerCredit}
                onChange={(e) => setIncludePhotographerCredit(e.target.checked)}
                disabled={isPosting}
                className="w-4 h-4 rounded border-white/30 bg-bg text-accent focus:ring-accent focus:ring-offset-0"
              />
              <span className="text-sm">Include photographer credit</span>
              {photographer && (
                <span className="text-xs text-text-dim ml-auto">
                  {photographer}
                </span>
              )}
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeEventLink}
                onChange={(e) => setIncludeEventLink(e.target.checked)}
                disabled={isPosting}
                className="w-4 h-4 rounded border-white/30 bg-bg text-accent focus:ring-accent focus:ring-offset-0"
              />
              <span className="text-sm">Include event link</span>
              {firstPhoto?.event_id && (
                <span className="text-xs text-text-dim ml-auto">
                  bottb.com/event/{firstPhoto.event_id}
                </span>
              )}
            </label>
          </div>

          {/* Post Results */}
          {hasResults && (
            <div>
              <label className="block text-xs tracking-widest uppercase text-text-muted mb-3">
                Post Status
              </label>
              <div className="space-y-2">
                {postResults.map((result) => (
                  <div
                    key={result.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.status === "success"
                        ? "bg-success/10 border border-success/20"
                        : "bg-error/10 border border-error/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          result.status === "success"
                            ? "text-success"
                            : "text-error"
                        }
                      >
                        {PlatformIcon[result.platform]}
                      </span>
                      <div>
                        <span
                          className={`text-sm font-medium capitalize ${
                            result.status === "success"
                              ? "text-success"
                              : "text-error"
                          }`}
                        >
                          {result.platform}
                        </span>
                        {result.status === "failed" && result.error_message && (
                          <p className="text-xs text-error/80">
                            {result.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                    {result.status === "success" && result.external_post_url && (
                      <a
                        href={result.external_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-success hover:underline"
                      >
                        View post →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {postError && (
            <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {postError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between shrink-0 bg-bg-elevated">
          <div className="text-sm text-text-muted">
            <span className="font-medium text-white">
              {selectedPlatforms.length}
            </span>{" "}
            platform{selectedPlatforms.length !== 1 ? "s" : ""} selected
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isPosting}
              className="border border-white/30 hover:border-white/60 hover:bg-white/5 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {allSuccess ? "Close" : "Cancel"}
            </button>
            {!allSuccess && (
              <button
                onClick={handleSubmit}
                disabled={
                  isPosting ||
                  selectedPlatforms.length === 0 ||
                  !caption.trim()
                }
                className="bg-accent hover:bg-accent-light px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPosting ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Posting...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                      />
                    </svg>
                    Share Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

