"use client";

import { useEffect } from "react";

export function AdminToggle() {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (
        event.ctrlKey &&
        event.altKey &&
        (event.key === "a" || event.key === "å")
      ) {
        event.preventDefault();

        // Get current states
        const bannerHidden = localStorage.getItem("admin-banner-hidden");
        const indicatorHidden = localStorage.getItem("admin-indicator-hidden");

        // If both are hidden independently, sync them to banner's state
        if (bannerHidden === "true" && indicatorHidden === "true") {
          // Both hidden - show both (banner as truth)
          localStorage.setItem("admin-banner-hidden", "false");
          localStorage.setItem("admin-indicator-hidden", "false");
        } else {
          // Normal toggle - use banner as truth
          const newBannerHidden = bannerHidden !== "true";
          localStorage.setItem(
            "admin-banner-hidden",
            newBannerHidden.toString()
          );
          localStorage.setItem(
            "admin-indicator-hidden",
            newBannerHidden.toString()
          );
        }

        // Force page reload to update components
        window.location.reload();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return null;
}
