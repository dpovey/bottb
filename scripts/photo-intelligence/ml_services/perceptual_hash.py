"""
Perceptual hashing for near-duplicate detection.
Uses pHash (perceptual hash) and dHash (difference hash).
"""

import imagehash
from PIL import Image
from typing import Dict, Optional


def compute_hashes(image_path: str) -> Dict[str, str]:
    """
    Compute perceptual hashes for an image.
    
    Args:
        image_path: Path to image file
    
    Returns:
        Dictionary with:
        - phash: Perceptual hash (64-bit hex string)
        - dhash: Difference hash (64-bit hex string)
    """
    try:
        with Image.open(image_path) as img:
            # Convert to RGB if necessary
            if img.mode != "RGB":
                img = img.convert("RGB")
            
            # Compute hashes
            phash = imagehash.phash(img)
            dhash = imagehash.dhash(img)
            
            return {
                "phash": str(phash),
                "dhash": str(dhash)
            }
    
    except Exception as e:
        print(f"Error computing hashes for {image_path}: {e}")
        return {"phash": "", "dhash": ""}


def hamming_distance(hash1: str, hash2: str) -> int:
    """
    Calculate Hamming distance between two hash strings.
    
    Args:
        hash1: First hash (hex string)
        hash2: Second hash (hex string)
    
    Returns:
        Hamming distance (number of differing bits)
    """
    try:
        # Convert hex strings to integers
        int1 = int(hash1, 16)
        int2 = int(hash2, 16)
        
        # XOR and count set bits
        xor_result = int1 ^ int2
        return bin(xor_result).count("1")
    
    except Exception as e:
        print(f"Error calculating Hamming distance: {e}")
        return 999  # Large distance for errors


def are_similar(
    hash1: str,
    hash2: str,
    threshold: int = 10,
    hash_type: str = "phash"
) -> bool:
    """
    Check if two hashes are similar (near-duplicates).
    
    Args:
        hash1: First hash
        hash2: Second hash
        threshold: Maximum Hamming distance for similarity
        hash_type: "phash" or "dhash"
    
    Returns:
        True if hashes are similar
    """
    distance = hamming_distance(hash1, hash2)
    return distance <= threshold



