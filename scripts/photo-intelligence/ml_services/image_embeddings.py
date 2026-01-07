"""
Image embeddings for scene-level similarity using CLIP.
"""

from sentence_transformers import SentenceTransformer
import torch
from PIL import Image
from typing import List, Optional
import numpy as np


# Global model instance (lazy loaded)
_model: Optional[SentenceTransformer] = None


def _get_model(model_name: str = "clip-ViT-B-32") -> SentenceTransformer:
    """Lazy load CLIP model."""
    global _model
    if _model is None:
        # CLIP model for image embeddings
        # Alternatives: "clip-ViT-L-14", "clip-ViT-B-32-multilingual-v1"
        _model = SentenceTransformer(model_name)
        # Use GPU if available
        if torch.cuda.is_available():
            _model = _model.cuda()
    return _model


def get_image_embedding(
    image_path: str,
    model_name: str = "clip-ViT-B-32"
) -> List[float]:
    """
    Get image embedding vector using CLIP.
    
    Args:
        image_path: Path to image file
        model_name: CLIP model name
    
    Returns:
        512-dimensional embedding vector (normalized)
    """
    try:
        model = _get_model(model_name)
        
        # Load and encode image
        image = Image.open(image_path).convert("RGB")
        embedding = model.encode(image, convert_to_numpy=True, normalize_embeddings=True)
        
        return embedding.tolist()
    
    except Exception as e:
        print(f"Error getting image embedding from {image_path}: {e}")
        return []


def cosine_similarity(embedding1: List[float], embedding2: List[float]) -> float:
    """
    Calculate cosine similarity between two embeddings.
    
    Args:
        embedding1: First embedding vector
        embedding2: Second embedding vector
    
    Returns:
        Cosine similarity (-1 to 1, higher = more similar)
    """
    try:
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return float(dot_product / (norm1 * norm2))
    
    except Exception as e:
        print(f"Error calculating cosine similarity: {e}")
        return 0.0




