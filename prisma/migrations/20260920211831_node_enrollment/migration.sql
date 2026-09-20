-- CreateTable
CREATE TABLE "enrollment_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cidr_pool" TEXT NOT NULL,
    "dns" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "node_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollment_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_tokens_token_hash_key" ON "enrollment_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "enrollment_tokens_expires_at_used_at_idx" ON "enrollment_tokens"("expires_at", "used_at");

-- AddForeignKey
ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
