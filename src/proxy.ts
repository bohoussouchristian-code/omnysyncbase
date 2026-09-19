import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { SESSION_IDLE_MINUTES } from "@/lib/constants";

const COOKIE_NAME = "session";
// Même garde-fou que src/lib/auth.ts (dupliqué ici : le proxy tourne en
// edge runtime et ne peut pas importer ce module marqué "server-only") — un
// secret par défaut connu de tous permettrait de forger n'importe quelle session.
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "SESSION_SECRET manquant : définissez cette variable d'environnement avant de déployer en production."
  );
}
const secretKey = new TextEncoder().encode(
  process.env.SESSION_SECRET || "dev-secret-change-in-production-please-32chars-min"
);

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  let isPlatformOwner = false;
  let authenticated = false;
  let claims: JWTPayload | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      authenticated = true;
      isPlatformOwner = payload.isPlatformOwner === true;
      claims = payload;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Le propriétaire de la plateforme n'a pas d'entreprise : il ne voit que /console.
  // Les utilisateurs d'une entreprise n'ont jamais accès à /console.
  if (pathname.startsWith("/console") && !isPlatformOwner) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (!pathname.startsWith("/console") && isPlatformOwner) {
    return NextResponse.redirect(new URL("/console", request.url));
  }

  const response = NextResponse.next();

  // Session active et requête reçue : on prolonge son expiration (fenêtre
  // glissante). Sans nouvelle requête pendant SESSION_IDLE_MINUTES, le cookie
  // expire de lui-même et l'utilisateur est déconnecté à la requête suivante.
  if (claims) {
    const { exp: _exp, iat: _iat, ...rest } = claims;
    const refreshed = await new SignJWT(rest)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_IDLE_MINUTES}m`)
      .sign(secretKey);

    response.cookies.set(COOKIE_NAME, refreshed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * SESSION_IDLE_MINUTES,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
