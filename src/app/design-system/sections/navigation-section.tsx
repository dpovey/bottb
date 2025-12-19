"use client";

import { ChevronRightIcon, MenuIcon, LinkedInIcon, YouTubeIcon, InstagramIcon, FacebookIcon, TikTokIcon } from "@/components/icons";

export function NavigationSection() {
  return (
    <div className="space-y-20">
      {/* Navigation Structure */}
      <section id="nav-breadcrumbs">
        <h2 className="font-semibold text-4xl mb-8">Navigation & Breadcrumbs</h2>

        <div className="space-y-8">
          {/* Nav Structure */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Navigation Structure</h3>
            <p className="text-text-dim text-sm mb-6">
              Logo left • Main nav centered • Breadcrumbs right. Chevron separators. Hidden on mobile (hamburger menu instead).
            </p>

            {/* Full Nav Example */}
            <div className="bg-bg/80 backdrop-blur-md rounded-lg border border-white/5">
              <div className="flex items-center h-14 px-4">
                {/* Logo */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded bg-bg-surface" />
                  <span className="text-xs text-text-dim">Logo</span>
                </div>

                {/* Nav Links (centered) */}
                <div className="hidden md:flex items-center justify-center gap-6 flex-1">
                  <a href="#" className="text-xs tracking-widest uppercase text-white">Events</a>
                  <a href="#" className="text-xs tracking-widest uppercase text-text-muted hover:text-white transition-colors">Photos</a>
                  <a href="#" className="text-xs tracking-widest uppercase text-text-muted hover:text-white transition-colors">About</a>
                </div>

                {/* Breadcrumbs (right) */}
                <nav className="hidden md:flex items-center gap-2 text-xs shrink-0">
                  <a href="#" className="text-text-dim hover:text-text-muted transition-colors">Events</a>
                  <ChevronRightIcon className="w-2.5 h-2.5 text-text-dim" />
                  <a href="#" className="text-text-muted hover:text-white transition-colors">Sydney 2025</a>
                  <ChevronRightIcon className="w-2.5 h-2.5 text-text-dim" />
                  <span className="text-white">Band</span>
                </nav>

                {/* Mobile menu */}
                <button className="md:hidden ml-auto text-text-muted hover:text-white">
                  <MenuIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Home Page Nav */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Home Page (No Breadcrumbs)</h3>
            <p className="text-text-dim text-sm mb-6">
              On the home page, breadcrumbs are not needed. The right side is empty or can show a mobile menu button.
            </p>

            <div className="bg-bg/80 backdrop-blur-md rounded-lg border border-white/5">
              <div className="flex items-center h-14 px-4">
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-8 h-8 rounded bg-bg-surface" />
                </div>
                <div className="flex items-center justify-center gap-6 flex-1">
                  <a href="#" className="text-xs tracking-widest uppercase text-white">Events</a>
                  <a href="#" className="text-xs tracking-widest uppercase text-text-muted">Photos</a>
                  <a href="#" className="text-xs tracking-widest uppercase text-text-muted">About</a>
                </div>
                <div className="w-8" />
              </div>
            </div>
          </div>

          {/* Breadcrumb Paths */}
          <div className="bg-bg-surface rounded-lg p-6">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Breadcrumb Paths by Page</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-text-muted font-medium">Page</th>
                    <th className="text-left py-2 text-text-muted font-medium">Breadcrumb</th>
                  </tr>
                </thead>
                <tbody className="text-text-dim">
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white">Home</td>
                    <td className="py-2 italic">None</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white">Event</td>
                    <td className="py-2">Events › <span className="text-white">Sydney Tech Battle 2025</span></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white">Band</td>
                    <td className="py-2">Events › Sydney Tech Battle 2025 › <span className="text-white">The Agentics</span></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white">Results</td>
                    <td className="py-2">Events › Sydney Tech Battle 2025 › <span className="text-white">Results</span></td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4 text-white">Vote</td>
                    <td className="py-2">Events › Sydney Tech Battle 2025 › <span className="text-white">Vote</span></td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-white">Photos</td>
                    <td className="py-2">Home › <span className="text-white">Photos</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Breadcrumb Colors */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Breadcrumb Colors</h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-text-dim">Ancestors</span>
                <code className="bg-bg-surface px-2 py-0.5 rounded text-xs">text-dim</code>
              </div>
              <ChevronRightIcon className="w-3 h-3 text-text-dim" />
              <div className="flex items-center gap-2">
                <span className="text-text-muted">Parent</span>
                <code className="bg-bg-surface px-2 py-0.5 rounded text-xs">text-muted</code>
              </div>
              <ChevronRightIcon className="w-3 h-3 text-text-dim" />
              <div className="flex items-center gap-2">
                <span className="text-white">Current</span>
                <code className="bg-bg-surface px-2 py-0.5 rounded text-xs">text-white</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Icons */}
      <section id="social-icons">
        <h2 className="font-semibold text-4xl mb-8">Social Icons</h2>

        <div className="space-y-8">
          {/* Hero Style */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Hero Style (Circular Buttons)</h3>
            <p className="text-text-dim text-sm mb-6">Used in hero sections. Larger touch targets.</p>

            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" title="LinkedIn">
                <LinkedInIcon className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" title="YouTube">
                <YouTubeIcon className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" title="Instagram">
                <InstagramIcon className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" title="Facebook">
                <FacebookIcon className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" title="TikTok">
                <TikTokIcon className="w-5 h-5" />
              </a>
              <span className="text-text-dim mx-2">|</span>
              <a href="mailto:info@bottb.com" className="text-text-muted hover:text-white transition-colors text-sm">info@bottb.com</a>
            </div>
          </div>

          {/* Footer Style */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Footer Style (Inline Icons)</h3>
            <p className="text-text-dim text-sm mb-6">Used in simple footers. Smaller, inline.</p>

            <div className="flex items-center gap-4">
              <a href="#" className="text-text-dim hover:text-white transition-colors" title="LinkedIn">
                <LinkedInIcon className="w-4 h-4" />
              </a>
              <a href="#" className="text-text-dim hover:text-white transition-colors" title="YouTube">
                <YouTubeIcon className="w-4 h-4" />
              </a>
              <a href="#" className="text-text-dim hover:text-white transition-colors" title="Instagram">
                <InstagramIcon className="w-4 h-4" />
              </a>
              <a href="#" className="text-text-dim hover:text-white transition-colors" title="Facebook">
                <FacebookIcon className="w-4 h-4" />
              </a>
              <a href="#" className="text-text-dim hover:text-white transition-colors" title="TikTok">
                <TikTokIcon className="w-4 h-4" />
              </a>
              <span className="text-text-dim/50 mx-1">|</span>
              <a href="mailto:info@bottb.com" className="text-text-dim hover:text-white transition-colors text-sm">info@bottb.com</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Components */}
      <section id="footer-components">
        <h2 className="font-semibold text-4xl mb-8">Footer Components</h2>

        <div className="space-y-8">
          {/* Full Footer */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Full Footer (4-Column)</h3>
            <p className="text-text-dim text-sm mb-6">Used on: home.html, about.html — Sitemap, social links, copyright.</p>

            <div className="bg-bg rounded-lg p-8 border border-white/5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                <div>
                  <div className="flex items-start gap-3">
                    <div className="w-16 h-16 bg-bg-surface rounded" />
                    <p className="text-text-dim text-xs mt-2">Where technology meets rock &apos;n&apos; roll.</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs tracking-widest uppercase text-text-muted mb-4">Events</h4>
                  <ul className="space-y-2 text-sm text-text-dim">
                    <li><a href="#" className="hover:text-white transition-colors">Upcoming</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Past Events</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Results</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs tracking-widest uppercase text-text-muted mb-4">Connect</h4>
                  <ul className="space-y-2 text-sm text-text-dim">
                    <li><a href="#" className="hover:text-white transition-colors">LinkedIn</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">YouTube</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Instagram</a></li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs tracking-widest uppercase text-text-muted mb-4">Info</h4>
                  <ul className="space-y-2 text-sm text-text-dim">
                    <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                    <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                  </ul>
                </div>
              </div>
              <div className="border-t border-white/5 pt-6 text-center text-text-dim text-sm">
                <p>© 2025 Battle of the Tech Bands. All rights reserved.</p>
              </div>
            </div>
          </div>

          {/* Simple Footer */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Simple Footer</h3>
            <p className="text-text-dim text-sm mb-6">Used on: event.html, band.html, results.html, voting.html, photos.html</p>

            <div className="bg-bg rounded-lg p-6 border border-white/5">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-bg-surface rounded opacity-60" />
                  <span className="text-text-dim text-sm">A community charity event supporting Youngcare</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <LinkedInIcon className="w-4 h-4 text-text-dim/50" />
                    <YouTubeIcon className="w-4 h-4 text-text-dim/50" />
                    <InstagramIcon className="w-4 h-4 text-text-dim/50" />
                    <FacebookIcon className="w-4 h-4 text-text-dim/50" />
                    <TikTokIcon className="w-4 h-4 text-text-dim/50" />
                  </div>
                  <span className="text-text-dim/50">|</span>
                  <span className="text-text-dim text-sm">info@bottb.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

