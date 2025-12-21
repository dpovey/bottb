'use client'

import { Badge, DateBadge, Button } from '@/components/ui'
import { ChevronRightIcon } from '@/components/icons'

export function LayoutSection() {
  return (
    <div className="space-y-20">
      {/* Hero Sections */}
      <section id="hero-sections">
        <h2 className="font-semibold text-4xl mb-8">Hero Sections</h2>

        <div className="space-y-8">
          {/* Home Hero */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Home Hero (Centered, Full Height)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Used on: home page — Logo prominent, centered content, full
              viewport height.
            </p>

            <div className="relative h-80 rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-b from-purple-900/30 via-bg-muted to-bg" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center px-4">
                  <div className="w-32 h-8 bg-bg-surface rounded-sm mx-auto mb-4" />
                  <h2 className="text-2xl font-semibold mb-2">
                    Battle of the Tech Bands
                  </h2>
                  <p className="text-text-muted text-sm mb-6">
                    Sydney 2025 is coming
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline-solid" size="sm">
                      Register Interest
                      <ChevronRightIcon className="w-3 h-3" />
                    </Button>
                    <Button variant="outline-solid" size="sm">
                      View Events
                      <ChevronRightIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Event Hero */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Event Hero (Left-aligned, 70vh)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Used on: event page — Date badge, left-aligned content, background
              image.
            </p>

            <div className="relative h-80 rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-transparent" />
              <div className="absolute inset-0 bg-linear-to-br from-purple-900/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <div className="flex items-start gap-4">
                  <DateBadge date={new Date('2025-10-23')} size="lg" showYear />
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Badge>Upcoming</Badge>
                      <span className="text-text-dim text-sm">
                        8 Bands Competing
                      </span>
                    </div>
                    <h3 className="font-semibold text-2xl mb-2">
                      Sydney Tech Battle 2025
                    </h3>
                    <p className="text-text-muted text-sm mb-4">
                      The Metro Theatre • Sydney, Australia
                    </p>
                    <div className="flex gap-3">
                      <Button variant="filled" size="sm">
                        Vote Now
                      </Button>
                      <Button variant="outline-solid" size="sm">
                        Get Tickets
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Hero */}
          <div className="bg-bg-elevated rounded-xl p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Content Hero (Left-aligned with Social)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Used on: about page, band page — Background image, social icons,
              left-aligned.
            </p>

            <div className="relative h-64 rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/70 to-bg/40" />
              <div className="absolute inset-0 bg-linear-to-r from-purple-900/30 to-indigo-900/20" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-xs tracking-widest uppercase text-text-muted mb-2">
                  Band Profile
                </p>
                <h3 className="font-bold text-2xl mb-1">The Agentics</h3>
                <p className="text-text-muted text-sm mb-4">
                  Representing Salesforce
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/10" />
                  <div className="w-8 h-8 rounded-full bg-white/10" />
                  <div className="w-8 h-8 rounded-full bg-white/10" />
                  <span className="text-text-dim text-xs ml-2">
                    Social icons
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Page Layouts */}
      <section id="page-layouts">
        <h2 className="font-semibold text-4xl mb-8">Page Layouts</h2>
        <p className="text-text-muted text-lg mb-8 max-w-3xl">
          Three primary layout patterns used across the site.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Home Layout */}
          <div className="bg-bg-elevated rounded-lg p-4 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              HomeLayout
            </h3>
            <div className="bg-bg rounded-lg overflow-hidden border border-white/5">
              {/* Mini nav */}
              <div className="h-4 bg-bg-surface border-b border-white/5" />
              {/* Hero area */}
              <div className="h-24 bg-linear-to-b from-purple-900/20 to-bg flex items-center justify-center">
                <div className="w-16 h-4 bg-bg-surface rounded-sm" />
              </div>
              {/* Content */}
              <div className="p-3 border-t border-white/5">
                <div className="max-w-[80%] mx-auto space-y-2">
                  <div className="h-2 bg-bg-surface rounded-sm w-full" />
                  <div className="h-2 bg-bg-surface rounded-sm w-3/4" />
                </div>
              </div>
              {/* Footer */}
              <div className="h-8 bg-bg-surface border-t border-white/5" />
            </div>
            <p className="text-text-dim text-xs mt-3">
              Full-bleed hero, constrained content
            </p>
          </div>

          {/* Web Layout */}
          <div className="bg-bg-elevated rounded-lg p-4 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              WebLayout
            </h3>
            <div className="bg-bg rounded-lg overflow-hidden border border-white/5">
              {/* Mini nav */}
              <div className="h-4 bg-bg-surface border-b border-white/5" />
              {/* Content */}
              <div className="p-3 h-32">
                <div className="max-w-[80%] mx-auto space-y-2">
                  <div className="h-2 bg-bg-surface rounded-sm w-full" />
                  <div className="h-2 bg-bg-surface rounded-sm w-3/4" />
                  <div className="h-2 bg-bg-surface rounded-sm w-1/2" />
                  <div className="h-2 bg-bg-surface rounded-sm w-2/3" />
                </div>
              </div>
              {/* Footer */}
              <div className="h-8 bg-bg-surface border-t border-white/5" />
            </div>
            <p className="text-text-dim text-xs mt-3">
              Standard pages, max-w-7xl content
            </p>
          </div>

          {/* Admin Layout */}
          <div className="bg-bg-elevated rounded-lg p-4 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              AdminLayout
            </h3>
            <div className="bg-bg rounded-lg overflow-hidden border border-white/5 relative">
              {/* Admin banner */}
              <div className="h-3 bg-accent/20 border-b border-accent/30" />
              {/* Content */}
              <div className="p-3 h-32">
                <div className="max-w-[80%] mx-auto space-y-2">
                  <div className="h-2 bg-bg-surface rounded-sm w-full" />
                  <div className="h-2 bg-bg-surface rounded-sm w-3/4" />
                  <div className="h-2 bg-bg-surface rounded-sm w-1/2" />
                </div>
              </div>
              {/* Floating toolbar */}
              <div className="absolute bottom-2 right-2 h-6 w-24 bg-bg-surface rounded-lg border border-accent/30" />
            </div>
            <p className="text-text-dim text-xs mt-3">
              Admin banner + floating toolbar
            </p>
          </div>
        </div>
      </section>

      {/* Breakpoints & Spacing */}
      <section id="breakpoints-spacing">
        <h2 className="font-semibold text-4xl mb-8">Breakpoints & Spacing</h2>

        <div className="space-y-8">
          {/* Breakpoints */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Responsive Breakpoints
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-text-muted font-medium">
                      Name
                    </th>
                    <th className="text-left py-2 pr-4 text-text-muted font-medium">
                      Min Width
                    </th>
                    <th className="text-left py-2 text-text-muted font-medium">
                      Container Max
                    </th>
                  </tr>
                </thead>
                <tbody className="text-text-dim">
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">
                      <code className="text-accent">sm</code>
                    </td>
                    <td className="py-2 pr-4">640px</td>
                    <td className="py-2">640px</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">
                      <code className="text-accent">md</code>
                    </td>
                    <td className="py-2 pr-4">768px</td>
                    <td className="py-2">768px</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">
                      <code className="text-accent">lg</code>
                    </td>
                    <td className="py-2 pr-4">1024px</td>
                    <td className="py-2">1024px</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">
                      <code className="text-accent">xl</code>
                    </td>
                    <td className="py-2 pr-4">1280px</td>
                    <td className="py-2">1280px</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">
                      <code className="text-accent">2xl</code>
                    </td>
                    <td className="py-2 pr-4">1536px</td>
                    <td className="py-2">1280px (capped)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Content Widths */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Content Widths
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <code className="text-accent text-sm">max-w-7xl</code>
                  <span className="text-text-dim text-sm">1280px</span>
                </div>
                <div className="h-4 bg-accent/20 rounded-sm w-full" />
                <p className="text-text-dim text-xs mt-1">
                  Standard content container
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <code className="text-accent text-sm">max-w-4xl</code>
                  <span className="text-text-dim text-sm">896px</span>
                </div>
                <div className="h-4 bg-accent/20 rounded-sm w-[70%]" />
                <p className="text-text-dim text-xs mt-1">
                  Narrow content (forms, single-column)
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <code className="text-accent text-sm">max-w-2xl</code>
                  <span className="text-text-dim text-sm">672px</span>
                </div>
                <div className="h-4 bg-accent/20 rounded-sm w-[52%]" />
                <p className="text-text-dim text-xs mt-1">
                  Very narrow (modals, confirmations)
                </p>
              </div>
            </div>
          </div>

          {/* Spacing Patterns */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Spacing Patterns
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-text-muted font-medium">
                      Context
                    </th>
                    <th className="text-left py-2 text-text-muted font-medium">
                      Pattern
                    </th>
                  </tr>
                </thead>
                <tbody className="text-text-dim">
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">Section padding</td>
                    <td className="py-2">
                      <code className="text-accent">py-16 sm:py-20</code>
                    </td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">Card padding</td>
                    <td className="py-2">
                      <code className="text-accent">p-5 sm:p-6</code>
                    </td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">Element gaps</td>
                    <td className="py-2">
                      <code className="text-accent">gap-4 sm:gap-6</code>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Page horizontal padding</td>
                    <td className="py-2">
                      <code className="text-accent">px-6 lg:px-8</code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
