# BOTTB Design System

> Battle of the Tech Bands — Monochromatic festival aesthetic

## Brand Identity

### Aesthetic Direction

**Elegant Festival Experience**: Inspired by [Tomorrowland's website](https://www.tomorrowland.com/). Primarily monochromatic (white on black), clean typography, outline-style UI elements, and accent color used sparingly. Premium without being loud, sophisticated without being corporate.

Key visual references:

- **Tomorrowland website**: Monochromatic palette, outline buttons, elegant typography
- **High-end concert venues**: Dark backgrounds, dramatic lighting
- **Modern event platforms**: Clean UI, full-bleed imagery, sophisticated cards
- **Stage lighting**: Warm golden spots against deep darkness

### Design Principles

1. **Monochromatic First**: White on black is the foundation. Color is the exception, not the rule.
2. **Typography-Led**: Elegant serif headlines (Playfair Display), clean sans-serif UI (Inter)
3. **Outline UI**: Buttons and controls use outlines, not fills. Subtle borders, not bold backgrounds.
4. **Immersive**: Full-bleed imagery with dark overlays for text readability
5. **Refined**: Sophisticated spacing, elegant animations, understated effects

---

## Color Palette

Primarily monochromatic with an Indigo accent used sparingly for emphasis. Semantic colors (error, success, warning, info) reserved for user feedback only.

### Color Usage Hierarchy

| Percentage | Category        | Purpose                                               |
| ---------- | --------------- | ----------------------------------------------------- |
| **90%**    | Monochromatic   | White/gray text on black backgrounds — the foundation |
| **8%**     | Accent (Indigo) | Selected states, primary CTAs, links, winner badges   |
| **2%**     | Semantic        | Error/success/warning/info — only for user feedback   |

### Background Scale

| Token                 | Hex       | Usage                            |
| --------------------- | --------- | -------------------------------- |
| `--color-bg`          | `#0a0a0a` | Page background (near black)     |
| `--color-bg-elevated` | `#141414` | Cards, elevated surfaces         |
| `--color-bg-muted`    | `#1a1a1a` | Hover states, subtle backgrounds |
| `--color-bg-surface`  | `#222222` | Highest elevation surfaces       |

### Text Colors

| Token                | Hex       | Usage                          |
| -------------------- | --------- | ------------------------------ |
| `--color-text`       | `#ffffff` | Primary text (white)           |
| `--color-text-muted` | `#a0a0a0` | Secondary text, descriptions   |
| `--color-text-dim`   | `#666666` | Tertiary text, metadata, hints |

### Accent Color (Indigo)

| Token                  | Hex                        | Usage                                       |
| ---------------------- | -------------------------- | ------------------------------------------- |
| `--color-accent`       | `#6366F1`                  | Winner badges, live indicators, key CTAs    |
| `--color-accent-light` | `#818CF8`                  | Hover states on accent elements             |
| `--color-accent-muted` | `rgba(99, 102, 241, 0.15)` | Subtle accent backgrounds (badges, borders) |

### Semantic Colors (Use Sparingly)

Reserved for user feedback only. Do not use for decorative purposes.

| Token             | Hex       | Name         | Usage                             |
| ----------------- | --------- | ------------ | --------------------------------- |
| `--color-error`   | `#f10e34` | Apple Red    | Error states, destructive actions |
| `--color-success` | `#31eb14` | Lime Green   | Success states, confirmations     |
| `--color-warning` | `#F5A623` | Vibrant Gold | Warning states, caution notices   |
| `--color-info`    | `#3B82F6` | Blue         | Informational messages, help text |

### Border/Divider Colors

| Token                  | CSS                      | Usage                  |
| ---------------------- | ------------------------ | ---------------------- |
| `--border-subtle`      | `rgba(255,255,255,0.05)` | Card borders, dividers |
| `--border-default`     | `rgba(255,255,255,0.1)`  | Input borders          |
| `--border-emphasized`  | `rgba(255,255,255,0.2)`  | Hover states           |
| `--border-interactive` | `rgba(255,255,255,0.3)`  | Buttons, controls      |

### Usage Guidelines

- **90% of UI** should be white/gray text on black backgrounds
- **Borders** use very subtle white opacity (5-30%)
- **Accent color** reserved for: winner badges, live indicators, selected states, links
- **Semantic colors** only for: form validation, toast notifications, alerts
- **Never** use accent or semantic colors for primary navigation or large UI areas

### Tailwind Config

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0a",
          elevated: "#141414",
          muted: "#1a1a1a",
          surface: "#222222",
        },
        accent: {
          DEFAULT: "#6366F1", // Indigo
          light: "#818CF8",
          muted: "rgba(99, 102, 241, 0.15)",
        },
        text: {
          DEFAULT: "#ffffff",
          muted: "#a0a0a0",
          dim: "#666666",
        },
        error: {
          DEFAULT: "#f10e34", // Apple Red
          light: "#f33f5d",
        },
        success: {
          DEFAULT: "#31eb14", // Lime Green
          light: "#98f58a",
        },
        warning: {
          DEFAULT: "#F5A623", // Vibrant Gold
          light: "#FFBE3D",
        },
        info: {
          DEFAULT: "#3B82F6", // Blue
          light: "#60A5FA",
        },
      },
    },
  },
};
```

---

## Typography

### Font Stack

| Type    | Font     | Fallback              | Usage                                       |
| ------- | -------- | --------------------- | ------------------------------------------- |
| Display | **Jost** | system-ui, sans-serif | Headlines, hero text, card titles (500-700) |
| Body    | **Jost** | system-ui, sans-serif | Body copy, buttons, forms (400-500)         |

Single font family (Jost) for consistency — similar to Tomorrowland's Europa. Geometric sans-serif, clean and modern.

### Typography Patterns

| Pattern       | Weight | Size    | Style                     |
| ------------- | ------ | ------- | ------------------------- |
| Hero headline | 600    | 4-7xl   | Normal case               |
| Section title | 600    | 3-4xl   | Normal case               |
| Card title    | 500    | xl-2xl  | Normal case               |
| Nav links     | 400    | sm      | ALL CAPS, tracking-widest |
| Buttons       | 500    | xs-sm   | ALL CAPS, tracking-widest |
| Labels/badges | 400    | xs      | ALL CAPS, tracking-wider  |
| Body          | 400    | base-lg | Normal case               |
| Metadata      | 400    | sm      | Normal case               |

### Scale

| Class             | Size            | Line Height | Usage            |
| ----------------- | --------------- | ----------- | ---------------- |
| `text-display-xl` | 4.5rem (72px)   | 1.0         | Hero headlines   |
| `text-display-lg` | 3rem (48px)     | 1.1         | Page titles      |
| `text-display-md` | 2.25rem (36px)  | 1.2         | Section headers  |
| `text-display-sm` | 1.5rem (24px)   | 1.3         | Card titles      |
| `text-body-lg`    | 1.125rem (18px) | 1.6         | Lead paragraphs  |
| `text-body`       | 1rem (16px)     | 1.5         | Body copy        |
| `text-body-sm`    | 0.875rem (14px) | 1.5         | Secondary text   |
| `text-caption`    | 0.75rem (12px)  | 1.4         | Captions, labels |

### Tailwind Config

```javascript
fontFamily: {
  sans: ['Jost', 'system-ui', 'sans-serif'],
},
letterSpacing: {
  widest: '0.2em', // For ALL CAPS elements
},
```

### Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

Or in Next.js:

```tsx
import { Jost } from "next/font/google";

