-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('GENERIQUE', 'QUINCAILLERIE', 'BOISSON', 'LIBRAIRIE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'GENERIQUE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "deposit" DOUBLE PRECISION,
ADD COLUMN     "material" TEXT,
ADD COLUMN     "publisher" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "warrantyMonths" INTEGER;
