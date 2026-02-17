-- Add last_indexed_block to markets for robust syncing
ALTER TABLE markets ADD COLUMN IF NOT EXISTS last_indexed_block BIGINT DEFAULT 0;
