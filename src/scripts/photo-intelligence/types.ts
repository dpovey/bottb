/**
 * TypeScript types for photo intelligence pipeline data.
 */

export interface PhotoIntelligenceResult {
  filename: string
  filepath: string
  width: number
  height: number
  hashes: {
    phash: string
    dhash: string
  }
  image_embedding: number[]
  faces: Array<{
    box: { x: number; y: number; width: number; height: number }
    confidence: number
    quality_score: number
  }>
  face_encodings: Array<{
    embedding: number[]
    box: { x: number; y: number; width: number; height: number }
    confidence: number
    quality_score: number
  }>
  persons: Array<{
    box: { x: number; y: number; width: number; height: number }
    confidence: number
    quality_score: number
  }>
  crops: Record<
    string,
    {
      crop_box: { x: number; y: number; width: number; height: number }
      confidence: number
      method: 'face' | 'person' | 'saliency'
      reason: string
    }
  >
}

export interface ClusterData {
  near_duplicates: Array<{
    cluster_id: number
    photo_filenames: string[]
    representative_photo: string
  }>
  scenes: Array<{
    cluster_id: number
    photo_filenames: string[]
    representative_photo: string
  }>
  people: Array<{
    person_id: number
    photo_filenames: string[]
    representative_face: {
      filename: string
      box: { x: number; y: number; width: number; height: number }
      quality_score: number
    }
  }>
}

export interface PeopleCluster {
  person_id: number
  photo_filenames: string[]
  representative_face: {
    filename: string
    box: { x: number; y: number; width: number; height: number }
    quality_score: number
  }
}
