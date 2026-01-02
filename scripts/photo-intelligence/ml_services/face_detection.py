"""
Face detection using face_recognition library (dlib backend) or MediaPipe fallback.
Detects faces and returns bounding boxes with confidence scores.
"""

try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False

# Configure matplotlib to use non-interactive backend before any imports
# This prevents slow font scanning when MediaPipe imports matplotlib
import os
os.environ['MPLBACKEND'] = 'Agg'

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False

import numpy as np
from PIL import Image
from typing import List, Dict, Tuple, Optional
import os
import sys


def detect_faces(
    image_path: str,
    model: str = "hog",
    num_jitters: int = 1
) -> List[Dict[str, any]]:
    """
    Detect faces in an image.
    
    Args:
        image_path: Path to image file
        model: "hog" (faster, CPU) or "cnn" (more accurate, GPU)
        num_jitters: Number of times to re-sample face for encoding (higher = more accurate but slower)
    
    Returns:
        List of face detections, each with:
        - box: (top, right, bottom, left) in pixels
        - confidence: Detection confidence (1.0 for face_recognition)
        - landmarks: 68-point facial landmarks (optional)
    """
    # Try face_recognition first, fallback to MediaPipe
    if FACE_RECOGNITION_AVAILABLE:
        try:
            # Load image
            image = face_recognition.load_image_file(image_path)
            
            # Detect face locations
            face_locations = face_recognition.face_locations(
                image,
                model=model,
                number_of_times_to_upsample=1
            )
            
            if len(face_locations) > 0:
                # Get face landmarks for quality assessment
                face_landmarks_list = face_recognition.face_landmarks(image, face_locations)
                
                results = []
                for i, (top, right, bottom, left) in enumerate(face_locations):
                    # Calculate face size and position
                    face_width = right - left
                    face_height = bottom - top
                    face_area = face_width * face_height
                    
                    # Get landmarks for this face
                    landmarks = face_landmarks_list[i] if i < len(face_landmarks_list) else {}
                    
                    # Calculate quality score based on size and position
                    # Larger, more central faces score higher
                    img_height, img_width = image.shape[:2]
                    center_x = (left + right) / 2
                    center_y = (top + bottom) / 2
                    distance_from_center = np.sqrt(
                        ((center_x - img_width / 2) / img_width) ** 2 +
                        ((center_y - img_height / 2) / img_height) ** 2
                    )
                    
                    # Normalize face area (0-1, assuming faces are typically 5-30% of image)
                    area_score = min(1.0, max(0.0, (face_area / (img_width * img_height) - 0.05) / 0.25))
                    
                    # Quality score: area (70%) + centrality (30%)
                    quality_score = area_score * 0.7 + (1.0 - min(1.0, distance_from_center)) * 0.3
                    
                    results.append({
                        "box": {
                            "x": int(left),
                            "y": int(top),
                            "width": int(face_width),
                            "height": int(face_height)
                        },
                        "confidence": 1.0,  # face_recognition doesn't provide confidence
                        "quality_score": float(quality_score),
                        "landmarks": landmarks
                    })
                
                return results
            else:
                # No faces found with face_recognition, try MediaPipe
                if MEDIAPIPE_AVAILABLE:
                    return _detect_faces_mediapipe(image_path)
                return []
        except Exception as e:
            print(f"face_recognition failed for {os.path.basename(image_path)}: {e}, trying MediaPipe", file=sys.stderr)
            # Fall through to MediaPipe
    
    # Fallback to MediaPipe if face_recognition not available
    if MEDIAPIPE_AVAILABLE:
        return _detect_faces_mediapipe(image_path)
    else:
        print(f"Warning: No face detection library available for {os.path.basename(image_path)}", file=sys.stderr)
        return []


def get_face_embeddings(
    image_path: str,
    face_locations: Optional[List[Tuple[int, int, int, int]]] = None,
    num_jitters: int = 1
) -> List[np.ndarray]:
    """
    Get face embeddings (128-dimensional vectors) for face recognition.
    
    Args:
        image_path: Path to image file
        face_locations: Optional pre-computed face locations
        num_jitters: Number of times to re-sample face (higher = more accurate)
    
    Returns:
        List of 128-dimensional numpy arrays (one per face)
    """
    if not FACE_RECOGNITION_AVAILABLE:
        return []
    
    try:
        image = face_recognition.load_image_file(image_path)
        
        if face_locations is None:
            face_locations = face_recognition.face_locations(image)
        
        # Get face encodings
        face_encodings = face_recognition.face_encodings(
            image,
            known_face_locations=face_locations,
            num_jitters=num_jitters
        )
        
        return face_encodings
    
    except Exception as e:
        print(f"Error getting face embeddings from {image_path}: {e}")
        return []


def _detect_faces_mediapipe(image_path: str) -> List[Dict[str, any]]:
    """Fallback face detection using MediaPipe v0.10+."""
    try:
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
        from mediapipe.tasks.python.vision.core import image as mp_image
        
        # Get path to model file (relative to this script's directory)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(script_dir, '..', 'models', 'blaze_face_short_range.tflite')
        model_path = os.path.abspath(model_path)
        
        if not os.path.exists(model_path):
            print(f"Warning: MediaPipe model not found at {model_path}, skipping face detection", file=sys.stderr)
            return []
        
        # Create FaceDetector with model file
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.FaceDetectorOptions(base_options=base_options, min_detection_confidence=0.5)
        detector = vision.FaceDetector.create_from_options(options)
        
        # Load and process image
        image = Image.open(image_path)
        image_rgb = image.convert('RGB')
        image_np = np.array(image_rgb)
        
        # Create MediaPipe Image
        mp_img = mp_image.Image(image_format=mp_image.ImageFormat.SRGB, data=image_np)
        detection_result = detector.detect(mp_img)
        
        faces = []
        if detection_result.detections:
            img_height, img_width = image_np.shape[:2]
            for detection in detection_result.detections:
                bbox = detection.bounding_box
                x = int(bbox.origin_x)
                y = int(bbox.origin_y)
                width = int(bbox.width)
                height = int(bbox.height)
                
                # Calculate quality score
                face_area = width * height
                area_score = min(1.0, face_area / (img_width * img_height))
                center_x = x + width / 2
                center_y = y + height / 2
                distance_from_center = np.sqrt(
                    ((center_x - img_width / 2) / img_width) ** 2 +
                    ((center_y - img_height / 2) / img_height) ** 2
                )
                centrality_score = 1.0 - min(1.0, distance_from_center)
                quality_score = area_score * 0.7 + centrality_score * 0.3
                
                # Get confidence from categories
                confidence = 0.5
                if detection.categories:
                    confidence = detection.categories[0].score
                
                faces.append({
                    "box": {
                        "x": x,
                        "y": y,
                        "width": width,
                        "height": height
                    },
                    "confidence": float(confidence),
                    "quality_score": float(quality_score),
                    "landmarks": {}
                })
        
        return faces
    except ImportError:
        # MediaPipe not installed
        return []
    except Exception as e:
        print(f"Error detecting faces with MediaPipe in {os.path.basename(image_path)}: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return []


