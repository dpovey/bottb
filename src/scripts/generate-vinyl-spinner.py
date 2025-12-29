#!/usr/bin/env python3
"""
Generate a high-quality vinyl record PNG for CSS rotation spinner.

Uses vinyl record image from Yamaha:
https://hub.yamaha.com/wp-content/uploads/2021/09/How-vinyl-made-Fig.-2.jpg

For use as a spinner, rotate with CSS:
  .spinner {
    animation: spin 1.8s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

Specifications:
- Output size: 200x200px (rendered from high-res for crisp quality)
- Render size: 1200x1200px (6x) then downscale for anti-aliasing
- Speed: 33⅓ RPM (1.8s per rotation)
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

# Configuration
OUTPUT_SIZE = 400  # Final output size (high-res for crisp scaling)
RENDER_SIZE = 2400  # Render at very high resolution first, then downscale for quality
LABEL_SIZE_RATIO = 0.32  # 32% - measured from Yamaha vinyl image

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
LOGO_PATH = PROJECT_ROOT / "public" / "images" / "logos" / "bottb-dark-square.png"
VINYL_PATH = PROJECT_ROOT / "public" / "images" / "vinyl-record-yamaha.jpg"
OUTPUT_PATH = PROJECT_ROOT / "public" / "images" / "vinyl-spinner.png"


def find_record_bounds(img: Image.Image) -> tuple[int, int, int, int, int, int]:
    """Find the bounding box and center of the vinyl record."""
    width, height = img.size
    img_rgb = img.convert("RGB")
    
    def is_white(p: tuple[int, int, int]) -> bool:
        return p[0] > 240 and p[1] > 240 and p[2] > 240
    
    # Scan horizontally at center
    center_y = height // 2
    left_edge = next(x for x in range(width) if not is_white(img_rgb.getpixel((x, center_y))))
    right_edge = next(x for x in range(width - 1, -1, -1) if not is_white(img_rgb.getpixel((x, center_y))))
    
    # Scan vertically at center
    center_x = width // 2
    top_edge = next(y for y in range(height) if not is_white(img_rgb.getpixel((center_x, y))))
    bottom_edge = next(y for y in range(height - 1, -1, -1) if not is_white(img_rgb.getpixel((center_x, y))))
    
    record_center_x = (left_edge + right_edge) // 2
    record_center_y = (top_edge + bottom_edge) // 2
    
    return left_edge, top_edge, right_edge, bottom_edge, record_center_x, record_center_y


def find_label_radius(img: Image.Image, center_x: int, center_y: int) -> int:
    """Find the radius of the orange label."""
    img_rgb = img.convert("RGB")
    
    def is_orange(p: tuple[int, int, int]) -> bool:
        r, g, b = p
        return r > 180 and g > 80 and g < 200 and b < 80
    
    # Scan from center outward to find where orange ends
    label_radius = 0
    for r in range(50, 500):  # Start at 50 to skip the white spindle hole
        px = img_rgb.getpixel((center_x + r, center_y))
        if not is_orange(px):
            label_radius = r
            break
    
    return label_radius


def remove_orange_label(img: Image.Image, center: tuple[int, int], radius: int) -> Image.Image:
    """Replace the orange label area with dark vinyl color."""
    img_rgb = img.convert("RGB")
    result = img_rgb.copy()
    draw = ImageDraw.Draw(result)
    
    cx, cy = center
    
    # Draw dark circle where label was - include the red ring too
    cover_radius = int(radius * 1.08)  # 8% larger to cover the red ring
    draw.ellipse(
        [cx - cover_radius, cy - cover_radius, cx + cover_radius, cy + cover_radius],
        fill=(30, 30, 30)  # Dark gray, matching inner vinyl
    )
    
    return result


def create_circular_label(logo_path: Path, size: int) -> Image.Image:
    """Load logo, invert to black text, and create a circular white label."""
    # Load and resize logo
    logo = Image.open(logo_path).convert("RGBA")
    logo = logo.resize((size, size), Image.Resampling.LANCZOS)
    
    # Invert the RGB channels (white text becomes black text)
    r, g, b, a = logo.split()
    rgb = Image.merge("RGB", (r, g, b))
    inverted_rgb = ImageOps.invert(rgb)
    
    # Recombine with original alpha channel
    inv_r, inv_g, inv_b = inverted_rgb.split()
    logo_inverted = Image.merge("RGBA", (inv_r, inv_g, inv_b, a))
    
    # Create circular mask
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse([0, 0, size - 1, size - 1], fill=255)
    
    # Cut out spindle hole (small center hole)
    spindle_radius = int(size * 0.025)
    center = size // 2
    draw.ellipse(
        [center - spindle_radius, center - spindle_radius,
         center + spindle_radius, center + spindle_radius],
        fill=0
    )
    
    # Create WHITE background for the label
    label_bg = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    
    # Composite the inverted logo (black text) onto white background
    label_bg.paste(logo_inverted, (0, 0), logo_inverted)
    
    # Apply circular mask
    circular_logo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    circular_logo.paste(label_bg, (0, 0), mask)
    
    return circular_logo


def prepare_vinyl_with_label(vinyl_path: Path, logo_path: Path, output_size: int) -> Image.Image:
    """Prepare the vinyl record with the logo label, with transparent background."""
    # Load vinyl record
    vinyl = Image.open(vinyl_path)
    
    # Find record bounds and center
    left, top, right, bottom, cx, cy = find_record_bounds(vinyl)
    record_width = right - left
    record_height = bottom - top
    record_diameter = max(record_width, record_height)
    
    # Find orange label radius
    label_radius = find_label_radius(vinyl, cx, cy)
    
    print(f"  Record bounds: ({left}, {top}) to ({right}, {bottom})")
    print(f"  Record diameter: {record_diameter}px")
    print(f"  Record center: ({cx}, {cy})")
    print(f"  Orange label radius: {label_radius}px")
    
    # Remove orange label
    vinyl_clean = remove_orange_label(vinyl, (cx, cy), label_radius)
    
    # Crop to just the record (square, centered on record)
    half_size = record_diameter // 2 + 10  # Small margin
    crop_box = (cx - half_size, cy - half_size, cx + half_size, cy + half_size)
    vinyl_cropped = vinyl_clean.crop(crop_box)
    
    # Resize to high resolution first for quality
    vinyl_resized = vinyl_cropped.resize((output_size, output_size), Image.Resampling.LANCZOS)
    
    # Create RGBA version and make the background (corners) transparent
    vinyl_rgba = vinyl_resized.convert("RGBA")
    
    # Create circular mask for the record (remove white corners)
    record_mask = Image.new("L", (output_size, output_size), 0)
    draw = ImageDraw.Draw(record_mask)
    # Record is slightly smaller than output to account for any edge artifacts
    margin = 5
    draw.ellipse([margin, margin, output_size - margin - 1, output_size - margin - 1], fill=255)
    
    # Apply mask to make corners transparent
    vinyl_transparent = Image.new("RGBA", (output_size, output_size), (0, 0, 0, 0))
    vinyl_transparent.paste(vinyl_rgba, (0, 0), record_mask)
    
    # Create and overlay the logo label
    label_size = int(output_size * LABEL_SIZE_RATIO)
    label = create_circular_label(logo_path, label_size)
    
    # Center the label
    label_offset = (output_size - label_size) // 2
    vinyl_transparent.paste(label, (label_offset, label_offset), label)
    
    return vinyl_transparent


def downscale_high_quality(img: Image.Image, target_size: int) -> Image.Image:
    """Downscale image with high-quality resampling for crisp output."""
    # Use LANCZOS resampling for best quality when downscaling
    return img.resize((target_size, target_size), Image.Resampling.LANCZOS)


def main() -> None:
    """Main entry point."""
    print("Generating high-quality vinyl spinner PNG...")
    print(f"  Render size: {RENDER_SIZE}x{RENDER_SIZE}px")
    print(f"  Output size: {OUTPUT_SIZE}x{OUTPUT_SIZE}px")
    print(f"  Label ratio: {LABEL_SIZE_RATIO * 100:.1f}%")
    print(f"  Output: {OUTPUT_PATH}")
    print(f"\n  Note: Rotate with CSS animation (1.8s linear infinite)")
    
    # Check files exist
    if not LOGO_PATH.exists():
        raise FileNotFoundError(f"Logo not found: {LOGO_PATH}")
    if not VINYL_PATH.exists():
        raise FileNotFoundError(f"Vinyl record image not found: {VINYL_PATH}")
    
    print("\n1. Preparing vinyl record with logo label at high resolution...")
    # Render at high resolution first
    record_high_res = prepare_vinyl_with_label(VINYL_PATH, LOGO_PATH, RENDER_SIZE)
    
    print(f"\n2. Downscaling to {OUTPUT_SIZE}x{OUTPUT_SIZE}px with high-quality resampling...")
    record_final = downscale_high_quality(record_high_res, OUTPUT_SIZE)
    
    print("\n3. Saving PNG with transparency...")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    record_final.save(OUTPUT_PATH, "PNG", optimize=True)
    
    # Report file size
    file_size = OUTPUT_PATH.stat().st_size
    print(f"\n✓ Done! Created {OUTPUT_PATH.name} ({file_size / 1024:.1f} KB)")
    print(f"\n  Use CSS to animate:")
    print(f"    .spinner {{ animation: spin 1.8s linear infinite; }}")
    print(f"    @keyframes spin {{ from {{ transform: rotate(0deg); }} to {{ transform: rotate(360deg); }} }}")


if __name__ == "__main__":
    main()
