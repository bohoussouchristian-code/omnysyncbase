"use client";

import { useActionState, useMemo, useState } from "react";
import { adjustStock } from "@/lib/actions/stock";
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
import { toCSV } from "@/lib/utils";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { SlidersHorizontal, Search } from "lucide-react";

type Product = {
  id: string;
  name: string;
  reorderLevel: number;
  unit: { symbol: string } | null;
  stocks: { warehouseId: string; quantity: number }[];
};
type Warehouse = { id: string; name: string };

export function StockClient({
  products,
  warehouses,
}: {
  products: Product[];
  warehouses: Warehouse[];
}) {
  const [warehouseId, setWarehouseId] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);

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
        title="Stock Général"
        subtitle="Niveaux de stock par dépôt — l'entrée se fait depuis Configuration des produits"
        action={
          <button
            onClick={() => setShowAdjust(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <SlidersHorizontal size={16} /> Ajuster
          </button>
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

      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title="Ajustement de stock">
        <AdjustForm products={products} warehouses={warehouses} onDone={() => setShowAdjust(false)} />
      </Modal>
    </div>
  );
}

function AdjustForm({
  products,
  warehouses,
  onDone,
}: {
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
      <input type="hidden" name="type" value="AJUSTEMENT" />

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
        <Label>Nouvelle quantité</Label>
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
