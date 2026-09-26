-- CreateEnum
CREATE TYPE "FneTaxCode" AS ENUM ('TVA', 'TVAB', 'TVAC', 'TVAD');

-- CreateEnum
CREATE TYPE "FneStatus" AS ENUM ('NON_APPLICABLE', 'CERTIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "fneTaxCode" "FneTaxCode";

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "fneStatus" "FneStatus" NOT NULL DEFAULT 'NON_APPLICABLE',
ADD COLUMN     "fneReference" TEXT,
ADD COLUMN     "fneToken" TEXT,
ADD COLUMN     "fneError" TEXT;