const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
});
```

---

## Layout System

### Three Primary Layouts

#### 1. Home Page Layout (`HomeLayout`)

Full-bleed, immersive experience. No max-width constraints on hero.

```
┌─────────────────────────────────────────────┐
│  [Admin Banner - conditional]               │
├─────────────────────────────────────────────┤
│  NavBar (fixed, bg-bg/80 backdrop-blur)     │
├─────────────────────────────────────────────┤
│                                             │
│              ╔═══════════════╗              │
│              ║   HERO        ║  (full-bleed)│
│              ║   + CTA       ║              │
│              ╚═══════════════╝              │
│                                             │
├─────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  │
│  │     max-w-7xl / Upcoming Events       │  │
│  └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

#### 2. Standard Page Layout (`WebLayout`)

Consistent navigation, constrained content width.

```
┌─────────────────────────────────────────────┐
│  NavBar (fixed, bg-bg/80 backdrop-blur)     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │         max-w-7xl content             │  │
│  │         px-6 lg:px-8                  │  │
│  └───────────────────────────────────────┘  │
│                                             │
├─────────────────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

#### 3. Admin Layout (`AdminLayout`)

Floating toolbar, distinct visual separation.

```
┌─────────────────────────────────────────────┐
│  [Admin Banner]                             │
├─────────────────────────────────────────────┤
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │         max-w-7xl content             │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ╔═════════════════════════════════════╗    │
│  ║  Floating Admin Toolbar (fixed)     ║    │
│  ╚═════════════════════════════════════╝    │
└─────────────────────────────────────────────┘
```

### Breakpoints

| Name  | Min Width | Container Max   |
| ----- | --------- | --------------- |
| `sm`  | 640px     | 640px           |
| `md`  | 768px     | 768px           |
| `lg`  | 1024px    | 1024px          |
| `xl`  | 1280px    | 1280px          |
| `2xl` | 1536px    | 1280px (capped) |

### Content Width

- **max-w-7xl** (1280px): Standard content container
- **max-w-4xl** (896px): Narrow content (forms, single-column)
- **max-w-2xl** (672px): Very narrow content (modals, confirmations)

### Spacing

Use Tailwind's default scale. Key patterns:

- Section padding: `py-16 sm:py-20`
- Card padding: `p-5 sm:p-6`
- Element gaps: `gap-4 sm:gap-6`

---

## Responsive & Mobile Strategy

### Philosophy: Mobile-First

Design for mobile first, then enhance for larger screens. Voting at live events happens on phones.

### Breakpoint Usage

```tsx
// Mobile-first pattern
<div className="
  px-4          // Mobile: 16px padding
  sm:px-6       // ≥640px: 24px padding
  lg:px-8       // ≥1024px: 32px padding
