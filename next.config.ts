import type { NextConfig } from "next";

// Aucun script/police/image tiers n'est chargé par l'app elle-même (les
// polices Geist sont auto-hébergées par Next.js) : 'self' partout suffit.
// 'unsafe-inline' reste nécessaire sur script/style pour l'hydratation React
// et Tailwind (pas de nonce en place) — la vraie protection ici vient de
// script-src qui empêche de charger un script depuis un domaine tiers.
// 'unsafe-eval' n'est ajouté qu'en développement : React s'en sert pour ses
// outils de debug (reconstruction de call stacks) mais ne l'utilise jamais
// en production, donc pas de raison de l'autoriser sur le site déployé.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // En-têtes de durcissement de base : anti-clickjacking (l'app gère de
        // l'argent, aucune raison qu'elle soit chargée dans une iframe tierce),
        // anti-sniffing MIME, referrer minimal, HSTS pour forcer HTTPS, CSP
        // pour empêcher le chargement de script/ressource depuis un tiers.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
