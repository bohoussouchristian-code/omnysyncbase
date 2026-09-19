-- CreateTable
CREATE TABLE "LoginFailure" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginFailure_ipAddress_createdAt_idx" ON "LoginFailure"("ipAddress", "createdAt");
