-- Dérogations individuelles aux permissions par défaut du rôle (voir
-- src/lib/permissions.ts) : une ligne "granted=true" accorde une permission
-- que le rôle n'a pas par défaut, "granted=false" en retire une qu'il a.
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPermission_userId_key_key" ON "UserPermission"("userId", "key");

ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
