-- Add indexes for chat table performance optimization
CREATE INDEX IF NOT EXISTS "user_id_idx" ON "Chat" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "chat_client_id_idx" ON "Chat" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "user_updated_idx" ON "Chat" USING btree ("userId","updatedAt");