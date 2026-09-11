"use client";

import Link from "next/link";
import { Card, Badge, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { Building2, ArrowLeftRight, Boxes } from "lucide-react";

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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {annexes.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{a.name}</p>
                    <p className="text-xs text-slate-400">{a.type === "ENTREPOT" ? "Entrepôt" : "Boutique"}</p>
                  </div>
                </div>
                <Badge tone={a.active ? "success" : "default"}>{a.active ? "Actif" : "Inactif"}</Badge>
              </div>

              {a.address && <p className="text-xs text-slate-500 mb-3">{a.address}</p>}

              <div className="grid grid-cols-2 gap-3 text-sm mb-4 pt-3 border-t border-slate-100">
                <div>
                  <p className="text-slate-400 text-xs">Produits référencés</p>
                  <p className="font-medium text-slate-800">{a.productCount}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs">Valeur du stock</p>
                  <p className="font-medium text-slate-800">{formatMoney(a.stockValue)}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/stock"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Boxes size={14} /> Voir le stock
                </Link>
                <Link
                  href="/transferts"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <ArrowLeftRight size={14} /> Transférer
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
