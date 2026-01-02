"""
Smart crop calculator - people-first framing.
Prioritizes faces, then persons, then saliency.
"""

from typing import Dict, List, Tuple, Optional
import numpy as np
from PIL import Image


def calculate_smart_crop(
    image_path: str,
    aspect_ratio: Tuple[float, float],
    faces: List[Dict],
    persons: List[Dict],
    image_width: int,
    image_height: int,
    headroom_ratio: float = 0.15
) -> Dict[str, any]:
    """
    Calculate optimal crop box for target aspect ratio.
    
    Args:
        image_path: Path to image (for dimensions if not provided)
        aspect_ratio: Target aspect ratio (width, height) e.g., (4, 5) for 4:5
        faces: List of face detections
        persons: List of person detections
        image_width: Image width in pixels
        image_height: Image height in pixels
        headroom_ratio: Extra space above faces (0.15 = 15%)
    
    Returns:
        Dictionary with:
        - crop_box: {x, y, width, height} in pixels
        - confidence: 0-1 confidence score
        - method: 'face', 'person', or 'saliency'
        - reason: Human-readable reason
    """
    target_width_ratio, target_height_ratio = aspect_ratio
    target_aspect = target_width_ratio / target_height_ratio
    
    # Calculate MAXIMAL target crop dimensions (use as much of image as possible)
    # This ensures the crop uses the maximum possible area while maintaining aspect ratio
    if image_width / image_height > target_aspect:
        # Image is wider than target - use FULL height, calculate width
        crop_height = image_height
        crop_width = int(crop_height * target_aspect)
        # Ensure we don't exceed image width (shouldn't happen, but safety check)
        crop_width = min(crop_width, image_width)
    else:
        # Image is taller than target - use FULL width, calculate height
        crop_width = image_width
        crop_height = int(crop_width / target_aspect)
        # Ensure we don't exceed image height (shouldn't happen, but safety check)
        crop_height = min(crop_height, image_height)
    
    # Crop should now be maximal: either crop_width == image_width OR crop_height == image_height
    
    # Strategy 1: Use faces (highest priority)
    if faces:
        best_face = max(faces, key=lambda f: f.get("quality_score", 0) * f.get("confidence", 0))
        face_box = best_face["box"]
        
        # Calculate crop centered on face with headroom
        face_center_x = face_box["x"] + face_box["width"] / 2
        face_center_y = face_box["y"] + face_box["height"] / 2
        
        # Add headroom above face
        headroom = int(face_box["height"] * headroom_ratio)
        adjusted_center_y = face_center_y - headroom
        
        # Calculate ideal crop position (centered on face)
        ideal_crop_x = face_center_x - crop_width / 2
        ideal_crop_y = adjusted_center_y - crop_height / 2
        
        # If multiple faces, adjust to include nearby faces
        if len(faces) > 1:
            all_face_x = [f["box"]["x"] for f in faces]
            all_face_y = [f["box"]["y"] for f in faces]
            all_face_right = [f["box"]["x"] + f["box"]["width"] for f in faces]
            all_face_bottom = [f["box"]["y"] + f["box"]["height"] for f in faces]
            
            min_x = min(all_face_x)
            max_x = max(all_face_right)
            min_y = min(all_face_y)
            max_y = max(all_face_bottom)
            
            # Calculate group center
            group_center_x = (min_x + max_x) / 2
            group_center_y = (min_y + max_y) / 2 - int(face_box["height"] * headroom_ratio)
            
            ideal_crop_x = group_center_x - crop_width / 2
            ideal_crop_y = group_center_y - crop_height / 2
        
        # Clamp crop position to image bounds, but ensure face is within crop
        # If clamping would cut off the face, adjust to keep face in bounds
        crop_x = max(0, min(image_width - crop_width, int(ideal_crop_x)))
        
        # For Y position: ensure the face (with headroom) is within the crop
        # Calculate minimum Y to keep face visible
        face_top_with_headroom = face_box["y"] - headroom
        min_crop_y_for_face = max(0, face_top_with_headroom - crop_height * 0.1)  # 10% buffer
        
        # Calculate maximum Y to keep face visible
        face_bottom = face_box["y"] + face_box["height"]
        max_crop_y_for_face = min(image_height - crop_height, face_bottom - crop_height * 0.9)
        
        # Use ideal position if it keeps face visible, otherwise use constrained position
        ideal_crop_y_int = int(ideal_crop_y)
        if ideal_crop_y_int < min_crop_y_for_face:
            crop_y = int(min_crop_y_for_face)
        elif ideal_crop_y_int > max_crop_y_for_face:
            crop_y = int(max_crop_y_for_face)
        else:
            crop_y = ideal_crop_y_int
        
        # Final clamp to image bounds
        crop_y = max(0, min(image_height - crop_height, crop_y))
        
        confidence = best_face.get("confidence", 1.0) * best_face.get("quality_score", 0.5)
        
        return {
            "crop_box": {
                "x": int(crop_x),
                "y": int(crop_y),
                "width": int(crop_width),
                "height": int(crop_height)
            },
            "confidence": float(confidence),
            "method": "face",
            "reason": f"Cropped around {len(faces)} face(s), centered on highest quality face"
        }
    
    # Strategy 2: Use persons (fallback when no faces)
    if persons:
        best_person = max(persons, key=lambda p: p.get("quality_score", 0) * p.get("confidence", 0))
        person_box = best_person["box"]
        
        person_center_x = person_box["x"] + person_box["width"] / 2
        
        # Estimate head position (head is typically in upper 20% of person box)
        person_head_y = person_box["y"] + person_box["height"] * 0.2
        headroom_for_person = int(person_box["height"] * 0.15)  # 15% headroom above head
        
        # Calculate ideal X position (centered on person)
        ideal_crop_x = person_center_x - crop_width / 2
        crop_x = max(0, min(image_width - crop_width, int(ideal_crop_x)))
        
        # For Y position: ensure person's head is always within crop
        person_top = person_box["y"]
        
        # Calculate where we want the head positioned in the crop (with headroom above)
        # Position head at about 20% from top of crop to leave room above
        head_target_y_in_crop = int(crop_height * 0.20)
        
        # Calculate ideal crop Y: person_top should be at head_target_y_in_crop in the crop
        # So: person_top = crop_y + head_target_y_in_crop
        # Therefore: crop_y = person_top - head_target_y_in_crop
        ideal_crop_y = person_top - head_target_y_in_crop
        
        # Clamp to image bounds
        crop_y = max(0, min(image_height - crop_height, int(ideal_crop_y)))
        
        # CRITICAL: Ensure person top is always within crop bounds
        # If crop_y > person_top, the crop starts below the person (head cut off) - FIX IT
        if crop_y >= person_top:
            # Crop starts at or below person top - move crop up to include person
            # Put person top at the top of the crop (or slightly below for minimal headroom)
            crop_y = max(0, person_top - int(crop_height * 0.05))  # 5% headroom minimum
            crop_y = min(crop_y, image_height - crop_height)
        
        # Final verification: person_top must be within crop
        if not (crop_y <= person_top <= crop_y + crop_height):
            # Emergency fallback: ensure person is in crop
            crop_y = max(0, person_top - int(crop_height * 0.1))
            crop_y = min(crop_y, image_height - crop_height)
        
        confidence = best_person.get("confidence", 0.5) * best_person.get("quality_score", 0.5)
        
        return {
            "crop_box": {
                "x": int(crop_x),
                "y": int(crop_y),
                "width": int(crop_width),
                "height": int(crop_height)
            },
            "confidence": float(confidence),
            "method": "person",
            "reason": f"Cropped around person (no faces detected)"
        }
    
    # Strategy 3: Center crop (fallback)
    crop_x = (image_width - crop_width) // 2
    crop_y = (image_height - crop_height) // 2
    
    return {
        "crop_box": {
            "x": int(crop_x),
            "y": int(crop_y),
            "width": int(crop_width),
            "height": int(crop_height)
        },
        "confidence": 0.3,
        "method": "saliency",
        "reason": "No faces or persons detected, using center crop"
    }



