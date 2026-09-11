"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transferStock } from "@/lib/actions/stock";
import { Modal, Select, Input, Label, FormError, PageHeader, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeftRight, Plus } from "lucide-react";

type Product = {
  id: string;
  name: string;
  unit: { symbol: string } | null;
  packUnit: { name: string; symbol: string } | null;
  piecesPerPack: number;
  stocks: { warehouseId: string; quantity: number }[];
};
type Warehouse = { id: string; name: string };
type Transfer = {
  id: string;
  quantity: number;
  createdAt: Date;
  product: { name: string; unit: { symbol: string } | null; packUnit: { name: string } | null; piecesPerPack: number };
  fromWarehouseName: string;
  toWarehouseName: string;
  user: { name: string } | null;
};

function formatQty(qty: number, p: { unit: { symbol: string } | null; packUnit: { name: string } | null; piecesPerPack: number }) {
  if (p.packUnit && p.piecesPerPack > 1) {
    const packs = Math.floor(qty / p.piecesPerPack);
    const rest = qty - packs * p.piecesPerPack;
    const restLabel = `${rest} ${p.unit?.symbol || ""}`.trim();
    if (packs === 0) return restLabel;
    const packLabel = `${packs} ${p.packUnit.name}${packs > 1 ? "s" : ""}`;
    return rest > 0 ? `${packLabel} + ${restLabel}` : packLabel;
  }
  return `${qty} ${p.unit?.symbol || ""}`.trim();
}

export function TransfersClient({
  products,
  warehouses,
  transfers,
}: {
  products: Product[];
  warehouses: Warehouse[];
  transfers: Transfer[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  return (
    <div>
      <PageHeader
        title="Transferts"
        subtitle="Distribution du Dépôt Général vers les boutiques, et retours"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <ArrowLeftRight size={16} /> Nouveau transfert
          </button>
        }
      />

      <Card className="p-5">
        <h2 className="font-semibold text-slate-900 mb-3">Historique des transferts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Produit</th>
                <th className="pb-2 font-medium">Depuis</th>
                <th className="pb-2 font-medium">Vers</th>
                <th className="pb-2 font-medium text-right">Quantité</th>
                <th className="pb-2 font-medium">Utilisateur</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 text-slate-500 whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                  <td className="py-2 text-slate-700">{t.product.name}</td>
                  <td className="py-2 text-slate-600">{t.fromWarehouseName}</td>
                  <td className="py-2 text-slate-600">{t.toWarehouseName}</td>
                  <td className="py-2 text-right font-medium whitespace-nowrap">{formatQty(t.quantity, t.product)}</td>
                  <td className="py-2 text-slate-500">{t.user?.name || "—"}</td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Aucun transfert enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau transfert entre dépôts">
        <TransferForm
          products={products}
          warehouses={warehouses}
          onDone={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      </Modal>
    </div>
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
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [fromWarehouseId, setFromWarehouseId] = useState(warehouses[0]?.id || "");
  const [toWarehouseId, setToWarehouseId] = useState(warehouses[1]?.id || warehouses[0]?.id || "");
  const [mode, setMode] = useState<"piece" | "pack">("piece");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedProduct = products.find((p) => p.id === productId);
  const availableQty = selectedProduct?.stocks.find((s) => s.warehouseId === fromWarehouseId)?.quantity || 0;

  function selectProduct(id: string) {
    setProductId(id);
    setMode("piece");
  }

  function submit() {
    setError(null);
    if (!productId || !fromWarehouseId || !toWarehouseId) return setError("Produit et dépôts requis.");
    if (fromWarehouseId === toWarehouseId) return setError("Les dépôts source et destination doivent être différents.");
    if (qty <= 0) return setError("Quantité invalide.");

    const piecesPerPack = mode === "pack" && selectedProduct ? selectedProduct.piecesPerPack : 1;
    const baseQty = qty * piecesPerPack;

    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("fromWarehouseId", fromWarehouseId);
    formData.set("toWarehouseId", toWarehouseId);
    formData.set("quantity", String(baseQty));

    startTransition(async () => {
      const res = await transferStock(undefined, formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div>
        <Label>Produit</Label>
        <Select value={productId} onChange={(e) => selectProduct(e.target.value)}>
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
          <Select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Vers</Label>
          <Select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {selectedProduct && (
        <p className="text-xs text-slate-400 -mt-2">
          Disponible dans le dépôt source : {formatQty(availableQty, selectedProduct)}
        </p>
      )}

      {selectedProduct?.packUnit && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("piece")}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              mode === "piece" ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600"
            }`}
          >
            À l&apos;unité ({selectedProduct.unit?.symbol})
          </button>
          <button
            type="button"
            onClick={() => setMode("pack")}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              mode === "pack" ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600"
            }`}
          >
            Par {selectedProduct.packUnit.symbol} ({selectedProduct.piecesPerPack} {selectedProduct.unit?.symbol})
          </button>
        </div>
      )}

      <div>
        <Label>Quantité{mode === "pack" && selectedProduct?.packUnit ? ` (en ${selectedProduct.packUnit.name.toLowerCase()}s)` : ""}</Label>
        <Input type="number" min={1} step="1" value={qty} onChange={(e) => setQty(Number(e.target.value))} required />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Transfert..." : "Transférer"}
        </button>
      </div>
    </div>
  );
}
