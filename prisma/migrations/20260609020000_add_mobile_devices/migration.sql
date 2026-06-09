CREATE TABLE "mobile_devices" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "device_id" TEXT NOT NULL,
  "push_token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "app_version" TEXT,
  "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),

  CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mobile_devices_user_id_device_id_key" ON "mobile_devices"("user_id", "device_id");
CREATE INDEX "mobile_devices_branch_id_idx" ON "mobile_devices"("branch_id");
CREATE INDEX "mobile_devices_push_token_idx" ON "mobile_devices"("push_token");
CREATE INDEX "mobile_devices_user_id_branch_id_idx" ON "mobile_devices"("user_id", "branch_id");

ALTER TABLE "mobile_devices"
  ADD CONSTRAINT "mobile_devices_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