">

// Grid columns
<div className="
  grid
  grid-cols-1   // Mobile: single column
  sm:grid-cols-2 // ≥640px: 2 columns
  lg:grid-cols-3 // ≥1024px: 3 columns
">
```

### Mobile-Specific Patterns

#### Typography Scaling

| Element        | Mobile     | Desktop           |
| -------------- | ---------- | ----------------- |
| Hero headline  | `text-3xl` | `text-display-xl` |
| Page title     | `text-2xl` | `text-display-lg` |
| Section header | `text-xl`  | `text-display-md` |
| Card title     | `text-lg`  | `text-display-sm` |

#### Touch Targets

All interactive elements must be at least **44x44px** on mobile.

#### Navigation

| Screen  | Navigation Pattern                    |
| ------- | ------------------------------------- |
| Mobile  | Hamburger menu or bottom tab bar      |
| Tablet  | Condensed horizontal nav              |
| Desktop | Full horizontal nav with hover states |

### Component-Specific Mobile Behavior

| Component       | Mobile Behavior                                   |
| --------------- | ------------------------------------------------- |
| NavBar          | Logo only, hamburger menu                         |
| Event Cards     | Full width, stacked layout                        |
| Photo Grid      | 2 columns, larger touch targets                   |
| Photo Slideshow | Full screen, swipe gestures, hide thumbnail strip |
| Results Table   | Horizontal scroll or card view                    |
| Voting Page     | Large radio buttons, sticky submit                |
| Admin Toolbar   | Bottom sheet or slide-out drawer                  |
| Filters         | Collapsible accordion or bottom sheet             |

---

## Components

### Buttons

#### Outline Button (Primary Style - Tomorrowland)

The default button style. White outline on dark background.

```html
<button
  class="
  border border-white/30
  px-8 py-4 rounded-full
  text-sm tracking-widest uppercase
  transition-all duration-300
  hover:border-white/60 hover:bg-white/5
  flex items-center gap-2
"
>
  View Events
  <svg class="w-4 h-4"><!-- chevron-right --></svg>
</button>
```

#### Filled Button (For Emphasis)

Use sparingly for primary CTAs like "Vote Now".

```html
<button
  class="
  bg-white text-bg
  px-8 py-4 rounded-full
  text-sm tracking-widest uppercase font-medium
  transition-colors duration-300
  hover:bg-gray-200
"
>
  Vote Now
</button>
```

#### Accent Button (Special occasions only)

For live events, winners, very important actions.

```html
<button
  class="
  bg-accent text-bg
  px-6 py-3 rounded-full
  text-xs tracking-widest uppercase font-medium
  transition-colors duration-300
  hover:bg-accent-light
"
>
  Live Event
</button>
```

#### Icon Button

```html
<button
  class="
  border border-white/30
  p-3 rounded-full
  transition-all duration-300
  hover:border-white/60 hover:bg-white/5
