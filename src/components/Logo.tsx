// Sigle OSB : les trois lettres bien lisibles dans un badge arrondi — un
// même symbole utilisé partout où l'app affiche son logo (connexion, barre
// latérale, console propriétaire), pour une identité cohérente.
// Couleurs et police posées via `style` (pas des attributs SVG bruts avec
// `var(...)`, pas fiable dans tous les navigateurs) pour un rendu garanti.
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="OSB"
    >
      <rect width="40" height="40" rx="10" style={{ fill: "var(--color-blue-600, #1c3d68)" }} />
      <text
        x="20"
        y="25.5"
        textAnchor="middle"
        style={{
          fontFamily: "ui-sans-serif, system-ui, Arial, sans-serif",
          fontWeight: 700,
          fontSize: 13.5,
          letterSpacing: 0.2,
          fill: "#ffffff",
        }}
      >
        OSB
      </text>
    </svg>
  );
}
