/*
  Warnings:

  - Added the required column `agent_cert` to the `nodes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "nodes" ADD COLUMN     "agent_cert" TEXT NOT NULL;
