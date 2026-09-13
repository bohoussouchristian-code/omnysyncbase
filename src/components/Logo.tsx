// Sigle OSB : les trois lettres bien lisibles dans un badge arrondi — un
// même symbole utilisé partout où l'app affiche son logo (connexion, barre
// latérale, console propriétaire), pour une identité cohérente.
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
      <rect width="40" height="40" rx="10" className="fill-blue-600" />
      <text
        x="20"
        y="25.5"
        textAnchor="middle"
        fontFamily="var(--font-sans, ui-sans-serif)"
        fontWeight="700"
        fontSize="13.5"
        letterSpacing="0.2"
        fill="white"
      >
        OSB
      </text>
    </svg>
  );
}
