"""
Person detection using YOLOv8 (ultralytics).
Detects full-body persons when face detection fails or for group shots.
"""

from ultralytics import YOLO
import numpy as np
from PIL import Image
from typing import List, Dict, Optional
import os


# Global model instance (lazy loaded)
_model: Optional[YOLO] = None


def _get_model() -> YOLO:
    """Lazy load YOLO model."""
    global _model
    if _model is None:
        # YOLOv8n (nano) is fastest, YOLOv8s (small) is more accurate
        # Auto-downloads on first use
        _model = YOLO("yolov8n.pt")
    return _model


def detect_persons(
    image_path: str,
    conf_threshold: float = 0.25,
    model_size: str = "nano"
) -> List[Dict[str, any]]:
    """
    Detect persons (full-body) in an image using YOLOv8.
    
    Args:
        image_path: Path to image file
        conf_threshold: Confidence threshold (0-1)
        model_size: "nano", "small", "medium", "large", "xlarge"
    
    Returns:
        List of person detections, each with:
        - box: (x, y, width, height) in pixels
        - confidence: Detection confidence (0-1)
        - quality_score: Based on size and position
    """
    try:
        model = _get_model()
        
        # Run inference
        results = model(image_path, conf=conf_threshold, verbose=False)
        
        detections = []
        img = Image.open(image_path)
        img_width, img_height = img.size
        
        for result in results:
            boxes = result.boxes
            for box in boxes:
                # YOLO class 0 is "person"
                if int(box.cls) == 0:
                    # Get bounding box coordinates
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    confidence = float(box.conf[0].cpu().numpy())
                    
                    # Convert to (x, y, width, height)
                    x = int(x1)
                    y = int(y1)
                    width = int(x2 - x1)
                    height = int(y2 - y1)
                    
                    # Calculate quality score
                    person_area = width * height
                    area_score = min(1.0, person_area / (img_width * img_height))
                    
                    # Centrality score
                    center_x = x + width / 2
                    center_y = y + height / 2
                    distance_from_center = np.sqrt(
                        ((center_x - img_width / 2) / img_width) ** 2 +
                        ((center_y - img_height / 2) / img_height) ** 2
                    )
                    centrality_score = 1.0 - min(1.0, distance_from_center)
                    
                    # Quality: area (60%) + centrality (30%) + confidence (10%)
                    quality_score = (
                        area_score * 0.6 +
                        centrality_score * 0.3 +
                        confidence * 0.1
                    )
                    
                    detections.append({
                        "box": {
                            "x": x,
                            "y": y,
                            "width": width,
                            "height": height
                        },
                        "confidence": confidence,
                        "quality_score": float(quality_score)
                    })
        
        return detections
    
    except Exception as e:
        print(f"Error detecting persons in {image_path}: {e}")
        return []




