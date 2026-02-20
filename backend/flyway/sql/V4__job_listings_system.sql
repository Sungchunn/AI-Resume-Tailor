-- V4__job_listings_system.sql
-- Job listings system: job_listings, user_job_interactions tables
-- Updates to tailored_resumes: job_listing_id, style_settings, section_order

-- Enable pg_trgm extension for full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Job listings table (system-wide from Apify/n8n)
CREATE TABLE job_listings (
    id SERIAL PRIMARY KEY,
    external_job_id VARCHAR(255) NOT NULL,
    -- Core job fields
    job_title VARCHAR(500) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_url VARCHAR(2000),
    company_logo VARCHAR(2000),
    location VARCHAR(500),
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(255),
    is_remote BOOLEAN DEFAULT FALSE NOT NULL,
    seniority VARCHAR(100),
    job_function VARCHAR(255),
    industry VARCHAR(255),
    job_description TEXT NOT NULL,
    job_url VARCHAR(2000) NOT NULL,
    job_url_direct VARCHAR(2000),
    job_type JSONB,
    emails JSONB,
    easy_apply BOOLEAN DEFAULT FALSE NOT NULL,
    applicants_count VARCHAR(50),
    -- Salary
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(10) DEFAULT 'USD',
    salary_period VARCHAR(20),
    -- Metadata
    date_posted TIMESTAMPTZ,
    scraped_at TIMESTAMPTZ,
    source_platform VARCHAR(100),
    region VARCHAR(100),
    last_synced_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX ix_job_listings_external_job_id ON job_listings (external_job_id);
CREATE INDEX ix_job_listings_id ON job_listings (id);
CREATE INDEX ix_job_listings_company ON job_listings (company_name);
CREATE INDEX ix_job_listings_location ON job_listings (location);
CREATE INDEX ix_job_listings_seniority ON job_listings (seniority);
CREATE INDEX ix_job_listings_job_function ON job_listings (job_function);
CREATE INDEX ix_job_listings_industry ON job_listings (industry);
CREATE INDEX ix_job_listings_date_posted ON job_listings (date_posted DESC);
CREATE INDEX ix_job_listings_salary ON job_listings (salary_min, salary_max);
CREATE INDEX ix_job_listings_active ON job_listings (is_active);
CREATE INDEX ix_job_listings_country ON job_listings (country);
CREATE INDEX ix_job_listings_is_remote ON job_listings (is_remote);
CREATE INDEX ix_job_listings_region ON job_listings (region);
CREATE INDEX ix_job_listings_easy_apply ON job_listings (easy_apply);

-- Full-text search indexes using pg_trgm
CREATE INDEX ix_job_listings_title_gin ON job_listings USING gin(job_title gin_trgm_ops);
CREATE INDEX ix_job_listings_desc_gin ON job_listings USING gin(job_description gin_trgm_ops);

-- User job interactions table
CREATE TABLE user_job_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_listing_id INTEGER NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    -- Interaction states
    is_saved BOOLEAN DEFAULT FALSE,
    is_hidden BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMPTZ,
    last_viewed_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    -- Unique constraint
    CONSTRAINT uq_user_job_interaction UNIQUE (user_id, job_listing_id)
);

CREATE INDEX ix_user_job_interactions_id ON user_job_interactions (id);
CREATE INDEX ix_user_job_interactions_user ON user_job_interactions (user_id);
CREATE INDEX ix_user_job_interactions_job ON user_job_interactions (job_listing_id);
CREATE INDEX ix_user_job_interactions_saved ON user_job_interactions (user_id, is_saved);
CREATE INDEX ix_user_job_interactions_hidden ON user_job_interactions (user_id, is_hidden);

-- Update tailored_resumes table
ALTER TABLE tailored_resumes ADD COLUMN job_listing_id INTEGER REFERENCES job_listings(id);
ALTER TABLE tailored_resumes ADD COLUMN style_settings JSONB DEFAULT '{}' NOT NULL;
ALTER TABLE tailored_resumes ADD COLUMN section_order TEXT[] DEFAULT '{}' NOT NULL;
ALTER TABLE tailored_resumes ADD COLUMN updated_at TIMESTAMPTZ;

-- Make job_id nullable
ALTER TABLE tailored_resumes ALTER COLUMN job_id DROP NOT NULL;

-- Add CHECK constraint: exactly one job source must be set
ALTER TABLE tailored_resumes ADD CONSTRAINT ck_tailored_resume_one_job_source
CHECK (
    (job_id IS NOT NULL AND job_listing_id IS NULL) OR
    (job_id IS NULL AND job_listing_id IS NOT NULL)
);

CREATE INDEX ix_tailored_resumes_job_listing_id ON tailored_resumes (job_listing_id);
