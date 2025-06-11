CREATE INDEX IF NOT EXISTS "clients_name_idx" ON "Clients" USING btree ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "specialists_name_idx" ON "specialists" USING btree ("name");
