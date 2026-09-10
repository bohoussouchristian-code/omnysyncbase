"use client";

import { useActionState, useMemo, useState } from "react";
import { adjustStock, transferStock } from "@/lib/actions/stock";
import {
  Modal,
  Input,
  Select,
  Label,
  SubmitButton,
  FormError,
  Badge,
  PageHeader,
  Card,
} from "@/components/ui";
import { formatDateTime, toCSV } from "@/lib/utils";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, SlidersHorizontal, Search } from "lucide-react";

type Product = {
  id: string;
  name: string;
  reorderLevel: number;
  unit: { symbol: string } | null;
  stocks: { warehouseId: string; quantity: number }[];
};
type Warehouse = { id: string; name: string };
type Movement = {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  reference: string | null;
  createdAt: Date;
  product: { name: string };
  warehouse: { name: string };
  user: { name: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  ENTREE: "Entrée",
  SORTIE: "Sortie",
  TRANSFERT_ENTREE: "Transfert (reçu)",
  TRANSFERT_SORTIE: "Transfert (envoyé)",
  AJUSTEMENT: "Ajustement",
  VENTE: "Vente",
  ACHAT: "Achat",
  RETOUR_VENTE: "Retour client",
  RETOUR_ACHAT: "Retour fournisseur",
};

const TYPE_TONE: Record<string, "success" | "danger" | "warning" | "info" | "default"> = {
  ENTREE: "success",
  SORTIE: "danger",
  TRANSFERT_ENTREE: "info",
  TRANSFERT_SORTIE: "info",
  AJUSTEMENT: "warning",
  VENTE: "danger",
  ACHAT: "success",
  RETOUR_VENTE: "success",
  RETOUR_ACHAT: "danger",
};

export function StockClient({
  products,
  warehouses,
  movements,
}: {
  products: Product[];
  warehouses: Warehouse[];
  movements: Movement[];
}) {
  const [warehouseId, setWarehouseId] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"ENTREE" | "SORTIE" | "AJUSTEMENT" | "TRANSFERT" | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => {
        const qty =
          warehouseId === "ALL"
            ? p.stocks.reduce((s, st) => s + st.quantity, 0)
            : p.stocks.find((st) => st.warehouseId === warehouseId)?.quantity || 0;
        return { ...p, qty };
      });
  }, [products, warehouseId, query]);

  const csv = useMemo(
    () =>
      toCSV(
        ["Produit", "Unité", "Quantité", "Statut"],
        rows.map((p) => [
          p.name,
          p.unit?.symbol || "",
          p.qty,
          p.reorderLevel > 0 && p.qty <= p.reorderLevel ? "Stock bas" : "OK",
        ])
      ),
    [rows]
  );

  return (
    <div>
      <PageHeader
        title="Stock"
        subtitle="Niveaux de stock, mouvements et transferts entre dépôts"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModal("ENTREE")}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm font-medium hover:bg-emerald-700"
            >
              <ArrowDownCircle size={16} /> Entrée
            </button>
            <button
              onClick={() => setModal("SORTIE")}
              className="flex items-center gap-2 rounded-lg bg-red-600 text-white px-3 py-2 text-sm font-medium hover:bg-red-700"
            >
              <ArrowUpCircle size={16} /> Sortie
            </button>
            <button
              onClick={() => setModal("TRANSFERT")}
              className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-3 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <ArrowLeftRight size={16} /> Transfert
            </button>
            <button
              onClick={() => setModal("AJUSTEMENT")}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <SlidersHorizontal size={16} /> Ajuster
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={warehouseId}
          onChange={(e) => setWarehouseId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="ALL">Tous les dépôts</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <ExportCsvButton filename="stock.csv" csv={csv} />
      </div>

      <Card className="overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">Unité</th>
                <th className="px-4 py-3 font-medium text-right">Quantité</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const low = p.reorderLevel > 0 && p.qty <= p.reorderLevel;
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.unit?.symbol || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{p.qty}</td>
                    <td className="px-4 py-3">
                      {low ? (
                        <Badge tone="danger">Stock bas</Badge>
                      ) : (
                        <Badge tone="success">OK</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                    Aucun produit trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Historique des mouvements récents</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Produit</th>
                <th className="pb-2 font-medium">Dépôt</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Quantité</th>
                <th className="pb-2 font-medium">Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                  <td className="py-2 text-slate-700">{m.product.name}</td>
                  <td className="py-2 text-slate-600">{m.warehouse.name}</td>
                  <td className="py-2">
                    <Badge tone={TYPE_TONE[m.type] || "default"}>{TYPE_LABELS[m.type] || m.type}</Badge>
                  </td>
                  <td className="py-2 text-right font-medium">{m.quantity}</td>
                  <td className="py-2 text-slate-500">{m.user?.name || "—"}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Aucun mouvement enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={modal === "ENTREE" || modal === "SORTIE" || modal === "AJUSTEMENT"}
        onClose={() => setModal(null)}
        title={
          modal === "ENTREE" ? "Entrée de stock" : modal === "SORTIE" ? "Sortie de stock" : "Ajustement de stock"
        }
      >
        {modal && modal !== "TRANSFERT" && (
          <AdjustForm type={modal} products={products} warehouses={warehouses} onDone={() => setModal(null)} />
        )}
      </Modal>

      <Modal open={modal === "TRANSFERT"} onClose={() => setModal(null)} title="Transfert entre dépôts">
        <TransferForm products={products} warehouses={warehouses} onDone={() => setModal(null)} />
      </Modal>
    </div>
  );
}

function AdjustForm({
  type,
  products,
  warehouses,
  onDone,
}: {
  type: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  products: Product[];
  warehouses: Warehouse[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await adjustStock(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="type" value={type} />

      <div>
        <Label>Produit</Label>
        <Select name="productId" required>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Dépôt / Boutique</Label>
        <Select name="warehouseId" required>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>{type === "AJUSTEMENT" ? "Nouvelle quantité" : "Quantité"}</Label>
        <Input type="number" name="quantity" min={0} step="1" required />
      </div>

      <div>
        <Label>Motif (optionnel)</Label>
        <Input name="reason" placeholder="Ex: Casse, don, correction inventaire..." />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Valider</SubmitButton>
      </div>
    </form>
  );
}

function TransferForm({
  products,
  warehouses,
  onDone,
}: {
  products: Product[];
  warehouses: Warehouse[];
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await transferStock(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />

      <div>
        <Label>Produit</Label>
        <Select name="productId" required>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Depuis</Label>
          <Select name="fromWarehouseId" required>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Vers</Label>
          <Select name="toWarehouseId" required defaultValue={warehouses[1]?.id}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Quantité</Label>
        <Input type="number" name="quantity" min={1} step="1" required />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Transférer</SubmitButton>
      </div>
    </form>
  );
}
