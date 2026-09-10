import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "session";
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
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      authenticated = true;
      isPlatformOwner = payload.isPlatformOwner === true;
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
