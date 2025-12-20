"use client";

import {
  Badge,
  Card,
  CardContent,
  DateBadge,
  NumberedIndicator,
  Skeleton,
  SkeletonText,
  SkeletonCard,
} from "@/components/ui";

export function DisplaySection() {
  return (
    <div className="space-y-20">
      {/* Badges & Labels */}
      <section id="badges">
        <h2 className="font-semibold text-4xl mb-8">Badges & Labels</h2>

        <div className="bg-bg-elevated rounded-lg p-6 border border-white/5 space-y-6">
          {/* Accent & Neutral */}
          <div>
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Accent & Neutral Badges</h3>
            <div className="flex flex-wrap gap-3">
              <Badge variant="accent">🏆 Winner</Badge>
              <Badge variant="accent">Live</Badge>
              <Badge variant="default">Upcoming</Badge>
              <Badge className="bg-bg border border-white/10 text-text-muted">Past</Badge>
            </div>
          </div>

          {/* Semantic Badges */}
          <div>
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Semantic Badges (Rare Use)</h3>
            <div className="flex flex-wrap gap-3">
              <Badge variant="error">Error</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="info">Info</Badge>
            </div>
          </div>
        </div>

        {/* Usage Code */}
        <div className="mt-8 bg-bg-elevated rounded-lg p-6 border border-white/5">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">React Component</h3>
          <pre className="bg-bg rounded-lg p-4 text-sm overflow-x-auto">
            <code className="text-text-dim">{`import { Badge } from "@/components/ui";

// Variants: default, accent, error, success, warning, info
<Badge variant="default">Upcoming</Badge>
<Badge variant="accent">🏆 Winner</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="success">Success</Badge>`}</code>
          </pre>
        </div>
      </section>

      {/* Alerts & Messages */}
      <section id="alerts">
        <h2 className="font-semibold text-4xl mb-8">Alerts & Messages</h2>
        <p className="text-text-muted mb-6">Semantic colors should only be used for user feedback. Keep the rest monochromatic.</p>

        <div className="space-y-4">
          <div className="bg-error/10 border border-error/20 rounded-lg p-4 text-error">
            <p className="font-medium">Error: Unable to submit vote</p>
            <p className="text-sm opacity-80">Please try again or contact support.</p>
          </div>
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-success">
            <p className="font-medium">Success: Your vote has been recorded</p>
            <p className="text-sm opacity-80">Thanks for participating!</p>
          </div>
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-warning">
            <p className="font-medium">Warning: Voting closes in 10 minutes</p>
            <p className="text-sm opacity-80">Make sure to submit your vote.</p>
          </div>
          <div className="bg-info/10 border border-info/20 rounded-lg p-4 text-info">
            <p className="font-medium">Info: Results will be announced at 9pm</p>
            <p className="text-sm opacity-80">Check back after the final performance.</p>
          </div>
        </div>
      </section>

      {/* Date Badges */}
      <section id="date-badges">
        <h2 className="font-semibold text-4xl mb-8">Date Badges</h2>

        <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
          <div className="flex flex-wrap items-end gap-8">
            {/* Large */}
            <div>
              <p className="text-xs tracking-widest uppercase text-text-muted mb-4">Large (Event Hero)</p>
              <DateBadge date={new Date("2025-10-23")} size="lg" showYear />
            </div>

            {/* Medium */}
            <div>
              <p className="text-xs tracking-widest uppercase text-text-muted mb-4">Medium (Card)</p>
              <DateBadge date={new Date("2025-10-23")} size="md" />
            </div>

            {/* Small */}
            <div>
              <p className="text-xs tracking-widest uppercase text-text-muted mb-4">Small</p>
              <DateBadge date={new Date("2025-10-23")} size="sm" />
            </div>
          </div>
        </div>
      </section>

      {/* Numbered Indicators */}
      <section id="numbered-indicators">
        <h2 className="font-semibold text-4xl mb-8">Numbered Indicators</h2>

        <div className="space-y-8">
          {/* Shapes */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Shapes</h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <NumberedIndicator number={1} shape="circle" size="lg" />
                <p className="text-xs text-text-dim mt-2">Circle</p>
              </div>
              <div className="text-center">
                <NumberedIndicator number={2} shape="square" size="lg" />
                <p className="text-xs text-text-dim mt-2">Square</p>
              </div>
            </div>
          </div>

          {/* Sizes */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Sizes</h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <NumberedIndicator number={1} size="xs" />
                <p className="text-xs text-text-dim mt-2">XS</p>
              </div>
              <div className="text-center">
                <NumberedIndicator number={2} size="sm" />
                <p className="text-xs text-text-dim mt-2">SM</p>
              </div>
              <div className="text-center">
                <NumberedIndicator number={3} size="md" />
                <p className="text-xs text-text-dim mt-2">MD</p>
              </div>
              <div className="text-center">
                <NumberedIndicator number={4} size="lg" />
                <p className="text-xs text-text-dim mt-2">LG</p>
              </div>
              <div className="text-center">
                <NumberedIndicator number={5} size="xl" />
                <p className="text-xs text-text-dim mt-2">XL</p>
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">Variants</h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <NumberedIndicator number={1} variant="default" size="lg" />
                <p className="text-xs text-text-dim mt-2">Default</p>
              </div>
              <div className="text-center">
                <NumberedIndicator number={2} variant="muted" size="lg" />
                <p className="text-xs text-text-dim mt-2">Muted</p>
              </div>
              <div className="text-center">
                <NumberedIndicator number={1} variant="rank-1" size="lg" />
                <p className="text-xs text-text-dim mt-2">1st Place</p>
              </div>
              <div className="text-center">
                <NumberedIndicator number={2} variant="rank-2" size="lg" />
                <p className="text-xs text-text-dim mt-2">2nd Place</p>
              </div>
              <div className="text-center">
                <NumberedIndicator number={3} variant="rank-3" size="lg" />
                <p className="text-xs text-text-dim mt-2">3rd Place</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section id="cards">
        <h2 className="font-semibold text-4xl mb-8">Cards</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Event Card */}
          <div className="group relative rounded-lg overflow-hidden bg-bg-elevated aspect-4/3 cursor-pointer">
            <div className="absolute inset-0 bg-linear-to-br from-purple-900/30 via-bg-muted to-amber-900/20" />
            <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/50 to-transparent" />

            <div className="absolute top-4 left-4">
              <DateBadge date={new Date("2025-10-23")} size="sm" />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="font-medium text-xl mb-1">Event Card</h3>
              <p className="text-text-muted text-sm">With date badge</p>
            </div>

            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Event Card with Winner */}
          <div className="group relative rounded-lg overflow-hidden bg-bg-elevated aspect-4/3 cursor-pointer">
            <div className="absolute inset-0 bg-linear-to-br from-amber-900/20 via-bg-muted to-purple-900/10" />
            <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/50 to-transparent" />

            <div className="absolute top-4 left-4">
              <DateBadge date={new Date("2025-03-15")} size="sm" />
            </div>

            <div className="absolute top-4 right-4">
              <Badge variant="accent">🏆 Winner</Badge>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="font-medium text-xl mb-1">Past Event</h3>
              <p className="text-text-muted text-sm">With winner badge</p>
            </div>

            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Simple Card */}
          <Card className="hover:border-white/10 transition-colors">
            <CardContent className="p-6">
              <h3 className="font-medium text-xl mb-2">Simple Card</h3>
              <p className="text-text-muted text-sm mb-4">For content without image background.</p>
              <a href="#" className="text-text-dim text-sm hover:text-white transition-colors">Learn more →</a>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card className="bg-bg-surface">
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-accent mb-2">$150k+</p>
              <p className="text-text-muted text-sm tracking-wider uppercase">Raised for Charity</p>
            </CardContent>
          </Card>

          {/* Schedule Item */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-6">
                <div className="text-text-muted text-sm min-w-[80px]">7:00 PM</div>
                <div>
                  <p className="font-medium">First Performance</p>
                  <p className="text-text-dim text-sm">Competition begins</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quote Card */}
          <Card className="bg-bg-surface">
            <CardContent className="p-6 text-center">
              <p className="text-xl font-medium">&quot;Where tech goes loud.&quot;</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Skeletons */}
      <section id="skeletons">
        <h2 className="font-semibold text-4xl mb-8">Skeletons</h2>
        <p className="text-text-muted mb-6">
          Loading placeholders with shimmer animation. Respects{" "}
          <code className="text-accent">prefers-reduced-motion</code> for accessibility.
        </p>

        <div className="space-y-8">
          {/* Variants */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Shape Variants
            </h3>
            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <Skeleton className="h-24 w-32 mb-2" />
                <p className="text-xs text-text-dim">Rectangle</p>
              </div>
              <div className="text-center">
                <Skeleton variant="circle" className="h-16 w-16 mb-2" />
                <p className="text-xs text-text-dim">Circle</p>
              </div>
              <div className="text-center space-y-2">
                <Skeleton variant="text" className="h-4 w-32" />
                <Skeleton variant="text" className="h-4 w-24" />
                <p className="text-xs text-text-dim mt-2">Text Lines</p>
              </div>
            </div>
          </div>

          {/* Composed Skeletons */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Composed Skeletons
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-text-dim mb-3">SkeletonText</p>
                <SkeletonText lines={3} />
              </div>
              <div>
                <p className="text-xs text-text-dim mb-3">SkeletonCard</p>
                <SkeletonCard />
              </div>
            </div>
          </div>

          {/* Photo Grid Example */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Photo Grid Loading
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          </div>

          {/* Accessibility Note */}
          <div className="bg-info/10 border border-info/20 rounded-lg p-4 text-info">
            <p className="font-medium">Accessibility Note</p>
            <p className="text-sm opacity-80">
              When <code className="text-info-light">prefers-reduced-motion: reduce</code> is enabled,
              the shimmer animation is disabled and a static gray placeholder is shown instead.
            </p>
          </div>

          {/* Usage Code */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              React Component
            </h3>
            <pre className="bg-bg rounded-lg p-4 text-sm overflow-x-auto">
              <code className="text-text-dim">{`import { Skeleton, SkeletonText, SkeletonCard } from "@/components/ui";

// Basic shapes
<Skeleton className="h-8 w-32" />
<Skeleton variant="circle" className="h-12 w-12" />
<Skeleton variant="text" className="h-4 w-full" />

// Composed components
<SkeletonText lines={3} />
<SkeletonCard />`}</code>
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}

