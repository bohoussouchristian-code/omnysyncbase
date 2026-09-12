"use client";

import Link from "next/link";
import { Card, Badge, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { Boxes, ArrowLeftRight } from "lucide-react";

type Annex = {
  id: string;
  name: string;
  type: string;
  address: string | null;
  active: boolean;
  productCount: number;
  stockValue: number;
};

export function AnnexWarehousesClient({
  generalWarehouseName,
  annexes,
}: {
  generalWarehouseName: string | null;
  annexes: Annex[];
}) {
  return (
    <div>
      <PageHeader
        title="Dépôts annexes"
        subtitle={
          generalWarehouseName
            ? `Rattachés au Dépôt Général : ${generalWarehouseName}`
            : "Aucun Dépôt Général désigné — voir Dépôts / Boutiques"
        }
      />

      {annexes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">
          Aucun dépôt annexe pour le moment. Créez-en un depuis{" "}
          <Link href="/entrepots" className="text-blue-600 hover:underline">
            Dépôts / Boutiques
          </Link>
          .
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Adresse</th>
                  <th className="px-4 py-3 font-medium">Produits référencés</th>
                  <th className="px-4 py-3 font-medium">Valeur du stock</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {annexes.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                    <td className="px-4 py-3 text-slate-600">{a.type === "ENTREPOT" ? "Entrepôt" : "Boutique"}</td>
                    <td className="px-4 py-3 text-slate-600">{a.address || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{a.productCount}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMoney(a.stockValue)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={a.active ? "success" : "default"}>{a.active ? "Actif" : "Inactif"}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3">
                        <Link
                          href="/stock"
                          title="Voir le stock"
                          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600"
                        >
                          <Boxes size={14} /> Stock
                        </Link>
                        <Link
                          href="/transferts"
                          title="Transférer du stock"
                          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600"
                        >
                          <ArrowLeftRight size={14} /> Transférer
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
