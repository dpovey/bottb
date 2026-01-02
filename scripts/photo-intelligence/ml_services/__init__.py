"""
ML services for photo intelligence pipeline.
"""

from .face_detection import detect_faces, get_face_embeddings
from .person_detection import detect_persons
from .perceptual_hash import compute_hashes, hamming_distance, are_similar
from .image_embeddings import get_image_embedding, cosine_similarity
from .face_embeddings import get_face_encodings_for_photo, face_distance, faces_match
from .crop_calculator import calculate_smart_crop

__all__ = [
    "detect_faces",
    "get_face_embeddings",
    "detect_persons",
    "compute_hashes",
    "hamming_distance",
    "are_similar",
    "get_image_embedding",
    "cosine_similarity",
    "get_face_encodings_for_photo",
    "face_distance",
    "faces_match",
    "calculate_smart_crop",
]



