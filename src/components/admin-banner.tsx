"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";

export function AdminBanner() {
  const { data: session, status } = useSession();
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const hidden = localStorage.getItem("admin-banner-hidden");
    if (hidden === "true") {
      setIsHidden(true);
    }
  }, []);

  const handleHide = () => {
    setIsHidden(true);
    localStorage.setItem("admin-banner-hidden", "true");
  };

  // Don't show banner if not logged in, not admin, or hidden
  if (status === "loading" || !session?.user?.isAdmin || isHidden) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 text-center text-sm font-medium">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white/20">
            🔐 Admin
          </span>
          <span>
            Logged in as{" "}
            <strong>{session.user.name || session.user.email}</strong>
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <Link
            href="/admin"
            className="hover:text-blue-200 transition-colors underline"
          >
            Admin Dashboard
          </Link>
          <button
            onClick={handleHide}
            className="hover:text-blue-200 transition-colors underline"
            title="Hide banner"
          >
            ✕ Hide
          </button>
          <button
            onClick={() => signOut()}
            className="hover:text-blue-200 transition-colors underline"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
