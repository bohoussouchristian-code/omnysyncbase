// Logo officiel OSB (fourni par le client) : un même fichier réutilisé
// partout où l'app affiche son logo (connexion, barre latérale, console
// propriétaire), pour une identité cohérente.
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-osb.jpg"
      alt="OSB"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, borderRadius: size / 4, objectFit: "cover" }}
    />
  );
}
