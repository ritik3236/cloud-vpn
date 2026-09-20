-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('admin', 'ops');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('active', 'degraded', 'disabled');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('managed', 'static');

-- CreateEnum
CREATE TYPE "ConfigStatus" AS ENUM ('unassigned', 'active', 'disabled', 'revoked');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nodes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "node_pubkey" TEXT NOT NULL,
    "cidr_pool" TEXT NOT NULL,
    "dns" TEXT NOT NULL,
    "agent_url" TEXT NOT NULL,
    "agent_token" TEXT NOT NULL,
    "status" "NodeStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ip_allocations" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "config_id" TEXT,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ip_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "device_label" TEXT,
    "source_type" "SourceType" NOT NULL,
    "node_id" TEXT,
    "pubkey" TEXT,
    "encrypted_privkey" TEXT,
    "assigned_ip" TEXT,
    "external_source_id" TEXT,
    "encrypted_conf" TEXT,
    "allowed_ips" TEXT NOT NULL DEFAULT '0.0.0.0/0',
    "status" "ConfigStatus" NOT NULL DEFAULT 'unassigned',
    "replaced_by_id" TEXT,
    "issued_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "disabled_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_clerk_id_key" ON "staff"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "nodes_name_key" ON "nodes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "external_sources_name_key" ON "external_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ip_allocations_config_id_key" ON "ip_allocations"("config_id");

-- CreateIndex
CREATE INDEX "ip_allocations_node_id_released_at_idx" ON "ip_allocations"("node_id", "released_at");

-- CreateIndex
CREATE UNIQUE INDEX "configs_pubkey_key" ON "configs"("pubkey");

-- CreateIndex
CREATE UNIQUE INDEX "configs_replaced_by_id_key" ON "configs"("replaced_by_id");

-- CreateIndex
CREATE INDEX "configs_user_id_status_idx" ON "configs"("user_id", "status");

-- CreateIndex
CREATE INDEX "configs_node_id_status_idx" ON "configs"("node_id", "status");

-- CreateIndex
CREATE INDEX "configs_status_idx" ON "configs"("status");

-- CreateIndex
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_target_idx" ON "audit_log"("target");

-- AddForeignKey
ALTER TABLE "ip_allocations" ADD CONSTRAINT "ip_allocations_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ip_allocations" ADD CONSTRAINT "ip_allocations_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configs" ADD CONSTRAINT "configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configs" ADD CONSTRAINT "configs_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configs" ADD CONSTRAINT "configs_external_source_id_fkey" FOREIGN KEY ("external_source_id") REFERENCES "external_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configs" ADD CONSTRAINT "configs_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configs" ADD CONSTRAINT "configs_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The IPAM no-double-assign guarantee (SPEC §8). Prisma cannot express a PARTIAL unique index
-- in schema.prisma, so it lives here: (node_id, ip) is unique only among LIVE allocations, which
-- lets a released IP be handed out again while its history row survives. Do not drop this when
-- editing migrations by hand — without it two configs can be issued the same address.
CREATE UNIQUE INDEX "ip_allocations_node_id_ip_live_key"
    ON "ip_allocations" ("node_id", "ip")
    WHERE "released_at" IS NULL;
