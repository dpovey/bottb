/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Add columns to photos table
  pgm.addColumn('photos', {
    intelligence_processed_at: {
      type: 'timestamp with time zone',
      notNull: false,
    },
    intelligence_version: {
      type: 'character varying(50)',
      notNull: false,
    },
  })

  // photo_crops - Smart crop calculations
  pgm.createTable('photo_crops', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    photo_id: {
      type: 'uuid',
      notNull: true,
      references: 'photos(id)',
      onDelete: 'CASCADE',
    },
    aspect_ratio: {
      type: 'character varying(20)',
      notNull: true,
    },
    crop_box: {
      type: 'jsonb',
      notNull: true,
    },
    confidence: {
      type: 'numeric(3,2)',
      notNull: true,
      check: 'confidence >= 0 AND confidence <= 1',
    },
    method: {
      type: 'character varying(20)',
      notNull: true,
      check: "method IN ('face', 'person', 'saliency', 'manual')",
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  })

  pgm.createIndex('photo_crops', 'photo_id')
  pgm.createIndex('photo_crops', ['photo_id', 'aspect_ratio'], {
    unique: true,
    name: 'photo_crops_photo_aspect_unique',
  })

  // photo_hashes - Perceptual hashes for near-duplicate detection
  pgm.createTable('photo_hashes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    photo_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'photos(id)',
      onDelete: 'CASCADE',
    },
    phash: {
      type: 'character varying(255)',
      notNull: true,
    },
    dhash: {
      type: 'character varying(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  })

  pgm.createIndex('photo_hashes', 'photo_id')

  // photo_embeddings - Image embeddings for scene clustering
  pgm.createTable('photo_embeddings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    photo_id: {
      type: 'uuid',
      notNull: true,
      references: 'photos(id)',
      onDelete: 'CASCADE',
    },
    embedding: {
      type: 'jsonb',
      notNull: true,
    },
    model: {
      type: 'character varying(50)',
      notNull: true,
      check: "model IN ('clip', 'dinov2', 'mobilenet')",
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  })

  pgm.createIndex('photo_embeddings', 'photo_id')
  pgm.createIndex('photo_embeddings', ['photo_id', 'model'], {
    unique: true,
    name: 'photo_embeddings_photo_model_unique',
  })

  // detected_faces - Face detections and embeddings
  pgm.createTable('detected_faces', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    photo_id: {
      type: 'uuid',
      notNull: true,
      references: 'photos(id)',
      onDelete: 'CASCADE',
    },
    face_box: {
      type: 'jsonb',
      notNull: true,
    },
    face_embedding: {
      type: 'jsonb',
      notNull: true,
    },
    confidence: {
      type: 'numeric(3,2)',
      notNull: true,
      check: 'confidence >= 0 AND confidence <= 1',
    },
    quality_score: {
      type: 'numeric(3,2)',
      notNull: false,
      check: 'quality_score >= 0 AND quality_score <= 1',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  })

  pgm.createIndex('detected_faces', 'photo_id')

  // photo_clusters - Clustering results
  pgm.createTable('photo_clusters', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    cluster_type: {
      type: 'character varying(20)',
      notNull: true,
      check: "cluster_type IN ('near_duplicate', 'scene', 'person')",
    },
    photo_ids: {
      type: 'uuid[]',
      notNull: true,
    },
    representative_photo_id: {
      type: 'uuid',
      notNull: false,
      references: 'photos(id)',
      onDelete: 'SET NULL',
    },
    metadata: {
      type: 'jsonb',
      notNull: false,
      default: '{}',
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  })

  pgm.createIndex('photo_clusters', 'cluster_type')
  pgm.createIndex('photo_clusters', 'representative_photo_id')
  // GIN index for array containment queries
  pgm.createIndex('photo_clusters', 'photo_ids', {
    method: 'gin',
    name: 'photo_clusters_photo_ids_gin',
  })
}

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('photo_clusters')
  pgm.dropTable('detected_faces')
  pgm.dropTable('photo_embeddings')
  pgm.dropTable('photo_hashes')
  pgm.dropTable('photo_crops')
  pgm.dropColumn('photos', 'intelligence_version')
  pgm.dropColumn('photos', 'intelligence_processed_at')
}
