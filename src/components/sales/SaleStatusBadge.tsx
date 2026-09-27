import { Badge } from "@/components/ui";
import { CheckCircle2, Clock, XCircle, Wallet } from "lucide-react";

// Distingue bien "jamais encore encaissée" (En attente — nécessite de cliquer
// Encaisser) d'une vente déjà validée mais dont le solde reste dû (Crédit /
// Partielle — déjà passée par la caisse, la dette se règle désormais depuis
// le dossier du client, pas en recliquant ici). Les confondre sous un même
// "En attente" laissait croire qu'une vente à crédit n'avait jamais été
// encaissée alors qu'elle l'a bien été.
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
  if (status === "CREDIT" || status === "PARTIELLE") {
    return (
      <Badge tone="danger">
        <span className="inline-flex items-center gap-1">
          <Wallet size={12} className="text-red-600" /> {status === "CREDIT" ? "Crédit" : "Partielle"}
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
