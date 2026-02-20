-- V5__scraper_runs.sql
-- Scraper runs audit table for tracking scraper execution history

CREATE TABLE scraper_runs (
    id SERIAL PRIMARY KEY,
    -- Run identification
    run_type VARCHAR(50) DEFAULT 'scheduled' NOT NULL,  -- scheduled, manual
    batch_id VARCHAR(100),  -- For grouping related runs
    -- Overall status
    status VARCHAR(20) NOT NULL,  -- success, partial, error, timeout
    -- Timing
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_seconds REAL,
    -- Aggregate counts
    total_jobs_found INTEGER DEFAULT 0 NOT NULL,
    total_jobs_created INTEGER DEFAULT 0 NOT NULL,
    total_jobs_updated INTEGER DEFAULT 0 NOT NULL,
    total_errors INTEGER DEFAULT 0 NOT NULL,
    -- Regional breakdown
    region_results JSONB,
    -- Error details
    error_details JSONB,
    -- Metadata
    triggered_by VARCHAR(100),  -- scheduler, user_id, api
    config_snapshot JSONB,
    notes TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ix_scraper_runs_id ON scraper_runs (id);
CREATE INDEX ix_scraper_runs_status ON scraper_runs (status);
CREATE INDEX ix_scraper_runs_started_at ON scraper_runs (started_at DESC);
CREATE INDEX ix_scraper_runs_run_type ON scraper_runs (run_type);
