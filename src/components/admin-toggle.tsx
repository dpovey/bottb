"use client";

import { useEffect } from "react";

export function AdminToggle() {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl+Alt+A toggles admin toolbar
      if (
        event.ctrlKey &&
        event.altKey &&
        (event.key === "a" || event.key === "å")
      ) {
        event.preventDefault();

        // Toggle toolbar collapsed state
        const isCollapsed = localStorage.getItem("admin-toolbar-collapsed");
        const newState = isCollapsed !== "true";
        localStorage.setItem("admin-toolbar-collapsed", String(newState));

        // Force page reload to update components
        window.location.reload();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return null;
}
