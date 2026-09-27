import { prisma } from "@/lib/prisma";

// Journal des opérations sensibles (annulations, changements de rôle,
// désactivation d'utilisateur, réinitialisation de mot de passe, paramètres
// entreprise/FNE) : qui, quoi, quand, ancienne et nouvelle valeur. Chaque
// action serveur qui touche une opération sensible appelle ceci juste après
// avoir écrit en base — jamais avant, pour ne journaliser que ce qui a
// réellement été appliqué.
export async function logAudit(params: {
  companyId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        oldValue: params.oldValue != null ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue != null ? JSON.stringify(params.newValue) : null,
        reason: params.reason ?? null,
      },
    });
  } catch {
    // Le journal d'audit ne doit jamais faire échouer l'opération métier
    // qu'il journalise — une panne d'écriture du log est silencieuse ici,
    // jamais répercutée sur l'utilisateur.
  }
}
