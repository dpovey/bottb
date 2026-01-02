"""
Face embeddings for person identification.
Uses face_recognition library to generate 128-dimensional face encodings.
"""

from typing import List, Dict
import numpy as np
from .face_detection import detect_faces, get_face_embeddings


def get_face_encodings_for_photo(image_path: str) -> List[Dict[str, any]]:
    """
    Get face encodings (embeddings) for all faces in a photo.
    
    Args:
        image_path: Path to image file
    
    Returns:
        List of face encodings, each with:
        - embedding: 128-dimensional vector (as list)
        - box: Face bounding box
        - confidence: Detection confidence
        - quality_score: Face quality score
    """
    try:
        # Detect faces first
        face_detections = detect_faces(image_path)
        
        if not face_detections:
            return []
        
        # Extract face locations for encoding
        face_locations = []
        for detection in face_detections:
            box = detection["box"]
            # face_recognition expects (top, right, bottom, left)
            face_locations.append((
                box["y"],
                box["x"] + box["width"],
                box["y"] + box["height"],
                box["x"]
            ))
        
        # Get face encodings
        face_encodings = get_face_embeddings(image_path, face_locations)
        
        # Combine with detection info
        results = []
        for i, encoding in enumerate(face_encodings):
            if i < len(face_detections):
                detection = face_detections[i]
                results.append({
                    "embedding": encoding.tolist(),
                    "box": detection["box"],
                    "confidence": detection["confidence"],
                    "quality_score": detection["quality_score"]
                })
        
        return results
    
    except Exception as e:
        print(f"Error getting face encodings from {image_path}: {e}")
        return []


def face_distance(encoding1: List[float], encoding2: List[float]) -> float:
    """
    Calculate Euclidean distance between two face encodings.
    
    Args:
        encoding1: First face encoding (128-dim vector)
        encoding2: Second face encoding (128-dim vector)
    
    Returns:
        Euclidean distance (lower = more similar)
    """
    try:
        vec1 = np.array(encoding1)
        vec2 = np.array(encoding2)
        return float(np.linalg.norm(vec1 - vec2))
    
    except Exception as e:
        print(f"Error calculating face distance: {e}")
        return 999.0  # Large distance for errors


def faces_match(
    encoding1: List[float],
    encoding2: List[float],
    tolerance: float = 0.6
) -> bool:
    """
    Check if two face encodings match (same person).
    
    Args:
        encoding1: First face encoding
        encoding2: Second face encoding
        tolerance: Maximum distance for a match (default 0.6 works well)
    
    Returns:
        True if faces match
    """
    distance = face_distance(encoding1, encoding2)
    return distance <= tolerance



