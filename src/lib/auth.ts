import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { SESSION_IDLE_MINUTES } from "./constants";
import type { Role } from "@prisma/client";

const COOKIE_NAME = "session";
const secretKey = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-secret-change-in-production-please-32chars-min"
);

export type SessionPayload = {
  userId: string;
  name: string;
  role: Role;
  companyId: string | null;
  isPlatformOwner: boolean;
};

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

