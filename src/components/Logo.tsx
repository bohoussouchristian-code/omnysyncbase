// Sigle OSB : le "O" est représenté comme un anneau (évoque la synchronisation
// au cœur du nom OmnySyncBase), accolé aux lettres "SB" en gras — un même
// symbole utilisé partout où l'app affiche son logo (connexion, barre
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
      <circle cx="13.5" cy="20" r="6.5" fill="none" stroke="white" strokeWidth="3.2" />
      <text
        x="21.5"
        y="25.2"
        fontFamily="var(--font-sans, ui-sans-serif)"
        fontWeight="700"
        fontSize="14.5"
        letterSpacing="-0.4"
        fill="white"
      >
        SB
      </text>
    </svg>
  );
}
