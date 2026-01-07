#!/usr/bin/env python3
"""
Quick test script to test crop calculator on specific images.
"""

import sys
import os
from pathlib import Path

# Add ml_services to path
sys.path.insert(0, str(Path(__file__).parent))

from ml_services.crop_calculator import calculate_smart_crop
from ml_services.face_detection import detect_faces
from ml_services.person_detection import detect_persons
from PIL import Image

def test_image(image_path: str):
    """Test crop calculation on a single image."""
    print(f"\n{'='*60}")
    print(f"Testing: {os.path.basename(image_path)}")
    print(f"{'='*60}")
    
    # Get image dimensions
    with Image.open(image_path) as img:
        width, height = img.size
        print(f"Image size: {width} × {height}")
    
    # Detect faces and persons
    print("\nDetecting faces...")
    faces = detect_faces(image_path, model="hog")
    print(f"Found {len(faces)} face(s)")
    if faces:
        for i, face in enumerate(faces):
            box = face["box"]
            print(f"  Face {i+1}: x={box['x']}, y={box['y']}, w={box['width']}, h={box['height']}, "
                  f"confidence={face.get('confidence', 0):.2f}, quality={face.get('quality_score', 0):.2f}")
    
    print("\nDetecting persons...")
    persons = detect_persons(image_path)
    print(f"Found {len(persons)} person(s)")
    if persons:
        for i, person in enumerate(persons):
            box = person["box"]
            print(f"  Person {i+1}: x={box['x']}, y={box['y']}, w={box['width']}, h={box['height']}, "
                  f"confidence={person.get('confidence', 0):.2f}, quality={person.get('quality_score', 0):.2f}")
    
    # Test different aspect ratios
    aspect_ratios = [
        (4, 5),   # 4:5 (Instagram)
        (16, 9),  # 16:9 (Landscape)
        (1, 1),   # 1:1 (Square)
    ]
    
    print("\n" + "-"*60)
    print("Crop Results:")
    print("-"*60)
    
    for aspect_ratio in aspect_ratios:
        aspect_key = f"{aspect_ratio[0]}:{aspect_ratio[1]}"
        result = calculate_smart_crop(
            image_path,
            aspect_ratio,
            faces,
            persons,
            width,
            height
        )
        
        crop = result["crop_box"]
        print(f"\n{aspect_key} ({result['method']}):")
        print(f"  Crop: x={crop['x']}, y={crop['y']}, w={crop['width']}, h={crop['height']}")
        print(f"  Confidence: {result['confidence']:.2f}")
        print(f"  Reason: {result['reason']}")
        
        # Check if head would be cut off
        if faces:
            face_top = min(f["box"]["y"] for f in faces)
            crop_top = crop["y"]
            if crop_top > face_top:
                print(f"  ⚠️  WARNING: Crop starts at y={crop_top}, but face top is at y={face_top}")
            else:
                headroom = face_top - crop_top
                print(f"  ✓ Headroom above face: {headroom}px")
        elif persons:
            person_top = min(p["box"]["y"] for p in persons)
            crop_top = crop["y"]
            if crop_top > person_top:
                print(f"  ⚠️  WARNING: Crop starts at y={crop_top}, but person top is at y={person_top}")
            else:
                headroom = person_top - crop_top
                print(f"  ✓ Headroom above person: {headroom}px")

if __name__ == "__main__":
    # Test images
    base_path = "/Volumes/Extreme SSD/Photos"
    test_images = [
        "BOTBEHP19.jpg",
        "BOTBEHP20.jpg",
        "BOTBEHP23.jpg",
        "BOTBEHP24.jpg",
    ]
    
    # Try to find images in common locations
    search_paths = [
        base_path,
        os.path.join(base_path, "Socials"),
        os.path.join(base_path, "2024"),
    ]
    
    for image_name in test_images:
        found = False
        for search_path in search_paths:
            image_path = os.path.join(search_path, image_name)
            if os.path.exists(image_path):
                test_image(image_path)
                found = True
                break
        
        if not found:
            print(f"\n❌ Could not find {image_name} in any search path")
            print(f"   Searched: {', '.join(search_paths)}")




