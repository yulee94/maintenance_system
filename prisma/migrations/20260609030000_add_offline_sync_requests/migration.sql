CREATE TABLE "offline_sync_requests" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "sync_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "device_id" TEXT NOT NULL,
  "operation_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "result" JSONB,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),

  CONSTRAINT "offline_sync_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offline_sync_requests_device_id_request_id_key"
  ON "offline_sync_requests"("device_id", "request_id");

CREATE INDEX "offline_sync_requests_sync_id_idx"
  ON "offline_sync_requests"("sync_id");

CREATE INDEX "offline_sync_requests_user_id_created_at_idx"
  ON "offline_sync_requests"("user_id", "created_at");

CREATE INDEX "offline_sync_requests_branch_id_idx"
  ON "offline_sync_requests"("branch_id");

ALTER TABLE "offline_sync_requests"
  ADD CONSTRAINT "offline_sync_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
