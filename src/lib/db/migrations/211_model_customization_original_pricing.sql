-- Migration 211: Original model pricing for discount / strike-through display on reseller platform
ALTER TABLE provider_model_customizations ADD COLUMN original_input_cost REAL DEFAULT NULL;
ALTER TABLE provider_model_customizations ADD COLUMN original_cache_cost REAL DEFAULT NULL;
ALTER TABLE provider_model_customizations ADD COLUMN original_output_cost REAL DEFAULT NULL;
