'use client'

import { Button } from '@/components/ui'
import { ChevronRightIcon } from '@/components/icons'

export function ActionsSection() {
  return (
    <div className="space-y-20">
      {/* Buttons */}
      <section id="buttons">
        <h2 className="font-semibold text-4xl mb-8">Buttons</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Outline Buttons */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Outline (Primary Style)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              The default button style. White outline on dark background.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="outline-solid" size="lg">
                Register Interest
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
              <Button variant="outline-solid" size="md">
                View Events
              </Button>
              <Button variant="outline-solid" size="sm">
                Small
              </Button>
            </div>
          </div>

          {/* Filled Buttons */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Filled (For Emphasis)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              Use sparingly for primary CTAs like &quot;Vote Now&quot;.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="filled" size="lg">
                Vote Now
              </Button>
              <Button variant="filled" size="md">
                Submit
              </Button>
              <Button variant="filled" size="sm">
                Small
              </Button>
            </div>
          </div>

          {/* Accent Buttons */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Accent (Special Occasions)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              For live events, winners, very important actions.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="accent" size="lg">
                Live Event
              </Button>
              <Button variant="accent" size="md">
                View Results
              </Button>
              <Button variant="accent" size="sm">
                Winner
              </Button>
            </div>
          </div>

          {/* Ghost Buttons */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Ghost (Minimal)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              No border, just text. For secondary actions.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="ghost" size="lg">
                Cancel
              </Button>
              <Button variant="ghost" size="md">
                Learn More
              </Button>
              <Button variant="ghost" size="sm">
                Skip
              </Button>
            </div>
          </div>

          {/* Danger Buttons */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Danger (Destructive)
            </h3>
            <p className="text-text-dim text-sm mb-6">
              For destructive actions like delete.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="danger" size="lg">
                Delete Event
              </Button>
              <Button variant="danger" size="md">
                Remove
              </Button>
              <Button variant="danger" size="sm">
                Delete
              </Button>
            </div>
          </div>

          {/* Disabled States */}
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
              Disabled States
            </h3>
            <p className="text-text-dim text-sm mb-6">
              All variants support disabled state.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button variant="outline-solid" disabled>
                Disabled
              </Button>
              <Button variant="filled" disabled>
                Disabled
              </Button>
              <Button variant="accent" disabled>
                Disabled
              </Button>
            </div>
          </div>
        </div>

        {/* Icon Buttons */}
        <div className="mt-8 bg-bg-elevated rounded-lg p-6 border border-white/5">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
            With Icons
          </h3>
          <p className="text-text-dim text-sm mb-6">
            Icons can be placed before or after text.
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="outline-solid" className="p-3">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </Button>
            <Button variant="outline-solid">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              Account
            </Button>
            <Button variant="filled">
              View All
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Usage Code */}
        <div className="mt-8 bg-bg-elevated rounded-lg p-6 border border-white/5">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
            React Component
          </h3>
          <p className="text-text-dim text-sm mb-4">
            Location:{' '}
            <code className="bg-bg-surface px-2 py-0.5 rounded-sm text-xs">
              src/components/ui/button.tsx
            </code>
          </p>
          <pre className="bg-bg rounded-lg p-4 text-sm overflow-x-auto">
            <code className="text-text-dim">{`import { Button } from "@/components/ui";

// Variants: outline (default), filled, accent, ghost, danger
<Button variant="outline-solid">Click Me</Button>
<Button variant="filled">Primary Action</Button>
<Button variant="accent">Special</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="danger">Delete</Button>

// Sizes: sm, md (default), lg
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

// With icons
<Button>
  <ChevronRightIcon className="w-4 h-4" />
  Next
</Button>`}</code>
          </pre>
        </div>
      </section>
    </div>
  )
}
