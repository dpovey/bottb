"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  FoundationsSection,
  ActionsSection,
  DisplaySection,
  FormsSection,
  NavigationSection,
  LayoutSection,
  IconsSection,
} from "./sections";

const TABS = [
  { id: "foundations", label: "Foundations" },
  { id: "actions", label: "Actions" },
  { id: "display", label: "Display" },
  { id: "forms", label: "Forms" },
  { id: "navigation", label: "Navigation" },
  { id: "layout", label: "Layout" },
  { id: "icons", label: "Icons" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Sidebar sections for each tab
const SIDEBAR_SECTIONS: Record<TabId, { id: string; label: string }[]> = {
  foundations: [
    { id: "design-philosophy", label: "Design Philosophy" },
    { id: "color-palette", label: "Color Palette" },
    { id: "typography", label: "Typography" },
  ],
  actions: [
    { id: "buttons", label: "Buttons" },
  ],
  display: [
    { id: "badges", label: "Badges & Labels" },
    { id: "alerts", label: "Alerts & Messages" },
    { id: "date-badges", label: "Date Badges" },
    { id: "numbered-indicators", label: "Numbered Indicators" },
    { id: "cards", label: "Cards" },
    { id: "skeletons", label: "Skeletons" },
  ],
  forms: [
    { id: "form-elements", label: "Form Elements" },
    { id: "filter-components", label: "Filter Components" },
    { id: "form-layout", label: "Form Layout Example" },
  ],
  navigation: [
    { id: "nav-breadcrumbs", label: "Navigation & Breadcrumbs" },
    { id: "social-icons", label: "Social Icons" },
    { id: "footer-components", label: "Footer Components" },
  ],
  layout: [
    { id: "hero-sections", label: "Hero Sections" },
    { id: "page-layouts", label: "Page Layouts" },
    { id: "breakpoints-spacing", label: "Breakpoints & Spacing" },
  ],
  icons: [
    { id: "icon-gallery", label: "Icon Gallery" },
    { id: "icon-sizes", label: "Icon Sizes" },
    { id: "icon-colors", label: "Icon Colors" },
  ],
};

function Sidebar({ activeTab, activeSection, onSectionClick }: { 
  activeTab: TabId; 
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}) {
  const sections = SIDEBAR_SECTIONS[activeTab];
  
  return (
    <nav className="hidden lg:block w-56 shrink-0">
      <div className="sticky top-36 space-y-1">
        <p className="text-xs tracking-widest uppercase text-text-dim mb-3 px-3">
          On this page
        </p>
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={cn(
              "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors",
              activeSection === section.id
                ? "bg-white/10 text-white"
                : "text-text-muted hover:text-white hover:bg-white/5"
            )}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export function DesignSystemClient() {
  const [activeTab, setActiveTab] = useState<TabId>("foundations");
  const [activeSection, setActiveSection] = useState<string>("");

  // Sync with URL hash on mount and hash change
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as TabId;
      if (TABS.some((tab) => tab.id === hash)) {
        setActiveTab(hash);
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const sections = SIDEBAR_SECTIONS[activeTab];
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -60% 0px", threshold: 0 }
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [activeTab]);

  // Update URL hash when tab changes
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setActiveSection(SIDEBAR_SECTIONS[tabId][0]?.id || "");
    window.history.replaceState(null, "", `#${tabId}`);
    // Scroll to top of content area
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSectionClick = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 120; // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: elementPosition - offset, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-bg/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Title */}
          <div className="py-6">
            <h1 className="font-semibold text-3xl sm:text-4xl">Design System</h1>
            <p className="text-text-muted mt-2">
              Component library and design tokens for Battle of the Tech Bands
            </p>
          </div>

          {/* Tabs */}
          <nav
            className="flex gap-1 overflow-x-auto pb-4 -mb-px scrollbar-hide"
            role="tablist"
            aria-label="Design system sections"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "px-4 py-2 text-sm tracking-widest uppercase whitespace-nowrap rounded-lg transition-all",
                  activeTab === tab.id
                    ? "bg-white/10 text-white"
                    : "text-text-muted hover:text-white hover:bg-white/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content with Sidebar */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="flex gap-12">
          {/* Sidebar - desktop only */}
          <Sidebar 
            activeTab={activeTab} 
            activeSection={activeSection}
            onSectionClick={handleSectionClick}
          />

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div
              id={`panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={activeTab}
            >
              {activeTab === "foundations" && <FoundationsSection />}
              {activeTab === "actions" && <ActionsSection />}
              {activeTab === "display" && <DisplaySection />}
              {activeTab === "forms" && <FormsSection />}
              {activeTab === "navigation" && <NavigationSection />}
              {activeTab === "layout" && <LayoutSection />}
              {activeTab === "icons" && <IconsSection />}
            </div>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
          <p className="text-text-dim text-sm">
            Internal documentation • Not for public use
          </p>
        </div>
      </footer>
    </div>
  );
}

