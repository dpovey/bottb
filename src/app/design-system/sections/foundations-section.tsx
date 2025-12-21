'use client'

const COLOR_SCALES = {
  background: [
    {
      name: '--bg',
      value: '#0a0a0a',
      usage: 'Page background (near black)',
      className: 'bg-bg',
    },
    {
      name: '--bg-elevated',
      value: '#141414',
      usage: 'Cards, elevated surfaces',
      className: 'bg-bg-elevated',
    },
    {
      name: '--bg-muted',
      value: '#1a1a1a',
      usage: 'Hover states, subtle backgrounds',
      className: 'bg-bg-muted',
    },
    {
      name: '--bg-surface',
      value: '#222222',
      usage: 'Highest elevation surfaces',
      className: 'bg-bg-surface',
    },
  ],
  text: [
    {
      name: '--text',
      value: '#ffffff',
      usage: 'Primary text (white)',
      className: 'bg-white',
    },
    {
      name: '--text-muted',
      value: '#a0a0a0',
      usage: 'Secondary text, descriptions',
      className: 'bg-text-muted',
    },
    {
      name: '--text-dim',
      value: '#666666',
      usage: 'Tertiary text, metadata',
      className: 'bg-text-dim',
    },
  ],
  accent: [
    {
      name: '--accent',
      value: '#6366F1',
      usage: 'Primary accent (Indigo)',
      className: 'bg-accent',
    },
    {
      name: '--accent-light',
      value: '#818CF8',
      usage: 'Hover states on accent',
      className: 'bg-accent-light',
    },
  ],
  semantic: [
    {
      name: '--error',
      value: '#f10e34',
      usage: 'Error states, destructive',
      className: 'bg-error',
    },
    {
      name: '--success',
      value: '#31eb14',
      usage: 'Success states',
      className: 'bg-success',
    },
    {
      name: '--warning',
      value: '#F5A623',
      usage: 'Warning states',
      className: 'bg-warning',
    },
    {
      name: '--info',
      value: '#3B82F6',
      usage: 'Informational',
      className: 'bg-info',
    },
  ],
}

const TYPOGRAPHY_EXAMPLES = [
  {
    weight: '600',
    size: '5xl',
    label: 'Jost 600 — Headlines',
    example: 'Battle of the Tech Bands',
  },
  {
    weight: '500',
    size: '3xl',
    label: 'Jost 500 — Subheadings, Card Titles',
    example: 'Sydney Tech Battle 2025',
  },
  {
    weight: '400',
    size: 'lg',
    label: 'Jost 400 — Body copy',
    example:
      'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.',
  },
  {
    weight: '500',
    size: 'sm',
    label: 'Jost 500 + ALL CAPS + Letter Spacing — Buttons, Nav, Labels',
    example: 'VIEW EVENTS • REGISTER INTEREST • MY ACCOUNT',
    uppercase: true,
  },
]

