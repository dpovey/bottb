#!/usr/bin/env python3
# Configure matplotlib backend before any imports to avoid slow font scanning
import os
os.environ['MPLBACKEND'] = 'Agg'
"""
Photo Intelligence Pipeline Orchestrator

Processes photos in batches to generate:
- Smart crop boxes
- Perceptual hashes
- Image embeddings
- Face detections and embeddings
- Clustering results
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import pandas as pd
from tqdm import tqdm
from PIL import Image


def find_image_files(
    dir_path: Path,
    recursive: bool = True,
    skip_existing: bool = False,
    existing_filenames: Optional[set] = None
) -> List[str]:
    """
    Find all image files in a directory, matching the strategy from bulk-upload-photos.
    
    Args:
        dir_path: Directory to search
        recursive: Search subdirectories
        skip_existing: Skip files that already exist in database
        existing_filenames: Set of filenames that already exist (if skip_existing is True)
    
    Returns:
        List of image file paths
    """
    files: List[str] = []
    
    try:
        entries = list(dir_path.iterdir())
    except PermissionError:
        return files
    
    for entry in entries:
        # Skip macOS metadata files
        if entry.name.startswith('._') or entry.name == '.DS_Store':
            continue
        
        if entry.is_dir() and recursive:
            # Recursively search subdirectories
            sub_files = find_image_files(entry, recursive, skip_existing, existing_filenames)
            files.extend(sub_files)
        elif entry.is_file():
            # Only process image files (not videos)
            ext = entry.suffix.lower()
            if ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif']:
                # Validate it's actually an image (not a video with wrong extension)
                try:
                    with Image.open(entry) as img:
                        # Verify it has valid dimensions
                        if img.width > 0 and img.height > 0:
                            # Check if we should skip existing files
                            if skip_existing and existing_filenames:
                                if entry.name in existing_filenames:
                                    continue
                            files.append(str(entry))
                except Exception:
                    # Not a valid image file, skip it
                    continue
    
    return files

# Add ml_services to path
ml_services_path = Path(__file__).parent / "ml_services"
sys.path.insert(0, str(Path(__file__).parent))

from ml_services.face_detection import detect_faces, get_face_embeddings
from ml_services.person_detection import detect_persons
from ml_services.perceptual_hash import compute_hashes
from ml_services.image_embeddings import get_image_embedding
from ml_services.face_embeddings import get_face_encodings_for_photo
from ml_services.crop_calculator import calculate_smart_crop


# Target aspect ratios for smart cropping
ASPECT_RATIOS = [
    (4, 5),   # Instagram portrait
    (16, 9),  # Landscape
    (1, 1),   # Square
]

# Saturation threshold below which an image is considered monochrome
MONOCHROME_SATURATION_THRESHOLD = 0.1


def detect_monochrome(image_path: str) -> bool:
    """
    Detect if an image is B&W or largely monochrome.
    
    Uses color saturation analysis - low average saturation indicates monochrome.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        True if the image is monochrome/B&W, False if color
    """
    import numpy as np
    
    with Image.open(image_path) as img:
        # Convert to RGB if needed (handles grayscale, RGBA, etc.)
        rgb_img = img.convert('RGB')
        arr = np.array(rgb_img)
    
    # Extract R, G, B channels
    r, g, b = arr[:, :, 0].astype(float), arr[:, :, 1].astype(float), arr[:, :, 2].astype(float)
    
    # Calculate saturation for each pixel
    # Saturation = (max(R,G,B) - min(R,G,B)) / max(R,G,B) for non-black pixels
    max_rgb = np.maximum(np.maximum(r, g), b)
    min_rgb = np.minimum(np.minimum(r, g), b)
    
    # Avoid division by zero for black pixels
    saturation = np.where(max_rgb > 0, (max_rgb - min_rgb) / max_rgb, 0)
    
    # Calculate average saturation
    avg_saturation = np.mean(saturation)
    
    return avg_saturation < MONOCHROME_SATURATION_THRESHOLD


def process_photo(
    image_path: str,
    output_dir: str,
    verbose: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Process a single photo through the intelligence pipeline.
    
    Args:
        image_path: Path to image file
        output_dir: Directory for temporary outputs
        verbose: Print progress
    
    Returns:
        Dictionary with all processing results, or None if error
    """
    try:
        # Get image dimensions
        with Image.open(image_path) as img:
            width, height = img.size
        
        filename = os.path.basename(image_path)
        
        if verbose:
            print(f"Processing {filename}...")
        
        # 1. Face detection
        faces = detect_faces(image_path, model="hog")
        
        # 2. Person detection (if no faces or for group shots)
        persons = detect_persons(image_path) if len(faces) == 0 or len(faces) > 3 else []
        
        # 3. Perceptual hashing
        hashes = compute_hashes(image_path)
        
        # 4. Image embedding (for scene clustering)
        image_embedding = get_image_embedding(image_path)
        
        # 5. Face embeddings (for person identification)
        face_encodings = get_face_encodings_for_photo(image_path)
        
        # 6. Smart crops for different aspect ratios
        crops = {}
        for aspect_ratio in ASPECT_RATIOS:
            crop_result = calculate_smart_crop(
                image_path,
                aspect_ratio,
                faces,
                persons,
                width,
                height
            )
            aspect_key = f"{aspect_ratio[0]}:{aspect_ratio[1]}"
            crops[aspect_key] = crop_result
        
        # 7. Monochrome detection (B&W vs color)
        is_monochrome = detect_monochrome(image_path)
        
        # Build result dictionary
        result = {
            "filename": filename,
            "filepath": image_path,
            "width": width,
            "height": height,
            "hashes": hashes,
            "image_embedding": image_embedding,
            "faces": [
                {
                    "box": f["box"],
                    "confidence": f["confidence"],
                    "quality_score": f["quality_score"]
                }
                for f in faces
            ],
            "face_encodings": [
                {
                    "embedding": fe["embedding"],
                    "box": fe["box"],
                    "confidence": fe["confidence"],
                    "quality_score": fe["quality_score"]
                }
                for fe in face_encodings
            ],
            "persons": [
                {
                    "box": p["box"],
                    "confidence": p["confidence"],
                    "quality_score": p["quality_score"]
                }
                for p in persons
            ],
            "crops": crops,
            "is_monochrome": is_monochrome,
        }
        
        return result
    
    except Exception as e:
        print(f"Error processing {image_path}: {e}", file=sys.stderr)
        return None


