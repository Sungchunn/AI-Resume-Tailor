-- V002__pgvector_vault_workshop.sql
-- pgvector extension, experience_blocks (Vault), workshops tables

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Experience blocks table (the Vault)
CREATE TABLE experience_blocks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    block_type VARCHAR(50) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    source_company VARCHAR(255),
    source_role VARCHAR(255),
    source_date_start DATE,
    source_date_end DATE,
    -- Vector embedding column - 768 dimensions for Gemini text-embedding-004
    embedding vector(768),
    embedding_model VARCHAR(100) DEFAULT 'text-embedding-004',
    content_hash VARCHAR(64),
    verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX ix_experience_blocks_id ON experience_blocks (id);
CREATE INDEX ix_experience_blocks_user_id ON experience_blocks (user_id);

-- HNSW index for fast approximate nearest neighbor search
-- m=16: Each node connects to 16 others (balance of speed/recall)
-- ef_construction=64: Build quality (higher = better recall, slower build)
CREATE INDEX ix_experience_blocks_embedding_hnsw
ON experience_blocks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- GIN index for efficient tag filtering
CREATE INDEX ix_experience_blocks_tags
ON experience_blocks
USING gin(tags);

-- Composite index for common filter patterns
CREATE INDEX ix_experience_blocks_user_type ON experience_blocks (user_id, block_type);

-- Workshops table
CREATE TABLE workshops (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_title VARCHAR(255) NOT NULL,
    job_company VARCHAR(255),
    job_description TEXT,
    -- Vector embedding for job description - enables semantic matching
    job_embedding vector(768),
    status VARCHAR(50) DEFAULT 'draft',
    -- JSONB for structured resume sections being built
    sections JSONB DEFAULT '{}',
    -- Array of block IDs pulled from the Vault
    pulled_block_ids INTEGER[] DEFAULT '{}',
    -- JSONB for pending AI suggestions (diff operations)
    pending_diffs JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    exported_at TIMESTAMPTZ
);

CREATE INDEX ix_workshops_id ON workshops (id);
CREATE INDEX ix_workshops_user_id ON workshops (user_id);
CREATE INDEX ix_workshops_status ON workshops (user_id, status);
