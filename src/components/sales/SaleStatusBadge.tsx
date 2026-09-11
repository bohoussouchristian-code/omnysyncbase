import { Badge } from "@/components/ui";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

// La caisse valide une vente une fois qu'elle est intégralement payée :
// "Validé" (vert, coche) si soldée, "En attente" (orange, sablier) tant qu'il
// reste un solde (crédit, paiement partiel, ou pas encore encaissée),
// "Annulée" pour une vente annulée.
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
    return (
      <Badge tone="danger">
        <span className="inline-flex items-center gap-1">
          <XCircle size={12} className="text-red-600" /> Annulée
        </span>
      </Badge>
    );
  }
  return (
    <Badge tone="warning">
      <span className="inline-flex items-center gap-1">
        <Clock size={12} className="text-amber-600" /> En attente
      </span>
    </Badge>
  );
}