def cluster_near_duplicates(
    photo_results: List[Dict[str, Any]],
    hash_threshold: int = 10
) -> List[List[str]]:
    """
    Cluster photos by perceptual hash (near-duplicates).
    
    Args:
        photo_results: List of photo processing results
        hash_threshold: Maximum Hamming distance for similarity
    
    Returns:
        List of clusters, each containing filenames
    """
    from ml_services.perceptual_hash import hamming_distance
    
    clusters = []
    processed = set()
    
    for i, photo1 in enumerate(photo_results):
        if photo1["filename"] in processed:
            continue
        
        cluster = [photo1["filename"]]
        processed.add(photo1["filename"])
        
        phash1 = photo1["hashes"]["phash"]
        dhash1 = photo1["hashes"]["dhash"]
        
        for j, photo2 in enumerate(photo_results[i + 1:], start=i + 1):
            if photo2["filename"] in processed:
                continue
            
            phash2 = photo2["hashes"]["phash"]
            dhash2 = photo2["hashes"]["dhash"]
            
            # Check both hashes
            phash_dist = hamming_distance(phash1, phash2)
            dhash_dist = hamming_distance(dhash1, dhash2)
            
            if phash_dist <= hash_threshold or dhash_dist <= hash_threshold:
                cluster.append(photo2["filename"])
                processed.add(photo2["filename"])
        
        if len(cluster) > 1:
            clusters.append(cluster)
    
    return clusters


def cluster_scenes(
    photo_results: List[Dict[str, Any]],
    similarity_threshold: float = 0.85
) -> List[List[str]]:
    """
    Cluster photos by scene similarity using image embeddings.
    
    Args:
        photo_results: List of photo processing results
        similarity_threshold: Minimum cosine similarity for same scene
    
    Returns:
        List of clusters, each containing filenames
    """
    from sklearn.cluster import DBSCAN
    from ml_services.image_embeddings import cosine_similarity
    import numpy as np
    
    # Filter photos with valid embeddings
    valid_photos = [p for p in photo_results if p.get("image_embedding")]
    
    if len(valid_photos) < 2:
        return []
    
    # Build similarity matrix
    embeddings = np.array([p["image_embedding"] for p in valid_photos])
    
    # Use DBSCAN for clustering
    # Convert similarity threshold to distance (1 - similarity)
    eps = 1.0 - similarity_threshold
    
    clustering = DBSCAN(eps=eps, min_samples=2, metric="cosine")
    labels = clustering.fit_predict(embeddings)
    
    # Group by cluster
    clusters = {}
    for idx, label in enumerate(labels):
        if label != -1:  # -1 is noise in DBSCAN
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(valid_photos[idx]["filename"])
    
    return list(clusters.values())


