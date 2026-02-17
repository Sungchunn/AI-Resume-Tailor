-- V001__initial_tables.sql
-- Initial tables: users, resumes, job_descriptions, tailored_resumes

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX ix_users_id ON users (id);
CREATE UNIQUE INDEX ix_users_email ON users (email);

-- Resumes table
CREATE TABLE resumes (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    raw_content TEXT NOT NULL,
    parsed_content JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX ix_resumes_id ON resumes (id);

-- Job descriptions table
CREATE TABLE job_descriptions (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    raw_content TEXT NOT NULL,
    parsed_content JSONB,
    url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX ix_job_descriptions_id ON job_descriptions (id);

-- Tailored resumes table
CREATE TABLE tailored_resumes (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER NOT NULL REFERENCES resumes(id),
    job_id INTEGER NOT NULL REFERENCES job_descriptions(id),
    tailored_content TEXT NOT NULL,
    suggestions JSONB,
    match_score REAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ix_tailored_resumes_id ON tailored_resumes (id);
