"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect } from "react";

export function AdminIndicator() {
  const { data: session } = useSession();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const hidden = localStorage.getItem("admin-indicator-hidden");
    if (hidden === "true") {
      setIsHidden(true);
    }
  }, []);

  const handleHide = () => {
    setIsHidden(true);
    localStorage.setItem("admin-indicator-hidden", "true");
    setIsExpanded(false);
  };

  // Don't show indicator if not logged in, not admin, or hidden
  if (!session?.user?.isAdmin || isHidden) {
    return null;
  }

  return (
    <>
      {/* Floating Admin Button */}
      <div className="fixed top-4 right-4 z-50">
        <div className="relative">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
          >
            <span className="text-lg">🔐</span>
            <span className="font-medium">Admin</span>
            <span
              className={`transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </button>

          {/* Dropdown Menu */}
          {isExpanded && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">Admin Panel</p>
                <p className="text-xs text-gray-500">
                  {session.user.name || session.user.email}
                </p>
              </div>

              <div className="py-1">
                <Link
                  href="/admin"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsExpanded(false)}
                >
                  📊 Dashboard
                </Link>
                <button
                  onClick={handleHide}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  ✕ Hide Admin Panel
                </button>
                <button
                  onClick={() => {
                    signOut();
                    setIsExpanded(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  🚪 Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </>
  );
}
