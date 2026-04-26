# Photo Slideshow Requirements

## Core Functionality

### Navigation

- [ ] Smooth, fast slide transitions between photos (target: ~150-200ms)
- [ ] Swipe/drag support on mobile and trackpad
- [ ] Previous/Next button navigation
- [ ] Keyboard navigation: Arrow keys, Space (play/pause), Escape (close)
- [ ] Mouse wheel navigation with momentum handling
- [ ] Click thumbnail to jump to specific photo

### Display

- [ ] Single photo centered on screen at a time
- [ ] Adjacent photos hidden (not visible/overlapping)
- [ ] First and last photos properly centered (not cut off at edges)
- [ ] Fullscreen play mode: hides all controls, photo fills screen
- [ ] Click photo during play mode to pause and reveal controls

### Thumbnail Strip

- [ ] Horizontal strip at bottom showing photo thumbnails
- [ ] Current photo highlighted with ring/border
- [ ] Horizontally scrollable independently of main carousel
- [ ] Auto-scrolls to keep current thumbnail visible
- [ ] Hidden when:
  - Screen width < 768px (mobile portrait)
  - Screen height < 500px (mobile landscape)
- [ ] When thumbnail strip is hidden, photos use full available height

### Lazy Loading & Performance

- [ ] Load photos progressively (not all at once)
- [ ] Prefetch photos ahead of current position (PREFETCH_THRESHOLD)
- [ ] Initial load fills thumbnail strip (2x viewport width)
- [ ] Only render images near current index for performance

### URL & State

- [ ] URL updates to reflect current photo (debounced)
- [ ] Opening URL with photo ID loads that photo centered
- [ ] Closing slideshow returns to gallery view

## Admin Features

- [ ] Delete photo with confirmation
- [ ] Crop thumbnail
- [ ] Set hero labels (Band Hero, Event Hero, Global Hero)
- [ ] Set focal point for hero images
- [ ] Copy link to photo
- [ ] Download photo
- [ ] Share photo (opens composer modal)

## Technical Implementation

- Using `embla-carousel-react` for main carousel
- Using `embla-carousel-wheel-gestures` plugin for mouse/trackpad wheel navigation
- Thumbnail strip uses native overflow-x-auto scroll
- Responsive thumbnail visibility via `thumbnailsHidden` state (width < 768px OR height < 500px)

## Known Issues

1. Wheel gestures plugin has occasional "rubber band" bounce effect (known issue in plugin)
2. Thumbnail lazy loading may not trigger on page reload (investigating)
