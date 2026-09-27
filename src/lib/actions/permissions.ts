"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  roleHasPermission,
  type PermissionKey,
} from "@/lib/permissions";
import type { Role } from "@prisma/client";

function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

async function getUserOverridesMap(userId: string): Promise<Map<string, boolean>> {
  const rows = await prisma.userPermission.findMany({ where: { userId } });
  return new Map(rows.map((r) => [r.key, r.granted]));
}

// Permission effective = dérogation individuelle si elle existe, sinon
// comportement par défaut du rôle (voir ROLE_DEFAULT_PERMISSIONS).
export async function userHasPermission(
  user: { id: string; role: Role },
  key: PermissionKey
): Promise<boolean> {
  const override = await prisma.userPermission.findUnique({
    where: { userId_key: { userId: user.id, key } },
  });
  if (override) return override.granted;
  return roleHasPermission(user.role, key);
}

// Variante "plusieurs clés en un coup" — une seule requête, utile quand une
// page doit tester plusieurs permissions (ex: gate d'entrée + plusieurs
// boutons) sans multiplier les allers-retours base de données.
export async function getEffectivePermissions(user: {
  id: string;
  role: Role;
}): Promise<Set<PermissionKey>> {
  const overrides = await getUserOverridesMap(user.id);
  const set = new Set<PermissionKey>();
  for (const key of PERMISSION_KEYS) {
    const override = overrides.get(key);
    const effective = override ?? roleHasPermission(user.role, key);
    if (effective) set.add(key);
  }
  return set;
}

// Utilisé à l'intérieur des helpers locaux `requireManager()`/`requireXxx()`
// des fichiers d'actions serveur, en remplacement direct d'un contrôle de rôle
// codé en dur — conserve la même forme de retour ({error} | check).
export async function requirePermission(key: PermissionKey) {
  const check = await requireCompanyUser();
  if ("error" in check) return check;
  const allowed = await userHasPermission(check.user, key);
  if (!allowed) return { error: `Permission manquante : ${PERMISSION_LABELS[key]}.` } as const;
  return check;
}

// Liste complète des permissions avec, pour un utilisateur donné, le
// comportement par défaut de son rôle et sa dérogation éventuelle — alimente
// l'éditeur de permissions dans /utilisateurs (réservé Admin).
export async function getUserPermissionsForEdit(userId: string) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  if (check.user.role !== "ADMIN") return { error: "Accès réservé à un administrateur." };

  const target = await prisma.user.findFirst({ where: { id: userId, companyId: check.companyId } });
  if (!target) return { error: "Utilisateur introuvable." };

  const overrides = await getUserOverridesMap(userId);
  return {
    success: true as const,
    role: target.role,
    permissions: PERMISSION_KEYS.map((key) => ({
      key,
      label: PERMISSION_LABELS[key],
      roleDefault: roleHasPermission(target.role, key),
      override: overrides.has(key) ? (overrides.get(key) as boolean) : null,
    })),
  };
}

// granted=true accorde la permission, granted=false la retire, null supprime
// la dérogation (retour au comportement par défaut du rôle).
export async function setUserPermissionOverride(userId: string, key: string, granted: boolean | null) {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  const { user: current, companyId } = check;
  if (current.role !== "ADMIN") return { error: "Seul un administrateur peut modifier les permissions." };
  if (!isPermissionKey(key)) return { error: "Permission inconnue." };

  const target = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!target) return { error: "Utilisateur introuvable." };

  const before = await prisma.userPermission.findUnique({ where: { userId_key: { userId, key } } });

  if (granted === null) {
    await prisma.userPermission.deleteMany({ where: { userId, key } });
  } else {
    await prisma.userPermission.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, granted, companyId },
      update: { granted },
    });
  }

  await logAudit({
    companyId,
    userId: current.id,
    action: "user.permission_change",
    entityType: "User",
    entityId: userId,
    oldValue: { key, granted: before?.granted ?? null },
    newValue: { key, granted },
    reason: `${PERMISSION_LABELS[key]} — ${target.name}`,
  });

  revalidatePath("/utilisateurs");
  return { success: true };
}