export function FoundationsSection() {
  return (
    <div className="space-y-20">
      {/* Design Philosophy */}
      <section id="design-philosophy">
        <h2 className="font-semibold text-4xl mb-4">Design Philosophy</h2>
        <p className="text-text-muted text-lg max-w-3xl mb-8">
          Monochromatic base (white on black) with a single vibrant accent
          color. Edit{' '}
          <code className="bg-bg-elevated px-2 py-1 rounded-sm text-sm">
            theme.css
          </code>{' '}
          to change the accent color globally.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="font-semibold text-xl mb-2">Monochromatic</h3>
            <p className="text-text-dim text-sm">
              White on black. Color is used sparingly for emphasis only.
            </p>
          </div>
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="font-semibold text-xl mb-2">Typography-Led</h3>
            <p className="text-text-dim text-sm">
              Single geometric sans-serif (Jost), varying weights. ALL CAPS for
              UI elements.
            </p>
          </div>
          <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
            <h3 className="font-semibold text-xl mb-2">Outline UI</h3>
            <p className="text-text-dim text-sm">
              Buttons and controls use outlines, not fills. Subtle and refined.
            </p>
          </div>
        </div>
      </section>

      {/* Color Palette */}
      <section id="color-palette">
        <h2 className="font-semibold text-4xl mb-8">Color Palette</h2>

        {/* Background Scale */}
        <div className="mb-12">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
            Background Scale
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {COLOR_SCALES.background.map((color) => (
              <div key={color.name}>
                <div
                  className={`h-24 rounded-lg ${color.className} border border-white/10`}
                />
                <p className="mt-2 text-sm font-medium">{color.name}</p>
                <p className="text-xs text-text-dim">{color.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Text & Accent */}
        <div className="mb-12">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
            Text & Accent
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {COLOR_SCALES.text.map((color) => (
              <div key={color.name}>
                <div className={`h-24 rounded-lg ${color.className}`} />
                <p className="mt-2 text-sm font-medium">{color.name}</p>
                <p className="text-xs text-text-dim">{color.value}</p>
              </div>
            ))}
            {COLOR_SCALES.accent.map((color) => (
              <div key={color.name}>
                <div className={`h-24 rounded-lg ${color.className}`} />
                <p className="mt-2 text-sm font-medium">{color.name}</p>
                <p className="text-xs text-text-dim">{color.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Semantic Colors */}
        <div className="mb-12">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
            Semantic Colors (Use Sparingly)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {COLOR_SCALES.semantic.map((color) => (
              <div key={color.name}>
                <div className={`h-24 rounded-lg ${color.className}`} />
                <p className="mt-2 text-sm font-medium">{color.name}</p>
                <p className="text-xs text-text-dim">{color.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Hierarchy */}
        <div className="bg-bg-elevated rounded-lg p-6 border border-white/5">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
            Color Usage Hierarchy
          </h3>
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-white font-medium">90%</span>{' '}
              <span className="text-text-muted">
                — Monochromatic (white/gray on black)
              </span>
            </p>
            <p>
              <span className="text-accent font-medium">8%</span>{' '}
              <span className="text-text-muted">
                — Accent (selected states, primary CTAs, links, badges)
              </span>
            </p>
            <p>
              <span className="text-text-dim font-medium">2%</span>{' '}
              <span className="text-text-muted">
                — Semantic (error/success/warning/info — only for feedback)
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Typography */}
      <section id="typography">
        <h2 className="font-semibold text-4xl mb-8">Typography</h2>

        <div className="space-y-8 bg-bg-elevated rounded-lg p-8 border border-white/5">
          {TYPOGRAPHY_EXAMPLES.map((typo, index) => (
            <div key={index}>
              <p className="text-xs tracking-widest uppercase text-text-dim mb-2">
                {typo.label}
              </p>
              <p
                className={`font-${typo.weight === '600' ? 'semibold' : typo.weight === '500' ? 'medium' : 'normal'} text-${typo.size} ${typo.uppercase ? 'tracking-widest' : ''}`}
                style={{
                  fontWeight: parseInt(typo.weight),
                  letterSpacing: typo.uppercase ? '0.2em' : undefined,
                }}
              >
                {typo.example}
              </p>
            </div>
          ))}
        </div>

        {/* Type Scale */}
        <div className="mt-8 bg-bg-elevated rounded-lg p-6 border border-white/5">
          <h3 className="text-xs tracking-widest uppercase text-text-muted mb-4">
            Type Scale
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">
                    Class
                  </th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">
                    Size
                  </th>
                  <th className="text-left py-2 text-text-muted font-medium">
                    Usage
                  </th>
                </tr>
              </thead>
              <tbody className="text-text-dim">
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">
                    <code className="text-accent">text-display-xl</code>
                  </td>
                  <td className="py-2 pr-4">4.5rem (72px)</td>
                  <td className="py-2">Hero headlines</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">
                    <code className="text-accent">text-display-lg</code>
                  </td>
                  <td className="py-2 pr-4">3rem (48px)</td>
                  <td className="py-2">Page titles</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">
                    <code className="text-accent">text-display-md</code>
                  </td>
                  <td className="py-2 pr-4">2.25rem (36px)</td>
                  <td className="py-2">Section headers</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">
                    <code className="text-accent">text-display-sm</code>
                  </td>
                  <td className="py-2 pr-4">1.5rem (24px)</td>
                  <td className="py-2">Card titles</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">
                    <code className="text-accent">text-body-lg</code>
                  </td>
                  <td className="py-2 pr-4">1.125rem (18px)</td>
                  <td className="py-2">Lead paragraphs</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">
                    <code className="text-accent">text-body</code>
                  </td>
                  <td className="py-2 pr-4">1rem (16px)</td>
                  <td className="py-2">Body copy</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    <code className="text-accent">text-caption</code>
                  </td>
                  <td className="py-2 pr-4">0.75rem (12px)</td>
                  <td className="py-2">Captions, labels</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
