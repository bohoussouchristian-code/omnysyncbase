import { Badge } from "@/components/ui";
import { CheckCircle2 } from "lucide-react";

// La caisse valide une vente une fois qu'elle est intégralement payée :
// "Validé" (vert) si soldée, "En attente" tant qu'il reste un solde (crédit
// ou paiement partiel), "Annulée" pour une vente annulée.
export function SaleStatusBadge({ status }: { status: string }) {
  if (status === "PAYEE") {
    return (
      <Badge tone="success">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-600" /> Validé
        </span>
      </Badge>
    );
  }
  if (status === "ANNULEE") {
    return <Badge tone="danger">Annulée</Badge>;
  }
  return <Badge tone="warning">En attente</Badge>;
}