"
>
  <svg class="w-5 h-5"><!-- icon --></svg>
</button>
```

### Cards

#### Event Card (Tomorrowland-style)

Image background with overlay, date badge on left.

```html
<div
  class="group relative rounded-lg overflow-hidden bg-bg-elevated aspect-[4/3] cursor-pointer"
>
  <!-- Background gradient placeholder (or image) -->
  <div
    class="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-bg-muted to-amber-900/20"
  ></div>
  <div
    class="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent"
  ></div>

  <!-- Date Badge -->
  <div class="absolute top-4 left-4">
    <div
      class="bg-bg/90 backdrop-blur-sm rounded px-2 py-1 text-center min-w-[48px]"
    >
      <div class="text-[10px] tracking-wider uppercase text-text-muted">
        Oct
      </div>
      <div class="text-xl font-semibold">23</div>
    </div>
  </div>

  <!-- Content -->
  <div class="absolute bottom-0 left-0 right-0 p-5">
    <h3 class="font-semibold text-xl font-medium mb-1">
      Sydney Tech Battle 2025
    </h3>
    <p class="text-text-muted text-sm">The Metro Theatre, Sydney</p>
  </div>

  <!-- Hover overlay -->
  <div
    class="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
  ></div>
</div>
```

#### Simple Card

For content without image backgrounds.

```html
<div
  class="
  bg-bg-elevated rounded-lg p-6
  border border-white/5
  hover:border-white/10 transition-colors
"
>
  <h3 class="font-semibold text-xl mb-2">Card Title</h3>
  <p class="text-text-muted text-sm">Card description.</p>
</div>
```

### Date Badges

Tomorrowland-style: Month abbreviation on top, day number below.

```html
<div
  class="bg-bg/90 backdrop-blur-sm border border-white/10 rounded px-3 py-2 text-center min-w-[56px]"
>
  <div class="text-[10px] tracking-wider uppercase text-text-muted">Oct</div>
  <div class="text-2xl font-semibold">23</div>
</div>
```

For date ranges, stack multiple badges horizontally:

```html
<div class="flex gap-1">
  <div class="bg-bg/90 backdrop-blur-sm rounded px-2 py-1 text-center">
    <div class="text-[10px] tracking-wider uppercase text-text-muted">Jul</div>
    <div class="text-xl font-semibold">17</div>
  </div>
  <div class="bg-bg/90 backdrop-blur-sm rounded px-2 py-1 text-center">
    <div class="text-[10px] tracking-wider uppercase text-text-muted">Jul</div>
    <div class="text-xl font-semibold">19</div>
  </div>
</div>
```

### Badges & Labels

```html
<!-- Status badge (outline) -->
<span
  class="bg-white/10 border border-white/20 text-white px-3 py-1 rounded text-xs tracking-widest uppercase"
>
  Upcoming
</span>

<!-- Accent badge (for winners/live) -->
<span
  class="bg-accent/20 border border-accent/30 text-accent px-3 py-1 rounded text-xs tracking-wider uppercase"
>
  🏆 Winner
</span>

<!-- Muted badge -->
<span
  class="bg-bg border border-white/10 text-text-muted px-3 py-1 rounded text-xs tracking-widest uppercase"
>
  Past
</span>
```

### Navigation

```html
<nav class="fixed top-0 left-0 right-0 z-50 bg-bg/80 backdrop-blur-md">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <!-- Logo -->
      <a href="#" class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center"
        >
          <span class="font-heading text-lg">B</span>
        </div>
      </a>

      <!-- Nav Links -->
      <div class="hidden md:flex items-center gap-8">
        <a href="#" class="text-sm tracking-widest uppercase text-white"
          >Events</a
        >
        <a
          href="#"
          class="text-sm tracking-widest uppercase text-text-muted hover:text-white transition-colors"
          >Photos</a
        >
        <a
          href="#"
          class="text-sm tracking-widest uppercase text-text-muted hover:text-white transition-colors"
          >About</a
        >
      </div>

      <!-- Account Button -->
      <button
        class="border border-white/30 px-5 py-2 rounded-full text-sm tracking-widest uppercase flex items-center gap-2 hover:border-white/60 hover:bg-white/5 transition-all"
      >
        <svg class="w-4 h-4"><!-- user icon --></svg>
        Account
      </button>
    </div>
  </div>