def cluster_people(
    photo_results: List[Dict[str, Any]],
    face_distance_threshold: float = 0.6
) -> List[Dict[str, Any]]:
    """
    Cluster faces to identify the same people across photos.
    
    Args:
        photo_results: List of photo processing results
        face_distance_threshold: Maximum face distance for same person
    
    Returns:
        List of person clusters, each with:
        - person_id: Cluster ID
        - photo_filenames: List of photos containing this person
        - representative_face: Best quality face from cluster
    """
    from ml_services.face_embeddings import face_distance
    
    # Collect all faces with their photo filenames
    all_faces = []
    for photo in photo_results:
        for face_encoding in photo.get("face_encodings", []):
            all_faces.append({
                "filename": photo["filename"],
                "embedding": face_encoding["embedding"],
                "box": face_encoding["box"],
                "quality_score": face_encoding["quality_score"],
                "confidence": face_encoding["confidence"]
            })
    
    if len(all_faces) < 2:
        return []
    
    # Simple clustering: group faces by distance
    clusters = []
    processed = set()
    
    for i, face1 in enumerate(all_faces):
        if i in processed:
            continue
        
        cluster = {
            "person_id": len(clusters),
            "photo_filenames": [face1["filename"]],
            "faces": [face1],
            "representative_face": face1
        }
        processed.add(i)
        
        for j, face2 in enumerate(all_faces[i + 1:], start=i + 1):
            if j in processed:
                continue
            
            distance = face_distance(face1["embedding"], face2["embedding"])
            if distance <= face_distance_threshold:
                cluster["photo_filenames"].append(face2["filename"])
                cluster["faces"].append(face2)
                processed.add(j)
                
                # Update representative face if this one is better
                if face2["quality_score"] > cluster["representative_face"]["quality_score"]:
                    cluster["representative_face"] = face2
        
        if len(cluster["faces"]) > 1:
            clusters.append(cluster)
    
    return clusters


