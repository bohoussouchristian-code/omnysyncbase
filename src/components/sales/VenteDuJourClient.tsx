"use client";

import { useState, type ComponentProps } from "react";
import { Plus, X } from "lucide-react";
import { PosClient } from "@/components/sales/PosClient";
import { RecentSalesTable } from "@/components/sales/RecentSalesTable";

type PosClientProps = ComponentProps<typeof PosClient>;
type RecentSales = ComponentProps<typeof RecentSalesTable>["sales"];

export function VenteDuJourClient({
  products,
  services,
  warehouses,
  customers,
  recentSales,
}: {
  products: PosClientProps["products"];
  services: PosClientProps["services"];
  warehouses: PosClientProps["warehouses"];
  customers: PosClientProps["customers"];
  recentSales: RecentSales;
}) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Vente du jour</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Suivi des ventes saisies — le paiement s&apos;encaisse séparément à la Caisse
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Nouvelle vente
          </button>
        </div>
      </div>

      <RecentSalesTable sales={recentSales} />

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFormOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-slate-900">Nouvelle vente</h2>
              <button
                onClick={() => setFormOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <PosClient products={products} services={services} warehouses={warehouses} customers={customers} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
