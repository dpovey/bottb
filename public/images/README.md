# Static Images

This directory contains static images that are served directly from the public folder.

## Directory Structure

- `icons/` - Small icons and UI elements
- `logos/` - Brand logos and static logos
- `backgrounds/` - Background images and patterns
- `placeholders/` - Placeholder images for loading states

## Usage

Reference these images in your components using:

```tsx
<img src="/images/icons/example.png" alt="Example" />
```

Or with Next.js Image component:

```tsx
import Image from 'next/image'
;<Image src="/images/logos/logo.png" alt="Logo" width={100} height={50} />
```

## Note

For dynamic images (user uploads, band logos, event images), use the Vercel Blob storage system via `/api/upload/image` instead of this directory.