def main():
    """Main pipeline entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Photo Intelligence Pipeline")
    parser.add_argument("input_dir", help="Directory containing photos")
    parser.add_argument("output_dir", help="Output directory for results")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for processing")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    parser.add_argument("--skip-clustering", action="store_true", help="Skip clustering step")
    parser.add_argument("--skip-existing", action="store_true", help="Skip photos that already exist in database")
    parser.add_argument("--existing-filenames", type=str, help="Path to JSON file with existing filenames (for --skip-existing)")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint if available (default: auto-resume)")
    parser.add_argument("--fresh", action="store_true", help="Start fresh, ignoring any existing checkpoint")
    
    args = parser.parse_args()
    
    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load existing filenames if provided
    existing_filenames = None
    if args.skip_existing:
        if args.existing_filenames and Path(args.existing_filenames).exists():
            with open(args.existing_filenames, 'r') as f:
                existing_filenames = set(json.load(f))
        else:
            print("Warning: --skip-existing requires --existing-filenames with a valid file")
    
    # Find all image files (recursively, skipping macOS files, validating images)
    image_files = find_image_files(
        input_dir,
        recursive=True,
        skip_existing=args.skip_existing,
        existing_filenames=existing_filenames
    )
    
    print(f"Found {len(image_files)} image files")
    
    # Checkpoint file to track progress
    checkpoint_path = output_dir / "checkpoint.json"
    processed_files = set()
    all_results = []
    
    # Load checkpoint if it exists (auto-resume by default, unless --fresh is specified)
    if not args.fresh and checkpoint_path.exists():
        try:
            with open(checkpoint_path, "r") as f:
                checkpoint_data = json.load(f)
                processed_files = set(checkpoint_data.get("processed_files", []))
                if "results" in checkpoint_data:
                    all_results = checkpoint_data["results"]
                last_updated = checkpoint_data.get("last_updated", "unknown")
                print(f"Resuming from checkpoint: {len(processed_files)} files already processed, {len(all_results)} results loaded")
                print(f"  Last updated: {last_updated}")
        except Exception as e:
            print(f"Warning: Could not load checkpoint: {e}")
            processed_files = set()
            all_results = []
    elif args.fresh and checkpoint_path.exists():
        checkpoint_path.unlink()
        print("Starting fresh (checkpoint file removed)")
    
    # Process photos in batches
    total_batches = (len(image_files) + args.batch_size - 1) // args.batch_size
    for batch_idx, i in enumerate(tqdm(range(0, len(image_files), args.batch_size), desc="Processing batches", total=total_batches)):
        batch = image_files[i:i + args.batch_size]
        batch_results = []
        
        # Skip already processed files
        batch = [f for f in batch if f not in processed_files]
        if not batch:
            continue
        
        for image_path in tqdm(batch, desc=f"Batch {batch_idx + 1}/{total_batches}", leave=False):
            result = process_photo(image_path, str(output_dir), args.verbose)
            if result:
                batch_results.append(result)
                processed_files.add(image_path)
        
        all_results.extend(batch_results)
        
        # Save checkpoint after each batch
        checkpoint_data = {
            "processed_files": list(processed_files),
            "results": all_results,
            "last_updated": datetime.now().isoformat(),
            "total_processed": len(all_results)
        }
        with open(checkpoint_path, "w") as f:
            json.dump(checkpoint_data, f, indent=2)
        
        # Save incremental Parquet file
        if all_results:
            photos_df = pd.DataFrame([
                {
                    "filename": r["filename"],
                    "filepath": r["filepath"],
                    "width": r["width"],
                    "height": r["height"],
                    "phash": r["hashes"]["phash"],
                    "dhash": r["hashes"]["dhash"],
                    "num_faces": len(r["faces"]),
                    "num_persons": len(r["persons"]),
                    "is_monochrome": r.get("is_monochrome", None),
                }
                for r in all_results
            ])
            photos_parquet_path = output_dir / "photos.parquet"
            photos_df.to_parquet(photos_parquet_path, index=False)
        
        # Save incremental JSON file
        photos_json_path = output_dir / "photos.json"
        with open(photos_json_path, "w") as f:
            json.dump(all_results, f, indent=2)
        
        if args.verbose:
            print(f"Checkpoint saved: {len(all_results)} photos processed")
    
    print(f"Processed {len(all_results)} photos successfully")
    
    # Final save (redundant but ensures consistency)
    if all_results:
        photos_df = pd.DataFrame([
            {
                "filename": r["filename"],
                "filepath": r["filepath"],
                "width": r["width"],
                "height": r["height"],
                "phash": r["hashes"]["phash"],
                "dhash": r["hashes"]["dhash"],
                "num_faces": len(r["faces"]),
                "num_persons": len(r["persons"]),
                "is_monochrome": r.get("is_monochrome", None),
            }
            for r in all_results
        ])
        photos_parquet_path = output_dir / "photos.parquet"
        photos_df.to_parquet(photos_parquet_path, index=False)
        print(f"Saved photo data to {photos_parquet_path}")
        
        photos_json_path = output_dir / "photos.json"
        with open(photos_json_path, "w") as f:
            json.dump(all_results, f, indent=2)
        print(f"Saved full results to {photos_json_path}")
    
    # Clustering
    if not args.skip_clustering:
        print("Clustering near-duplicates...")
        near_duplicate_clusters = cluster_near_duplicates(all_results)
        
        print("Clustering scenes...")
        scene_clusters = cluster_scenes(all_results)
        
        print("Clustering people...")
        people_clusters = cluster_people(all_results)
        
        # Save clusters
        clusters_data = {
            "near_duplicates": [
                {
                    "cluster_id": i,
                    "photo_filenames": cluster,
                    "representative_photo": cluster[0]  # First photo as representative
                }
                for i, cluster in enumerate(near_duplicate_clusters)
            ],
            "scenes": [
                {
                    "cluster_id": i,
                    "photo_filenames": cluster,
                    "representative_photo": cluster[0]
                }
                for i, cluster in enumerate(scene_clusters)
            ],
            "people": [
                {
                    "person_id": cluster["person_id"],
                    "photo_filenames": list(set(cluster["photo_filenames"])),
                    "representative_face": {
                        "filename": cluster["representative_face"]["filename"],
                        "box": cluster["representative_face"]["box"],
                        "quality_score": cluster["representative_face"]["quality_score"]
                    }
                }
                for cluster in people_clusters
            ]
        }
        
        clusters_json_path = output_dir / "clusters.json"
        with open(clusters_json_path, "w") as f:
            json.dump(clusters_data, f, indent=2)
        print(f"Saved clusters to {clusters_json_path}")
        
        # Save people clusters separately
        people_json_path = output_dir / "people.json"
        with open(people_json_path, "w") as f:
            json.dump(clusters_data["people"], f, indent=2)
        print(f"Saved people clusters to {people_json_path}")
    
    print("Pipeline complete!")


if __name__ == "__main__":
    main()