</nav>
```

### Form Inputs

```html
<div>
  <label class="block text-xs tracking-wider uppercase text-text-muted mb-2"
    >Email</label
  >
  <input
    type="email"
    placeholder="you@example.com"
    class="
      w-full px-4 py-3
      bg-bg border border-white/10 rounded-lg
      text-white placeholder-text-dim
      transition-all
      focus:outline-none focus:border-white/30
      hover:border-white/20
    "
  />
</div>
```

### Voting Selection

```html
<!-- Unselected -->
<label
  class="flex items-center gap-4 p-4 bg-bg rounded-lg border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
>
  <div class="w-5 h-5 rounded-full border border-white/30"></div>
  <div>
    <p class="font-medium">The Agentics</p>
    <p class="text-text-dim text-sm">Salesforce</p>
  </div>
</label>

<!-- Selected -->
<label
  class="flex items-center gap-4 p-4 bg-accent/10 rounded-lg border border-accent/40 cursor-pointer"
>
  <div
    class="w-5 h-5 rounded-full bg-accent border border-accent flex items-center justify-center"
  >
    <svg class="w-3 h-3 text-bg"><!-- checkmark --></svg>
  </div>
  <div>
    <p class="font-medium">Code Rockers</p>
    <p class="text-text-dim text-sm">Google</p>
  </div>
</label>
```

---

## Hero Sections

### Home Page Hero

Full-viewport hero with atmospheric background, centered text, outline CTAs.

```html
<section class="relative min-h-screen flex items-center justify-center bg-hero">
  <!-- Background image with overlay -->
  <div class="absolute inset-0">
    <img src="..." class="w-full h-full object-cover" />
    <div
      class="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/60 to-bg"
    ></div>
  </div>

  <!-- Content -->
  <div class="relative z-10 text-center px-4 max-w-4xl mx-auto">
    <h1
      class="font-semibold text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium mb-6 leading-tight"
    >
      Battle of the Tech Bands<br />Sydney 2025 is coming
    </h1>

    <p class="text-text-muted text-lg mb-10 max-w-2xl mx-auto">
      Register your interest now, or check out past events.
    </p>

    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a
        href="#"
        class="border border-white/30 px-8 py-4 rounded-full text-sm tracking-widest uppercase flex items-center justify-center gap-2 hover:border-white/60 hover:bg-white/5 transition-all"
      >
        Register Interest
        <svg class="w-4 h-4"><!-- chevron --></svg>
      </a>
      <a
        href="#"
        class="border border-white/30 px-8 py-4 rounded-full text-sm tracking-widest uppercase flex items-center justify-center gap-2 hover:border-white/60 hover:bg-white/5 transition-all"
      >
        View Events
        <svg class="w-4 h-4"><!-- chevron --></svg>
      </a>
    </div>
  </div>
</section>
```

### Event Page Hero

Shorter hero with event details and date badge.

```html
<section class="relative min-h-[70vh] flex items-end bg-hero-event">
  <div class="absolute inset-0">
    <img src="..." class="w-full h-full object-cover" />
    <div
      class="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/70 to-bg"
    ></div>
  </div>

  <div class="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-8 pb-16 pt-32">
    <div class="flex items-start gap-6">
      <!-- Date Badge -->
      <div class="hidden sm:block">
        <div
          class="bg-bg/90 backdrop-blur-sm rounded px-4 py-3 text-center min-w-[72px]"
        >
          <div class="text-xs tracking-wider uppercase text-text-muted">
            Oct
          </div>
          <div class="text-3xl font-semibold">23</div>
          <div class="text-xs text-text-dim">2025</div>
        </div>
      </div>

      <!-- Event Info -->
      <div class="flex-1">
        <div class="flex items-center gap-3 mb-4">
          <span
            class="bg-white/10 border border-white/20 text-white px-3 py-1 rounded text-xs tracking-widest uppercase"
            >Upcoming</span
          >
          <span class="text-text-dim text-sm">8 Bands Competing</span>
        </div>

        <h1
          class="font-semibold text-4xl sm:text-5xl md:text-6xl font-medium mb-4"
        >
          Sydney Tech Battle 2025
        </h1>

        <p class="text-text-muted text-lg mb-6">
          The Metro Theatre • Sydney, Australia
        </p>

        <div class="flex flex-wrap gap-4">
          <a
            href="#"
            class="bg-white text-bg px-8 py-4 rounded-full text-sm tracking-widest uppercase font-medium hover:bg-gray-200 transition-colors"
          >
            Vote Now
          </a>
          <a
            href="#"
            class="border border-white/30 px-8 py-4 rounded-full text-sm tracking-widest uppercase hover:border-white/60 hover:bg-white/5 transition-all"
          >
            Get Tickets
          </a>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## Special Effects

