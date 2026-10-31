-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('clerk', 'local');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "kind" "UserKind" NOT NULL DEFAULT 'clerk';
