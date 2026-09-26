-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "fneNcc" TEXT,
ADD COLUMN     "fneApiKey" TEXT,
ADD COLUMN     "fneEnabled" BOOLEAN NOT NULL DEFAULT false;
