-- Migration 210: Model pricing and tier label for Manage Models curation (#reseller)
ALTER TABLE provider_model_customizations ADD COLUMN pricing_tier TEXT DEFAULT 'free';
ALTER TABLE provider_model_customizations ADD COLUMN input_cost REAL DEFAULT 0;
ALTER TABLE provider_model_customizations ADD COLUMN cache_cost REAL DEFAULT 0;
ALTER TABLE provider_model_customizations ADD COLUMN output_cost REAL DEFAULT 0;