Keep effects minimal and sophisticated. This isn't EDM festival — it's elegant.

### Glass Effect

```css
.glass {
  background: rgba(10, 10, 10, 0.8);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

### Image Overlays

```css
/* Bottom fade for text readability */
.overlay-bottom-fade {
  background: linear-gradient(
    to top,
    rgba(10, 10, 10, 1) 0%,
    rgba(10, 10, 10, 0.6) 40%,
    transparent 100%
  );
}

/* Hero vignette */
.overlay-vignette {
  background: linear-gradient(
    180deg,
    rgba(10, 10, 10, 0.3) 0%,
    rgba(10, 10, 10, 0.6) 50%,
    rgba(10, 10, 10, 0.95) 100%
  );
}
```

### Subtle Hover Effects

```css
/* Card hover - very subtle white overlay */
.card-hover:hover {
  background: rgba(255, 255, 255, 0.02);
}

/* Border emphasis on hover */
.border-hover:hover {
  border-color: rgba(255, 255, 255, 0.2);
}
```

---

## SEO & Deep Linking

### Meta Structure

Every page must include:

```tsx
export const metadata: Metadata = {
  title: "Page Title | Battle of the Tech Bands",
  description: "Compelling description under 160 chars",
  openGraph: {
    title: "Page Title | Battle of the Tech Bands",
    description: "Compelling description",
    images: ["/og-image.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};
```

### URL Structure

| Page       | URL Pattern             |
| ---------- | ----------------------- |
| Home       | `/`                     |
| Event      | `/event/[eventId]`      |
| Results    | `/results/[eventId]`    |
| Band       | `/band/[bandId]`        |
| Crowd Vote | `/vote/crowd/[eventId]` |
| Judge Vote | `/vote/judge/[eventId]` |
| Photos     | `/photos`               |
| Admin      | `/admin/*`              |

### Structured Data

Implement JSON-LD for events:

```tsx
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Battle of the Tech Bands Sydney 2025",
  "startDate": "2025-10-23",
  "location": {
    "@type": "Place",
    "name": "The Metro Theatre",
    "address": "Sydney, Australia"
  }
}
</script>
```

---

## Animation Guidelines

### Principles

1. **Subtle**: Animations should enhance, not distract
2. **Fast**: Quick response times (200-300ms for interactions)
3. **Smooth**: Use ease-out curves for natural movement
4. **Purposeful**: Only animate what matters

### Standard Transitions

```css
/* Interactive elements */
.interactive {
  transition: all 0.3s ease;
}

/* Borders and colors */
.subtle-transition {
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

/* Opacity fades */
.fade-transition {
  transition: opacity 0.3s ease;
}
```

### Hover States

| Element        | Hover Effect             |
| -------------- | ------------------------ |
| Outline button | Border opacity 30% → 60% |
| Card           | Border opacity 5% → 10%  |
| Text link      | text-muted → white       |
| Image card     | White overlay 5% opacity |

---

## Accessibility

### Requirements

- **Contrast**: 4.5:1 minimum for text (AA compliance)
- **Focus states**: Visible focus rings on all interactive elements
- **Touch targets**: Minimum 44x44px
- **Reduced motion**: Respect `prefers-reduced-motion`

### Implementation

```css
/* Focus states */
:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## File Structure

```
src/
├── components/
│   ├── ui/                    # Primitive components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── layouts/
│   │   ├── home-layout.tsx
│   │   ├── web-layout.tsx
│   │   ├── admin-layout.tsx
│   │   └── index.ts
│   ├── nav/
│   │   ├── nav-bar.tsx
│   │   ├── admin-toolbar.tsx
│   │   └── footer.tsx
│   └── ...
├── styles/
│   └── globals.css
└── ...
```

---

## Design Examples

See `design/` folder for standalone HTML previews:

- `design-system.html` - Typography, colors, components
- `home.html` - Home page layout
- `event.html` - Event detail page
- `voting.html` - Voting interface
