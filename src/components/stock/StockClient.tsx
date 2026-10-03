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
import { toCSV, formatMoney, formatDateTime } from "@/lib/utils";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { SlidersHorizontal, Search } from "lucide-react";

type Product = {
  id: string;
  name: string;
  reference: string | null;
  purchasePrice: number;
  reorderLevel: number;
  unit: { symbol: string } | null;
  packUnit: { name: string; symbol: string } | null;
  piecesPerPack: number;
  stocks: { warehouseId: string; quantity: number }[];
  supplierPrices: { supplier: { name: string } }[];
};
type Warehouse = { id: string; name: string };

// La casse/réception se déclare en casier (voir ApprovisionnementClient) —
// le stock doit donc aussi s'afficher en casier, pas en bouteille, dès qu'un
// lot est configuré. Même logique que TransfersClient.formatQty.
function formatQty(qty: number, p: { unit: { symbol: string } | null; packUnit: { name: string; symbol: string } | null; piecesPerPack: number }) {
  if (p.packUnit && p.piecesPerPack > 1) {
    const packs = Math.floor(qty / p.piecesPerPack);
    const rest = qty - packs * p.piecesPerPack;
    const restLabel = `${rest} ${p.unit?.symbol || ""}`.trim();
    if (packs === 0) return restLabel || `0 ${p.packUnit.symbol}`;
    const packLabel = `${packs} ${p.packUnit.symbol}`;
    return rest > 0 ? `${packLabel} + ${restLabel}` : packLabel;
  }
  return `${qty} ${p.unit?.symbol || ""}`.trim();
}
type LastMovement = {
  quantity: number;
  number: string;
  warehouseName: string;
  supplierName: string;
  date: Date;
  by: string | null;
};

export function StockClient({
  products,
  warehouses,
  lastMovementByProduct,
}: {
  products: Product[];
  warehouses: Warehouse[];
  lastMovementByProduct: Record<string, LastMovement>;
}) {
  const [warehouseId, setWarehouseId] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.reference?.toLowerCase().includes(q) ?? false))
      .map((p) => {
        const qty =
          warehouseId === "ALL"
            ? p.stocks.reduce((s, st) => s + st.quantity, 0)
            : p.stocks.find((st) => st.warehouseId === warehouseId)?.quantity || 0;
        const suppliers = p.supplierPrices.map((sp) => sp.supplier.name).join(", ");
        return { ...p, qty, suppliers, stockValue: qty * p.purchasePrice, lastMovement: lastMovementByProduct[p.id] };
      });
  }, [products, warehouseId, query, lastMovementByProduct]);

  const totalStockValue = useMemo(() => rows.reduce((s, p) => s + p.stockValue, 0), [rows]);

  const csv = useMemo(
    () =>
      toCSV(
        [
          "Réf.",
          "Produit",
          "Unité",
          "Quantité",
          "Prix d'achat",
          "Valeur stock",
          "Fournisseur(s)",
          "Statut",
          "Qté dernière entrée",
          "N° BL",
          "Emplacement",
          "Dernière entrée le",
          "Fait par",
        ],
        rows.map((p) => {
          const m = lastMovementByProduct[p.id];
          return [
            p.reference || "",
            p.name,
            p.packUnit?.symbol || p.unit?.symbol || "",
            formatQty(p.qty, p),
            p.purchasePrice,
            p.stockValue,
            p.suppliers,
            p.reorderLevel > 0 && p.qty <= p.reorderLevel ? "Stock bas" : "OK",
            m ? formatQty(m.quantity, p) : "",
            m?.number ?? "",
            m?.warehouseName ?? "",
            m ? formatDateTime(m.date) : "",
            m?.by ?? "",
          ];
        })
      ),
    [rows, lastMovementByProduct]
  );

  return (
    <div>
      <PageHeader
        title="Stock Général"
        subtitle={`${rows.length} produit(s) — Valeur totale du stock : ${formatMoney(totalStockValue)}`}
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
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium">Réf.</th>
                <th className="px-2 py-2 font-medium">Produit</th>
                <th className="px-2 py-2 font-medium">Unité</th>
                <th className="px-2 py-2 font-medium text-right">Quantité</th>
                <th className="px-2 py-2 font-medium text-right">Prix d&apos;achat</th>
                <th className="px-2 py-2 font-medium text-right">Valeur stock</th>
                <th className="px-2 py-2 font-medium">Fournisseur(s)</th>
                <th className="px-2 py-2 font-medium">Statut</th>
                <th className="px-2 py-2 font-medium text-right">Qté dernière entrée</th>
                <th className="px-2 py-2 font-medium">N° BL</th>
                <th className="px-2 py-2 font-medium">Emplacement</th>
                <th className="px-2 py-2 font-medium">Dernière entrée le</th>
                <th className="px-2 py-2 font-medium">Fait par</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const low = p.reorderLevel > 0 && p.qty <= p.reorderLevel;
                const m = p.lastMovement;
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5 text-slate-400 font-mono">{p.reference || "—"}</td>
                    <td className="px-2 py-1.5 font-medium text-slate-800">{p.name}</td>
                    <td className="px-2 py-1.5 text-slate-600">{p.packUnit?.symbol || p.unit?.symbol || "—"}</td>
                    <td className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{formatQty(p.qty, p)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-600 whitespace-nowrap">{formatMoney(p.purchasePrice)}</td>
                    <td className="px-2 py-1.5 text-right font-medium text-slate-700 whitespace-nowrap">{formatMoney(p.stockValue)}</td>
                    <td className="px-2 py-1.5 text-slate-600">{p.suppliers || "—"}</td>
                    <td className="px-2 py-1.5">
                      {low ? (
                        <Badge tone="danger">Stock bas</Badge>
                      ) : (
                        <Badge tone="success">OK</Badge>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right text-slate-600 whitespace-nowrap">{m ? formatQty(m.quantity, p) : "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{m?.number ?? "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600">{m?.warehouseName ?? "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{m ? formatDateTime(m.date) : "—"}</td>
                    <td className="px-2 py-1.5 text-slate-600">{m?.by ?? "—"}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-4 py-8 text-center text-slate-400">
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
