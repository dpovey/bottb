"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type {
  SocialAccount,
  SocialPostTemplate,
  SocialPostWithResults,
} from "@/lib/social/types";

interface SocialAccountsClientProps {
  initialAccounts: SocialAccount[];
  initialTemplates: SocialPostTemplate[];
  initialRecentPosts: SocialPostWithResults[];
}

// Platform display info
const platformInfo: Record<
  string,
  { name: string; icon: React.ReactNode; color: string }
> = {
  linkedin: {
    name: "LinkedIn",
    color: "#0A66C2",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  facebook: {
    name: "Facebook",
    color: "#0866FF",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  instagram: {
    name: "Instagram",
    color: "#E4405F",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z" />
      </svg>
    ),
  },
};

export function SocialAccountsClient({
  initialAccounts,
  initialTemplates,
  initialRecentPosts,
}: SocialAccountsClientProps) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [templates] = useState(initialTemplates);
  const [recentPosts] = useState(initialRecentPosts);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();

  // Check for success/error messages from OAuth callback
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");
  const errorMessage = searchParams.get("message");

  // Clear URL params after showing message
  const clearParams = () => {
    router.replace("/admin/social");
  };

  const handleDisconnect = async (provider: string) => {
    if (
      !confirm(
        `Are you sure you want to disconnect your ${provider} account? You will need to reconnect to post.`
      )
    ) {
      return;
    }

    setDisconnecting(provider);
    try {
      const response = await fetch(`/api/admin/social/${provider}/disconnect`, {
        method: "DELETE",
      });

      if (response.ok) {
        setAccounts((prev) => prev.filter((a) => a.provider !== provider));
      } else {
        const data = await response.json();
        alert(`Failed to disconnect: ${data.error}`);
      }
    } catch (err) {
      console.error("Disconnect error:", err);
      alert("Failed to disconnect account");
    } finally {
      setDisconnecting(null);
    }
  };

  const getAccountByProvider = (provider: string) =>
    accounts.find((a) => a.provider === provider);

  const linkedinAccount = getAccountByProvider("linkedin");
  const facebookAccount = getAccountByProvider("facebook");
  const instagramAccount = getAccountByProvider("instagram");

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Success/Error Messages */}
      {connected && (
        <div
          className="bg-green-500/20 border border-green-500/30 rounded-xl p-4 flex items-center justify-between"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-xl">✓</span>
            <span className="text-green-300">
              Successfully connected {connected}!
            </span>
          </div>
          <button
            onClick={clearParams}
            className="text-green-400 hover:text-green-300"
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 flex items-center justify-between"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-xl">✕</span>
            <span className="text-red-300">
              {errorMessage || `Connection failed: ${error}`}
            </span>
          </div>
          <button
            onClick={clearParams}
            className="text-red-400 hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Info Alert */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <svg
          className="w-5 h-5 shrink-0 mt-0.5 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="font-medium text-blue-300">Server-side tokens</p>
          <p className="text-sm text-blue-200/70 mt-1">
            All API tokens are stored securely on the server. Connect
            organization/page accounts to share content as Battle of the Tech
            Bands.
          </p>
        </div>
      </div>

      {/* Connected Accounts */}
      <div>
        <h2 className="font-semibold text-lg mb-4">Connected Accounts</h2>
        <div className="space-y-4">
          {/* LinkedIn */}
          <div className="bg-elevated rounded-xl border border-white/5 p-5">
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${platformInfo.linkedin.color}20` }}
              >
                <span style={{ color: platformInfo.linkedin.color }}>
                  {platformInfo.linkedin.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">LinkedIn</h3>
                  {linkedinAccount?.status === "active" && (
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px]">
                      Connected
                    </span>
                  )}
                </div>
                {linkedinAccount ? (
                  <>
                    <p className="text-sm text-muted mb-2">
                      {linkedinAccount.provider_account_name} (Organization)
                    </p>
                    <div className="flex items-center gap-4 text-xs text-dim">
                      <span>Connected {formatDate(linkedinAccount.connected_at)}</span>
                      {linkedinAccount.access_token_expires_at && (
                        <>
                          <span>•</span>
                          <span>
                            Expires in{" "}
                            {getDaysUntilExpiry(linkedinAccount.access_token_expires_at)}{" "}
                            days
                          </span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted">
                    Connect a LinkedIn Organization to post updates
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {linkedinAccount ? (
                  <>
                    <a
                      href="/api/admin/social/linkedin/connect"
                      className="px-3 py-1.5 rounded text-xs border border-white/20 hover:bg-white/5 transition-colors"
                    >
                      Reconnect
                    </a>
                    <button
                      onClick={() => handleDisconnect("linkedin")}
                      disabled={disconnecting === "linkedin"}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-dim hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Disconnect"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </>
                ) : (
                  <a
                    href="/api/admin/social/linkedin/connect"
                    className="px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-light transition-colors"
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Meta (Facebook + Instagram) */}
          <div className="bg-elevated rounded-xl border border-white/5 p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0866FF]/20 to-[#E4405F]/20 flex items-center justify-center shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">Meta (Facebook + Instagram)</h3>
                  {(facebookAccount || instagramAccount) && (
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-[10px]">
                      Connected
                    </span>
                  )}
                </div>
                {facebookAccount || instagramAccount ? (
                  <div className="space-y-2">
                    {facebookAccount && (
                      <div className="flex items-center gap-2 text-sm">
                        <span style={{ color: platformInfo.facebook.color }}>
                          {platformInfo.facebook.icon}
                        </span>
                        <span className="text-muted">
                          {facebookAccount.provider_account_name} (Page)
                        </span>
                      </div>
                    )}
                    {instagramAccount && (
                      <div className="flex items-center gap-2 text-sm">
                        <span style={{ color: platformInfo.instagram.color }}>
                          {platformInfo.instagram.icon}
                        </span>
                        <span className="text-muted">
                          @{instagramAccount.provider_account_name} (Business)
                        </span>
                      </div>
                    )}
                    {facebookAccount && (
                      <p className="text-xs text-dim mt-2">
                        Connected {formatDate(facebookAccount.connected_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    Connect a Facebook Page and Instagram Business account
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {facebookAccount || instagramAccount ? (
                  <>
                    <a
                      href="/api/admin/social/meta/connect"
                      className="px-3 py-1.5 rounded text-xs border border-white/20 hover:bg-white/5 transition-colors"
                    >
                      Reconnect
                    </a>
                    <button
                      onClick={() => handleDisconnect("meta")}
                      disabled={disconnecting === "meta"}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-dim hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Disconnect"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </>
                ) : (
                  <a
                    href="/api/admin/social/meta/connect"
                    className="px-4 py-2 rounded-lg text-sm bg-accent hover:bg-accent-light transition-colors"
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Post Templates */}
      <div className="pt-8 border-t border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-lg">Post Templates</h2>
            <p className="text-sm text-muted mt-1">
              Quick templates for common social posts
            </p>
          </div>
          <button className="px-4 py-2 rounded-lg text-sm border border-white/20 hover:bg-white/5 transition-colors flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Template
          </button>
        </div>

        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-elevated rounded-xl border border-white/5 p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <h4 className="font-medium">{template.name}</h4>
                <p className="text-sm text-dim truncate">
                  {template.description ||
                    template.caption_template ||
                    "No description"}
                </p>
              </div>
              <button
                className="p-2 rounded-lg hover:bg-white/10 text-dim hover:text-white transition-colors"
                title="Edit"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <div className="pt-8 border-t border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-lg">Recent Posts</h2>
              <p className="text-sm text-muted mt-1">History of shared content</p>
            </div>
          </div>

          <div className="bg-elevated rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="px-4 py-3 text-xs tracking-widest uppercase text-muted font-medium">
                    Date
                  </th>
                  <th className="px-4 py-3 text-xs tracking-widest uppercase text-muted font-medium">
                    Content
                  </th>
                  <th className="px-4 py-3 text-xs tracking-widest uppercase text-muted font-medium">
                    Platforms
                  </th>
                  <th className="px-4 py-3 text-xs tracking-widest uppercase text-muted font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentPosts.map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-muted">
                      {formatDate(post.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm truncate max-w-[200px] block">
                        {post.caption.slice(0, 50)}
                        {post.caption.length > 50 ? "..." : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {post.platforms.map((platform) => (
                          <span
                            key={platform}
                            style={{ color: platformInfo[platform]?.color }}
                            title={platformInfo[platform]?.name}
                          >
                            {platformInfo[platform]?.icon}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          post.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : post.status === "partial"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : post.status === "failed"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-white/10 text-muted"
                        }`}
                      >
                        {post.status === "completed"
                          ? "Published"
                          : post.status === "partial"
                          ? "Partial"
                          : post.status === "failed"
                          ? "Failed"
                          : post.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

