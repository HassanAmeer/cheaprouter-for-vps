-- Migration 208: Manual FREE/PAID override for Manage Models curation (#reseller)
--
-- The "Manage Models" dashboard tab shows a FREE / PAID badge per model,
-- auto-detected from the shipped free-model catalog. Operators need a manual
-- override for providers whose free status the catalog does not capture
-- (NULL = auto-detect, 1 = force FREE, 0 = force PAID).

ALTER TABLE provider_model_customizations ADD COLUMN is_free_override INTEGER;
