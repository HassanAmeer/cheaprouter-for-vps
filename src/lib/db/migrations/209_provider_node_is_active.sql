-- Add is_active column to provider_nodes
ALTER TABLE provider_nodes ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
