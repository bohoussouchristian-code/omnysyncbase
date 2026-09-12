"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { PosClient } from "@/components/sales/PosClient";
import { RecentSalesTable } from "@/components/sales/RecentSalesTable";
import { AchatsClientsPanel } from "@/components/sales/AchatsClientsPanel";

type PosClientProps = ComponentProps<typeof PosClient>;
type RecentSales = ComponentProps<typeof RecentSalesTable>["sales"];
type AchatsClientsProps = ComponentProps<typeof AchatsClientsPanel>;

type Tab = "jour" | "achats";

export function VenteDuJourClient({
  products,
  services,
  warehouses,
  customers,
  recentSales,
  clientSales,
  allCustomers,
  initialTab = "jour",
}: {
  products: PosClientProps["products"];
  services: PosClientProps["services"];
  warehouses: PosClientProps["warehouses"];
  customers: PosClientProps["customers"];
  recentSales: RecentSales;
  clientSales: AchatsClientsProps["sales"];
  allCustomers: AchatsClientsProps["customers"];
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Vente du jour</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tab === "jour"
              ? "Suivi des ventes saisies — le paiement s'encaisse séparément à la Caisse"
              : "Historique des achats de chaque client"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Nouvelle vente
          </button>
          {/* Réserve la place du menu compte (positionné en absolu en haut à
              droite par le layout), pour que ce bouton passe à la ligne
              plutôt que d'être caché dessous. */}
          <div className="hidden lg:block w-52 shrink-0" aria-hidden="true" />
        </div>
      </div>

      <div className="flex gap-1 mb-5 border-b border-slate-200">
        <TabButton active={tab === "jour"} onClick={() => setTab("jour")}>
          Vente du jour
        </TabButton>
        <TabButton active={tab === "achats"} onClick={() => setTab("achats")}>
          Achats clients
        </TabButton>
      </div>

      {tab === "jour" ? (
        <RecentSalesTable sales={recentSales} />
      ) : (
        <AchatsClientsPanel sales={clientSales} customers={allCustomers} />
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFormOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <h2 className="font-semibold text-slate-900">Nouvelle vente</h2>
              <button onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-600">
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
