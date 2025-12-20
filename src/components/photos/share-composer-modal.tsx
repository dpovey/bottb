"use client";

import { useState, useEffect, useCallback } from "react";
import { Photo } from "@/lib/db";
import {
  SocialPlatform,
  SocialAccount,
  SocialPostTemplate,
  SocialPostResult,
} from "@/lib/social/types";
import { trackPhotoShare } from "@/lib/analytics";
import {
  LinkedInIcon,
  FacebookIcon,
  InstagramIcon,
  CloseIcon,
  CheckIcon,
  SpinnerIcon,
  LightningIcon,
  ShareIcon,
} from "@/components/icons";

// Platform icons mapping
const PlatformIcon: Record<string, React.ReactNode> = {
  linkedin: <LinkedInIcon className="w-5 h-5" />,
  facebook: <FacebookIcon className="w-5 h-5" />,
  instagram: <InstagramIcon className="w-5 h-5" />,
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

        // Track successful shares for each platform
        const results = data.results || [];
        results.forEach((result: SocialPostResult) => {
          if (result.status === "success" && firstPhoto) {
            // Track each photo that was shared
            photos.forEach((photo) => {
              trackPhotoShare({
                photo_id: photo.id,
                share_method: result.platform as "linkedin" | "facebook" | "instagram",
                event_id: photo.event_id || null,
                band_id: photo.band_id || null,
                event_name: photo.event_name || null,
                band_name: photo.band_name || null,
              });
            });
          }
        });
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
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-xs"
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
            <CloseIcon className="w-5 h-5" />
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
                <SpinnerIcon className="w-4 h-4 animate-spin" />
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
                          <CheckIcon className="w-4 h-4 text-accent ml-1" />
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
                className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white text-sm focus:outline-hidden focus:border-accent/50 hover:border-white/20 transition-colors appearance-none"
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
                className="w-full px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder:text-text-dim focus:outline-hidden focus:border-accent/50 hover:border-white/20 transition-colors disabled:opacity-50"
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
                className="border border-accent/50 text-accent hover:bg-accent/10 px-3 py-1 rounded-sm text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isGeneratingAI ? (
                  <>
                    <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <LightningIcon className="w-3.5 h-3.5" />
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
              className="w-full min-h-[120px] px-4 py-3 bg-bg border border-white/10 rounded-lg text-white placeholder:text-text-dim focus:outline-hidden focus:border-accent/50 hover:border-white/20 transition-colors resize-y disabled:opacity-50"
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
                className="w-4 h-4 rounded-sm border-white/30 bg-bg text-accent focus:ring-accent focus:ring-offset-0"
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
                className="w-4 h-4 rounded-sm border-white/30 bg-bg text-accent focus:ring-accent focus:ring-offset-0"
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
                    <SpinnerIcon className="w-4 h-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <ShareIcon className="w-4 h-4" />
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
