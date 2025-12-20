"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type {
  SocialAccount,
  SocialPostTemplate,
  SocialPostWithResults,
} from "@/lib/social/types";
import {
  LinkedInIcon,
  FacebookIcon,
  InstagramIcon,
  DeleteIcon,
  EditIcon,
  InfoIcon,
  PlusIcon,
} from "@/components/icons";

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
    icon: <LinkedInIcon className="w-5 h-5" />,
  },
  facebook: {
    name: "Facebook",
    color: "#0866FF",
    icon: <FacebookIcon className="w-5 h-5" />,
  },
  instagram: {
    name: "Instagram",
    color: "#E4405F",
    icon: <InstagramIcon className="w-5 h-5" />,
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
        <InfoIcon className="w-5 h-5 shrink-0 mt-0.5 text-blue-400" />
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
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-sm text-[10px]">
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
                      className="px-3 py-1.5 rounded-sm text-xs border border-white/20 hover:bg-white/5 transition-colors"
                    >
                      Reconnect
                    </a>
                    <button
                      onClick={() => handleDisconnect("linkedin")}
                      disabled={disconnecting === "linkedin"}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-dim hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Disconnect"
                    >
                      <DeleteIcon className="w-4 h-4" />
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
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-[#0866FF]/20 to-[#E4405F]/20 flex items-center justify-center shrink-0">
                <FacebookIcon size={24} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">Meta (Facebook + Instagram)</h3>
                  {(facebookAccount || instagramAccount) && (
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-sm text-[10px]">
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
                      className="px-3 py-1.5 rounded-sm text-xs border border-white/20 hover:bg-white/5 transition-colors"
                    >
                      Reconnect
                    </a>
                    <button
                      onClick={() => handleDisconnect("meta")}
                      disabled={disconnecting === "meta"}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-dim hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Disconnect"
                    >
                      <DeleteIcon className="w-4 h-4" />
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
            <PlusIcon className="w-4 h-4" />
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
                <EditIcon className="w-4 h-4" />
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
                    className="border-b border-white/5 hover:bg-white/2 transition-colors"
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

