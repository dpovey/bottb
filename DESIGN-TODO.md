# Design System Migration TODO

> Current state assessment and migration plan
> 
> **Design Inspiration**: [Tomorrowland](https://www.tomorrowland.com/) — Monochromatic, elegant, sophisticated

## Design Direction Summary

Based on the actual Tomorrowland website:
- **90% monochromatic** — white/gray text on near-black backgrounds
- **Outline buttons** — not filled, subtle white borders
- **ALL CAPS + letter spacing** for navigation and buttons
- **Single geometric sans-serif** (Jost) — no serif fonts
- **Accent color (Indigo)** — used sparingly for selected states, winners, CTAs
- **Semantic colors** — used rarely, only for user feedback

### ✅ Finalized Color Decisions

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Accent** | Indigo | `#6366F1` | Selected states, primary CTAs, links, winner badges |
| **Error** | Apple Red | `#f10e34` | Error states, destructive actions |
| **Success** | Lime Green | `#31eb14` | Success states, confirmations |
| **Warning** | Vibrant Gold | `#F5A623` | Warning states, caution notices |
| **Info** | Blue | `#3B82F6` | Informational messages |

See `design-examples/` folder for HTML mockups and `design-examples/theme.css` for the CSS variables.

---

## Color Usage Decisions: Monochromatic vs. Color

### Where Color is Currently Used (Beyond Accent)

| Location | Current Approach | Recommendation |
|----------|------------------|----------------|
| **Event card backgrounds** | Colored gradients (`from-purple-900/30`, `from-cyan-900/20`, etc.) | **KEEP** — Provides visual variety and interest without being loud. Very low opacity (10-30%) keeps it subtle. |
| **Band thumbnail placeholders** | Different hue gradients for each band | **KEEP** — Helps distinguish bands visually. Replace with actual band photos when available. |
| **Hero background** | Photo with dark overlay | **KEEP** — Real photography adds atmosphere. |
| **Success/error states** | Green/red | **KEEP** — Semantic colors are expected and aid usability. |
| **Voting "open" indicator** | Green dot | **KEEP** — Universal "live/active" indicator. |

### Recommendations

#### ✅ Keep Colored (Low Priority to Change)

1. **Card background gradients** — The very low opacity colored gradients add depth without breaking monochromatic feel. They're essentially "tinted blacks" rather than "colors."

2. **Semantic UI states** — Success (green), Error (red), Warning (amber) should remain. Users expect these colors.

3. **Live/Active indicators** — Green pulse for "voting open" is universal UX.

4. **Photography** — Real photos add life; they're filtered through dark overlays anyway.

#### 🔄 Consider Converting to Monochromatic

1. **Band thumbnail placeholders** — Could use grayscale gradients or texture patterns instead of colored gradients. Lower priority since these will be replaced by actual band photos.

2. **Event card variety** — Could unify all cards to a single subtle gradient (e.g., all `from-white/5 to-transparent`) for stricter monochromatic adherence. Trade-off: less visual interest.

#### 🎨 Accent Color (Indigo `#6366F1`)

The accent color should be reserved for:
- Winner badges
- Live/featured status
- Selected states (voting)
- Primary CTAs (sparingly)
- Key statistics/highlights
- Links

#### 🚨 Semantic Colors (Use Rarely)

Only for user feedback — never for decoration:
- **Error** (Apple `#f10e34`) — Form validation, delete confirmations
- **Success** (Lime `#31eb14`) — Vote submitted, action completed
- **Warning** (Gold `#F5A623`) — Voting closing soon, time limits
- **Info** (Blue `#3B82F6`) — Helpful tips, announcements

#### Alternative Approaches

**Option A: Strict Monochromatic**
- All gradients become grayscale (`from-white/5`, `from-white/10`)
- Only accent color provides any hue
- Cleaner, more Tomorrowland-like

**Option B: Subtle Tinted Blacks (Current)**
- Keep very low opacity colored gradients for variety
- Accent color for emphasis
- More visual interest, still feels dark and cohesive

**Option C: Accent-Tinted Everything**
- Card gradients could use accent color at very low opacity
- Everything ties to the brand color
- More cohesive but less variety

### Decision Needed

For BOTTB, **Option B (Subtle Tinted Blacks)** is recommended because:
- Rock shows have colored stage lighting — the tinted gradients evoke this
- Visual variety helps distinguish different events/bands
- The low opacity keeps it feeling monochromatic overall
- Real photos will eventually replace placeholders anyway

---

## Current State Summary

### What Exists

| Area | Status | Notes |
|------|--------|-------|
| Color System | ✅ Defined | Monochromatic + Indigo accent + semantic colors in `theme.css` |
| Typography | ✅ Defined | Jost font, documented in DESIGN.md |
| Layouts | ⚠️ Partial | WebLayout/AdminLayout exist, missing HomeLayout |
| Components | ❌ None | No shared component library |
| Admin Toolbar | ❌ None | Banner exists, no floating toolbar |
| SEO | ❌ Minimal | Basic title only, no OG/structured data |
| Footer | ❌ None | No footer component |

---

## Migration Tasks

### 🎨 Priority 1: Color System (Monochromatic)

#### Current Problems
- Using hardcoded colors: `bg-blue-600`, `text-gray-300`, `bg-slate-600`
- Too many accent colors competing for attention
- Not monochromatic enough — doesn't match Tomorrowland

#### Target Palette (Tomorrowland-inspired)

**Backgrounds (near-black scale)**
- `#0a0a0a` — Page background
- `#141414` — Elevated surfaces (cards)
- `#1a1a1a` — Muted backgrounds
- `#222222` — Highest elevation

**Text**
- `#ffffff` — Primary text
- `#a0a0a0` — Secondary text
- `#666666` — Tertiary/metadata

**Accent (use sparingly)**
- `#B8963B` — Winners, live status, key highlights only

**Borders**
- `rgba(255,255,255,0.05)` — Subtle dividers
- `rgba(255,255,255,0.1)` — Default borders
- `rgba(255,255,255,0.3)` — Interactive (buttons)

#### Changes Needed

1. **Update `tailwind.config.js`**
   ```diff
   colors: {
   -  bg: '#0a0a0a',
   -  card: '#1a1a1a',
   -  accent: '#3b82f6',
   +  bg: {
   +    DEFAULT: '#0a0a0a',
   +    elevated: '#141414',
   +    muted: '#1a1a1a',
   +    surface: '#222222',
   +  },
   +  accent: {
   +    DEFAULT: '#B8963B',
   +    light: '#D4B055',
   +    muted: 'rgba(184, 150, 59, 0.15)',
   +  },
   +  text: {
   +    DEFAULT: '#ffffff',
   +    muted: '#a0a0a0',
   +    dim: '#666666',
   +  },
   }
   ```

2. **Files to update**:
   - [ ] `src/app/page.tsx` - Home page colors
   - [ ] `src/app/event/[eventId]/page.tsx` - Event page
   - [ ] `src/app/vote/crowd/[eventId]/page.tsx` - Voting page
   - [ ] `src/app/vote/judge/[eventId]/page.tsx` - Judge voting
   - [ ] `src/app/results/[eventId]/page.tsx` - Results page
   - [ ] `src/components/event-card.tsx` - Event cards
   - [ ] `src/components/nav-bar.tsx` - Navigation
   - [ ] `src/components/admin-banner.tsx` - Admin banner
   - [ ] `src/app/photos/page.tsx` - Photos page
   - [ ] All admin pages under `src/app/admin/`

---

### 🔤 Priority 2: Typography

#### Current Problems
- Rock Salt used for display but hard to read at small sizes
- Lato is generic, not impactful
- No ALL CAPS pattern for buttons/nav
- Missing elegant serif for headlines

#### Target Font
- **Jost** — Single font family for everything (geometric sans-serif, similar to Europa)
  - Weight 600-700: Headlines
  - Weight 500: Subheadings, card titles, buttons
  - Weight 400: Body copy, descriptions

#### Changes Needed

1. **Update fonts in `src/app/layout.tsx`**
   ```diff
   - import { Rock_Salt, Lato } from "next/font/google";
   + import { Jost } from "next/font/google";
   
   + const jost = Jost({
   +   subsets: ["latin"],
   +   variable: "--font-jost",
   + });
   ```

2. **Update `tailwind.config.js`**
   ```diff
   fontFamily: {
   -  display: ['var(--font-rock-salt)', 'cursive'],
   -  sans: ['var(--font-lato)', 'sans-serif'],
   +  sans: ['Jost', 'system-ui', 'sans-serif'],
   },
   letterSpacing: {
   +  widest: '0.2em', // For ALL CAPS elements
   },
   ```

3. **Establish patterns**:
   - [ ] Headlines: `font-semibold text-4xl` (Jost 600)
   - [ ] Card titles: `font-medium text-xl` (Jost 500)
   - [ ] Buttons: `font-medium text-sm tracking-widest uppercase`
   - [ ] Navigation: `text-sm tracking-widest uppercase text-text-muted`
   - [ ] Body: Default Jost 400

---

### 📐 Priority 3: Layout System

#### Current Problems
- Home page has no hero section (TODO comment in code)
- No distinction between home and standard page layouts
- Admin pages have no floating toolbar
- No footer on any page
- Inconsistent max-width usage

#### Changes Needed

1. **Create `HomeLayout`** (`src/components/layouts/home-layout.tsx`)
   - Full-bleed hero support
   - Sticky nav with `bg-bg/80 backdrop-blur-md`
   - Includes footer

2. **Update `WebLayout`** (`src/components/layouts/web-layout.tsx`)
   - [ ] Sticky nav `fixed top-0`
   - [ ] `bg-bg/80 backdrop-blur-md`
   - [ ] Add footer

3. **Create Footer** (`src/components/nav/footer.tsx`)
   - [ ] Links: About, Contact, Privacy
   - [ ] Social links
   - [ ] Copyright
   - [ ] Monochromatic styling

4. **Create Hero** (`src/components/hero.tsx`)
   - [ ] Full-viewport height
   - [ ] Background image with overlay
   - [ ] Centered content
   - [ ] Outline-style CTAs

---

### 🧩 Priority 4: Component Library

#### Current Problems
- Buttons styled inline with inconsistent classes
- Cards styled differently on each page
- No reusable form components
- Using filled buttons instead of outline

#### Components to Create

1. **`src/components/ui/button.tsx`**
   ```tsx
   // Primary: outline (white border)
   // Filled: white bg (for emphasis only)
   // Accent: gold bg (for live/winner)
   ```

2. **`src/components/ui/card.tsx`**
   - `bg-bg-elevated`
   - `border border-white/5`
   - `hover:border-white/10`

3. **`src/components/ui/date-badge.tsx`**
   - Tomorrowland-style: month on top, day number below

4. **`src/components/ui/badge.tsx`**
   - Outline style for status
   - Accent style for winners/live

5. **`src/components/ui/input.tsx`**
   - Dark bg, subtle border
   - ALL CAPS labels with tracking

---

### 🔍 Priority 5: SEO & Meta

#### Changes Needed
1. **Update root metadata** (`src/app/layout.tsx`)
2. **Create OG images** (1200x630)
3. **Add page-specific metadata**
4. **Add structured data** (JSON-LD for events)

---

## Color Migration Cheatsheet

New monochromatic palette with gold accent used sparingly.

| Old Class | New Class |
|-----------|-----------|
| `bg-blue-600` | `bg-white` (for emphasis) or `border border-white/30` (outline) |
| `bg-blue-700` | `hover:bg-white/5` |
| `text-blue-400` | `text-white` or `text-accent` (sparingly) |
| `bg-slate-600` | `bg-bg-muted` |
| `bg-white/10` | `bg-bg-elevated` |
| `text-gray-300` | `text-text-muted` |
| `text-gray-400` | `text-text-dim` |
| `text-gray-500` | `text-text-dim` |
| `bg-gradient-to-r from-blue-600 to-purple-600` | Remove gradient, use `border border-white/30` |
| `bg-green-600` (success buttons) | `bg-white text-bg` |
| `bg-yellow-600` (winner highlight) | `bg-accent/20 border-accent/30 text-accent` |

---

## Button Pattern Changes

| Old Pattern | New Pattern |
|-------------|-------------|
| Filled blue button | Outline: `border border-white/30 hover:border-white/60 hover:bg-white/5` |
| Filled CTA | Only for primary emphasis: `bg-white text-bg hover:bg-gray-200` |
| Link button | `text-text-muted hover:text-white` |

All buttons should use: `text-sm tracking-widest uppercase`

---

## Quick Wins (Do First)

1. [ ] Update `tailwind.config.js` with monochromatic colors
2. [ ] Import new fonts (Playfair Display, Oswald, Inter)
3. [ ] Replace all blue colors with white/outline pattern
4. [ ] Add `tracking-widest uppercase` to all buttons
5. [ ] Create simple footer component
6. [ ] Add `bg-bg/80 backdrop-blur-md` to navbar

---

## Migration Order

```
Phase 1: Foundation (Week 1)
├── Update Tailwind config (colors, fonts)
├── Create Button component (outline style)
├── Create Card component (subtle borders)
└── Add Footer component

Phase 2: Layouts (Week 2)
├── Create HomeLayout with Hero
├── Update WebLayout with sticky nav
├── Add date badge component
└── Apply layouts consistently

Phase 3: Polish (Week 3)
├── Apply new colors to all pages
├── Add ALL CAPS + letter-spacing to UI
├── Add page-specific SEO
└── Test on mobile

Phase 4: Advanced (Week 4+)
├── Structured data
├── OG image generation
├── Page transitions
└── Final visual polish
```

---

## Design Examples

Review the HTML mockups in `design-examples/`:
- `design-system.html` — Typography, colors, all components
- `home.html` — Home page layout
- `event.html` — Event detail page  
- `voting.html` — Voting interface

Open directly in browser to review. These use Tailwind CDN for standalone viewing.

---

## Notes

- The key insight from Tomorrowland: **less color is more**
- Keep UI mostly white/gray on black — color is the exception
- Outline buttons feel more elegant than filled
- ALL CAPS with letter-spacing gives sophisticated feel
- Test all changes on mobile — voting happens on phones at events
