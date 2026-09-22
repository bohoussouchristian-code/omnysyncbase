import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { SESSION_IDLE_MINUTES } from "./constants";
import type { Role } from "@prisma/client";

const COOKIE_NAME = "session";
// En production, un secret par défaut connu de tout le monde (visible dans le
// code source) permettrait à quiconque de forger une session valide pour
// n'importe quel utilisateur : on refuse de démarrer plutôt que de signer
// silencieusement des sessions avec un secret public.
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "SESSION_SECRET manquant : définissez cette variable d'environnement avant de déployer en production."
  );
}
const secretKey = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-secret-change-in-production-please-32chars-min"
);

export type SessionPayload = {
  userId: string;
  name: string;
  role: Role;
  companyId: string | null;
  isPlatformOwner: boolean;
  // Renseigné uniquement quand le propriétaire de la plateforme a choisi
  // d'entrer dans une entreprise depuis /console (voir enterCompany/exitCompany
  // dans src/lib/actions/console.ts). Absent pour tous les autres comptes.
  actingCompanyId?: string | null;
};

// Règle de mot de passe appliquée partout où un mot de passe est créé ou
// changé (nouvel utilisateur, réinitialisation, changement par soi-même,
// création d'entreprise depuis la console) : au moins 8 caractères et au
// moins un symbole, pour ne pas se limiter à des mots de passe purement
// alphanumériques.
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Le mot de passe doit contenir au moins un symbole (ex: ! @ # $ %).";
  return null;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_IDLE_MINUTES}m`)
    .sign(secretKey);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * SESSION_IDLE_MINUTES,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.active) return null;

  // Le propriétaire de la plateforme qui a "activement" choisi une entreprise
  // (voir enterCompany) est traité partout ailleurs dans l'app comme un admin
  // de cette entreprise — même compte réel (id, audit trail inchangés), mais
  // companyId/role recalculés pour que tout le code existant (requireCompanyUser,
  // les pages, etc.) fonctionne sans modification.
  if (user.isPlatformOwner && session.actingCompanyId) {
    return { ...user, companyId: session.actingCompanyId, role: "ADMIN" as Role };
  }
  return user;
}

// À utiliser dans toute action qui lit/écrit des données appartenant à une
// entreprise (produits, ventes, stock...). Garantit qu'un utilisateur est
// connecté ET rattaché à une entreprise (le propriétaire de la plateforme,
// qui n'appartient à aucune entreprise, ne peut pas appeler ces actions).
export async function requireCompanyUser() {
  const user = await getCurrentUser();
  if (!user) return { error: "Non authentifié" } as const;
  if (!user.companyId) return { error: "Ce compte n'appartient à aucune entreprise." } as const;
  return { user, companyId: user.companyId };
}

