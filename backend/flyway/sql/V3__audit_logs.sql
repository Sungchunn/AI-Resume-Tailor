-- V003__audit_logs.sql
-- Audit logs table for security and compliance tracking

CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    -- Who
    user_id INTEGER,  -- Null for anonymous
    ip_address VARCHAR(45),  -- IPv4 or IPv6
    user_agent VARCHAR(500),
    -- What
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    -- Where
    endpoint VARCHAR(255),
    http_method VARCHAR(10),
    -- Details
    details JSONB,
    old_value JSONB,
    new_value JSONB,
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    error_message TEXT,
    -- When
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common query patterns
CREATE INDEX ix_audit_logs_id ON audit_logs (id);
CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX ix_audit_logs_action ON audit_logs (action);
CREATE INDEX ix_audit_logs_resource_type ON audit_logs (resource_type);
CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

-- Composite indexes for efficient queries
CREATE INDEX ix_audit_logs_user_resource ON audit_logs (user_id, resource_type);
CREATE INDEX ix_audit_logs_resource_id ON audit_logs (resource_type, resource_id);
CREATE INDEX ix_audit_logs_action_time ON audit_logs (action, created_at);
