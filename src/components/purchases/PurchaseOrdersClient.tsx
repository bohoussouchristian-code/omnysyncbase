"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchase, type PurchaseCartItem } from "@/lib/actions/purchases";
import { Modal, Select, Input, Label, Badge, PageHeader, Card } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Plus, Trash2, Eye } from "lucide-react";

type Product = {
  id: string;
  name: string;
  purchasePrice: number;
  unit: { symbol: string } | null;
  packUnit: { symbol: string } | null;
  piecesPerPack: number;
  packPurchasePrice: number | null;
};
type Supplier = { id: string; name: string };
type Purchase = {
  id: string;
  number: string;
  date: Date;
  status: string;
  totalAmount: number;
  paidAmount: number;
  receivedAt: Date | null;
  supplier: { name: string };
  warehouse: { name: string };
  receivedBy: { name: string } | null;
  items: { id: string; quantity: number; unitPrice: number; product: { name: string } }[];
};

export function PurchaseOrdersClient({
  purchases,
  products,
  suppliers,
  generalWarehouseName,
}: {
  purchases: Purchase[];
  products: Product[];
  suppliers: Supplier[];
  generalWarehouseName: string | null;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [viewing, setViewing] = useState<Purchase | null>(null);
  const router = useRouter();

  return (
    <div>
      <PageHeader
        title="Bons de commande"
        subtitle={
          generalWarehouseName
            ? `Dépôt Général : ${generalWarehouseName}`
            : "Aucun Dépôt Général désigné — voir Dépôts / Boutiques"
        }
        action={
          <button
            onClick={() => setShowCreate(true)}
            disabled={!generalWarehouseName}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={16} /> Nouveau bon de commande
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Fournisseur</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    <div className="flex items-center gap-1.5">
                      {p.number}
                      <CopyButton text={p.number} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(p.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{p.supplier.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.status === "RECUE" ? "success" : p.status === "ANNULEE" ? "danger" : "warning"}>
                      {p.status === "EN_ATTENTE" ? "En attente de livraison" : p.status === "RECUE" ? "Validée" : p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(p.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setViewing(p)} className="text-slate-400 hover:text-blue-600 float-right">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucun bon de commande enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau bon de commande">
        <PurchaseForm
          products={products}
          suppliers={suppliers}
          generalWarehouseName={generalWarehouseName}
          onDone={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Commande ${viewing?.number || ""}`}>
        {viewing && (
          <div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Produit</th>
                  <th className="pb-2 font-medium text-right">Qté</th>
                  <th className="pb-2 font-medium text-right">P.U.</th>
                </tr>
              </thead>
              <tbody>
                {viewing.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-50">
                    <td className="py-1.5">{it.product.name}</td>
                    <td className="py-1.5 text-right">{it.quantity}</td>
                    <td className="py-1.5 text-right">{formatMoney(it.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between font-semibold mb-4">
              <span>Total</span>
              <span>{formatMoney(viewing.totalAmount)}</span>
            </div>
            {viewing.status === "EN_ATTENTE" && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                En attente de livraison — réceptionnez-la depuis Bons de livraison.
              </p>
            )}
            {viewing.status === "RECUE" && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                Reçue le {viewing.receivedAt ? formatDateTime(viewing.receivedAt) : "—"}
                {viewing.receivedBy ? ` par ${viewing.receivedBy.name}` : ""} — {viewing.warehouse.name}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function PurchaseForm({
  products,
  suppliers,
  generalWarehouseName,
  onDone,
}: {
  products: Product[];
  suppliers: Supplier[];
  generalWarehouseName: string | null;
  onDone: () => void;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [items, setItems] = useState<PurchaseCartItem[]>([]);
  const [itemLabels, setItemLabels] = useState<Record<string, string>>({});
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [mode, setMode] = useState<"piece" | "pack">("piece");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(products[0]?.purchasePrice || 0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedProduct = products.find((p) => p.id === productId);
  const total = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  function selectProduct(id: string) {
    setProductId(id);
    const p = products.find((pp) => pp.id === id);
    setMode("piece");
    setPrice(p?.purchasePrice || 0);
  }

  function selectMode(m: "piece" | "pack") {
    setMode(m);
    const p = selectedProduct;
    if (!p) return;
    setPrice(m === "pack" ? p.packPurchasePrice ?? p.purchasePrice * p.piecesPerPack : p.purchasePrice);
  }

  function addItem() {
    if (!productId || qty <= 0) return;
    const p = products.find((pp) => pp.id === productId);
    const piecesPerPack = mode === "pack" && p ? p.piecesPerPack : 1;
    const baseQty = qty * piecesPerPack;
    const baseUnitPrice = price / piecesPerPack;
    const label = mode === "pack" && p?.packUnit ? p.packUnit.symbol : p?.unit?.symbol || "unité";

    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + baseQty, unitPrice: baseUnitPrice } : i
        );
      }
      return [...prev, { productId, quantity: baseQty, unitPrice: baseUnitPrice }];
    });
    const newLabel = `${qty} ${label}${qty > 1 ? "s" : ""}`;
    setItemLabels((prev) => ({
      ...prev,
      [productId]: prev[productId] ? `${prev[productId]} + ${newLabel}` : newLabel,
    }));
    setQty(1);
  }

  function removeItem(pid: string) {
    setItems((prev) => prev.filter((i) => i.productId !== pid));
    setItemLabels((prev) => {
      const rest = { ...prev };
      delete rest[pid];
      return rest;
    });
  }

  function submit() {
    setError(null);
    if (!supplierId) return setError("Fournisseur requis.");
    if (items.length === 0) return setError("Ajoutez au moins un article.");

    startTransition(async () => {
      const res = await createPurchase({ supplierId, items, amountPaid, notes: undefined });
      if (res.error) {
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
        <Label>Fournisseur</Label>
        <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-slate-400 -mt-2">
        Dépôt de réception : <span className="font-medium text-slate-600">{generalWarehouseName}</span> (Dépôt Général)
      </p>

      <div className="border border-slate-200 rounded-lg p-3">
        <p className="text-sm font-medium text-slate-700 mb-2">Ajouter un article</p>
        <div className="mb-2">
          <Select value={productId} onChange={(e) => selectProduct(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        {selectedProduct?.packUnit && (
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => selectMode("piece")}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                mode === "piece" ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600"
              }`}
            >
              À l&apos;unité ({selectedProduct.unit?.symbol})
            </button>
            <button
              type="button"
              onClick={() => selectMode("pack")}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                mode === "pack" ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600"
              }`}
            >
              Par {selectedProduct.packUnit.symbol} ({selectedProduct.piecesPerPack} {selectedProduct.unit?.symbol})
            </button>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 items-end">
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} placeholder="Qté" />
          <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} placeholder="P.U." />
          <button onClick={addItem} type="button" className="rounded-lg bg-slate-800 text-white text-sm py-2 hover:bg-slate-900">
            Ajouter
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((i) => {
            const p = products.find((pp) => pp.id === i.productId);
            return (
              <div key={i.productId} className="flex items-center justify-between text-sm border-b border-slate-50 pb-1">
                <span>
                  {p?.name} × {itemLabels[i.productId] || `${i.quantity} ${p?.unit?.symbol || ""}`}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatMoney(i.quantity * i.unitPrice)}</span>
                  <button onClick={() => removeItem(i.productId)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="flex justify-between font-semibold pt-2">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
      )}

      <div>
        <Label>Montant payé au fournisseur (optionnel)</Label>
        <Input type="number" min={0} max={total} value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} />
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
          {pending ? "Enregistrement..." : "Créer le bon de commande"}
        </button>
      </div>
    </div>
  );
}
