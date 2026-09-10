"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSale } from "@/lib/actions/sales";
import { Card, Select, Badge } from "@/components/ui";
import { formatMoney, formatDateTime, formatDate } from "@/lib/utils";
import { CUSTOMER_TYPE_LABELS, LOYALTY_POINT_VALUE_FCFA } from "@/lib/constants";
import { Search, Trash2, Plus, Minus, Printer, PackagePlus, Star } from "lucide-react";
import type { PaymentMethod, CustomerType } from "@prisma/client";

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  salePrice: number;
  proPrice: number | null;
  wholesalePrice: number | null;
  unit: { symbol: string } | null;
  packUnit: { symbol: string } | null;
  piecesPerPack: number;
  packSalePrice: number | null;
  stocks: { warehouseId: string; quantity: number }[];
};
type Warehouse = { id: string; name: string };
type Customer = {
  id: string;
  name: string;
  phone: string | null;
  type: CustomerType;
  creditBalance: number;
  loyaltyPoints: number;
};

type Line = {
  key: string;
  productId: string;
  name: string;
  mode: "piece" | "pack";
  qty: number;
  unitPrice: number;
  unitLabel: string;
  piecesPerPack: number;
  maxQty: number;
};

type ReceiptData = {
  number: string;
  date: Date;
  cashier: string;
  warehouse: string;
  customer: string;
  items: Line[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  paymentMethod: PaymentMethod;
  dueDate: string | null;
  pointsEarned: number;
  pointsUsed: number;
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  VIREMENT: "Virement",
  CREDIT: "Crédit",
  MIXTE: "Mixte",
};

function priceForCustomer(p: Product, customerType: CustomerType | null) {
  if (customerType === "REVENDEUR" && p.wholesalePrice) return p.wholesalePrice;
  if (customerType === "PROFESSIONNEL" && p.proPrice) return p.proPrice;
  return p.salePrice;
}

export function PosClient({
  products,
  warehouses,
  customers,
  cashierName,
}: {
  products: Product[];
  warehouses: Warehouse[];
  customers: Customer[];
  cashierName: string;
}) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || "");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ESPECES");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [pointsToRedeem, setPointsToRedeem] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const subtotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const maxRedeemablePoints = selectedCustomer
    ? Math.min(Math.floor(selectedCustomer.loyaltyPoints), Math.floor(subtotal / LOYALTY_POINT_VALUE_FCFA))
    : 0;
  const pointsUsedNum = Math.max(0, Math.min(Number(pointsToRedeem) || 0, maxRedeemablePoints));
  const discount = pointsUsedNum * LOYALTY_POINT_VALUE_FCFA;
  const total = subtotal - discount;

  const availableBase = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.id, p.stocks.find((s) => s.warehouseId === warehouseId)?.quantity || 0);
    }
    return map;
  }, [products, warehouseId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      )
      .filter((p) => (availableBase.get(p.id) || 0) > 0);
  }, [products, query, availableBase]);

  function addToCart(p: Product, mode: "piece" | "pack") {
    const baseQty = availableBase.get(p.id) || 0;
    const piecesPerPack = mode === "pack" ? p.piecesPerPack : 1;
    const maxQty = mode === "pack" ? Math.floor(baseQty / p.piecesPerPack) : baseQty;
    if (maxQty <= 0) return;
    const unitPrice =
      mode === "pack" ? p.packSalePrice ?? p.salePrice * p.piecesPerPack : priceForCustomer(p, selectedCustomer?.type ?? null);
    const unitLabel = mode === "pack" ? p.packUnit?.symbol || "lot" : p.unit?.symbol || "";
    const key = `${p.id}:${mode}`;

    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        if (existing.qty >= maxQty) return prev;
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { key, productId: p.id, name: p.name, mode, qty: 1, unitPrice, unitLabel, piecesPerPack, maxQty }];
    });
  }

  function handleCustomerChange(id: string) {
    setCustomerId(id);
    setPointsToRedeem("");
    const type = customers.find((c) => c.id === id)?.type ?? null;
    setCart((prev) =>
      prev.map((l) => {
        if (l.mode !== "piece") return l;
        const product = products.find((p) => p.id === l.productId);
        if (!product) return l;
        return { ...l, unitPrice: priceForCustomer(product, type) };
      })
    );
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: Math.max(0, Math.min(l.maxQty, l.qty + delta)) } : l))
        .filter((l) => l.qty > 0)
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function resetSale() {
    setCart([]);
    setCustomerId("");
    setPaymentMethod("ESPECES");
    setAmountPaid("");
    setDueDate("");
    setPointsToRedeem("");
    setError(null);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const exactBarcode = products.find((p) => p.barcode && p.barcode === q);
    if (exactBarcode && (availableBase.get(exactBarcode.id) || 0) > 0) {
      addToCart(exactBarcode, "piece");
      setQuery("");
      return;
    }
    if (filtered.length === 1) {
      addToCart(filtered[0], "piece");
      setQuery("");
    }
  }

  function handleValidate() {
    setError(null);
    if (cart.length === 0) {
      setError("Le panier est vide.");
      return;
    }
    const paid = paymentMethod === "CREDIT" ? 0 : amountPaid === "" ? total : Number(amountPaid);
    if (paid < total && !customerId) {
      setError("Sélectionnez un client pour une vente à crédit ou un paiement partiel.");
      return;
    }

    const items = cart.map((l) => {
      const baseQty = l.mode === "pack" ? l.qty * l.piecesPerPack : l.qty;
      const baseUnitPrice = (l.qty * l.unitPrice) / baseQty;
      return { productId: l.productId, quantity: baseQty, unitPrice: baseUnitPrice };
    });
    const cartSnapshot = cart;
    const warehouseName = warehouses.find((w) => w.id === warehouseId)?.name || "";
    const customerName = customers.find((c) => c.id === customerId)?.name || "Client comptant";
    const pointsEarned = customerId ? Math.floor(total / 100) : 0;

    startTransition(async () => {
      const res = await createSale({
        warehouseId,
        customerId: customerId || null,
        items,
        paymentMethod,
        amountPaid: paid,
        dueDate: paid < total && dueDate ? dueDate : null,
        pointsToRedeem: pointsUsedNum,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setReceipt({
        number: res.saleNumber!,
        date: new Date(),
        cashier: cashierName,
        warehouse: warehouseName,
        customer: customerName,
        items: cartSnapshot,
        subtotal,
        discount,
        total,
        paid,
        paymentMethod,
        dueDate: paid < total && dueDate ? dueDate : null,
        pointsEarned,
        pointsUsed: pointsUsedNum,
      });
      resetSale();
      router.refresh();
      searchRef.current?.focus();
    });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Rechercher ou scanner un code-barres..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        {selectedCustomer && selectedCustomer.type !== "PARTICULIER" && (
          <p className="text-xs text-blue-600 mb-3">
            Tarif {CUSTOMER_TYPE_LABELS[selectedCustomer.type].toLowerCase()} appliqué automatiquement pour {selectedCustomer.name}.
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const baseQty = availableBase.get(p.id) || 0;
            const packQty = p.packUnit ? Math.floor(baseQty / p.piecesPerPack) : 0;
            const price = priceForCustomer(p, selectedCustomer?.type ?? null);
            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-xl p-3 text-left hover:border-blue-400 hover:shadow-sm transition-all"
              >
                <button onClick={() => addToCart(p, "piece")} className="w-full text-left">
                  <p className="font-medium text-slate-800 text-sm leading-tight mb-1">{p.name}</p>
                  <p className="text-blue-600 font-semibold text-sm">
                    {formatMoney(price)} <span className="text-slate-400 font-normal">/ {p.unit?.symbol}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {baseQty} {p.unit?.symbol} en stock
                  </p>
                </button>
                {p.packUnit && (
                  <button
                    onClick={() => addToCart(p, "pack")}
                    disabled={packQty <= 0}
                    className="mt-2 w-full flex items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium py-1.5 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <PackagePlus size={12} />+ 1 {p.packUnit.symbol} ({formatMoney(p.packSalePrice ?? p.salePrice * p.piecesPerPack)})
                  </button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-slate-400 py-10">
              Aucun produit disponible dans ce dépôt.
            </p>
          )}
        </div>
      </div>

      <div>
        <Card className="p-4 sticky top-4">
          <h2 className="font-semibold text-slate-900 mb-3">Panier</h2>

          {cart.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Aucun article sélectionné.</p>
          ) : (
            <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
              {cart.map((l) => (
                <div key={l.key} className="flex items-center gap-2 text-sm border-b border-slate-50 pb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{l.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatMoney(l.unitPrice)} / {l.unitLabel}
                    </p>
                  </div>
                  <button onClick={() => changeQty(l.key, -1)} className="text-slate-400 hover:text-slate-700">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center font-medium">{l.qty}</span>
                  <button onClick={() => changeQty(l.key, 1)} className="text-slate-400 hover:text-slate-700">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => removeLine(l.key)} className="text-red-400 hover:text-red-600 ml-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 mb-4 space-y-1">
            {discount > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Sous-total</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-amber-600">
                  <span>Réduction ({pointsUsedNum} pts)</span>
                  <span>-{formatMoney(discount)}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)}>
                <option value="">Client comptant (sans compte)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.creditBalance > 0 ? `(doit ${formatMoney(c.creditBalance)})` : ""}
                  </option>
                ))}
              </Select>
              {selectedCustomer && selectedCustomer.creditBalance > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Dette actuelle : {formatMoney(selectedCustomer.creditBalance)}
                </p>
              )}
              {selectedCustomer && selectedCustomer.loyaltyPoints > 0 && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Star size={12} className="fill-amber-400 text-amber-400" /> {selectedCustomer.loyaltyPoints} points
                  disponibles ({formatMoney(selectedCustomer.loyaltyPoints * LOYALTY_POINT_VALUE_FCFA)})
                </p>
              )}
            </div>

            {maxRedeemablePoints > 0 && (
              <div>
                <input
                  type="number"
                  min={0}
                  max={maxRedeemablePoints}
                  step="1"
                  placeholder={`Utiliser des points (max ${maxRedeemablePoints})`}
                  value={pointsToRedeem}
                  onChange={(e) => setPointsToRedeem(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>

            {paymentMethod !== "CREDIT" && (
              <div>
                <input
                  type="number"
                  min={0}
                  step="1"
                  placeholder={`Montant payé (défaut: ${total})`}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {amountPaid !== "" && Number(amountPaid) < total && (
                  <p className="text-xs text-amber-600 mt-1">
                    Reste à payer : {formatMoney(total - Number(amountPaid))} (nécessite un client)
                  </p>
                )}
              </div>
            )}

            {(paymentMethod === "CREDIT" || (amountPaid !== "" && Number(amountPaid) < total)) && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Échéance de paiement (optionnel)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={handleValidate}
              disabled={pending || cart.length === 0}
              className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Validation..." : "Valider la vente"}
            </button>
          </div>
        </Card>
      </div>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReceipt(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <Badge tone="success">Vente enregistrée</Badge>
            <p className="text-lg font-semibold mt-3">Vente n° {receipt.number}</p>
            <p className="text-sm text-slate-500 mt-1">{formatMoney(receipt.total)}</p>
            {receipt.pointsEarned > 0 && (
              <p className="text-xs text-amber-600 mt-1">+{receipt.pointsEarned} points gagnés</p>
            )}
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2 text-sm hover:bg-blue-700"
              >
                <Printer size={14} /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {receipt && (
        <div id="receipt-print" className="hidden">
          <div className="text-center mb-2">
            <p className="font-bold text-sm">OMNYSYNCBASE</p>
            <p className="text-xs">{receipt.warehouse}</p>
          </div>
          <div className="border-t border-dashed border-black my-1" />
          <p className="text-xs">Vente n° {receipt.number}</p>
          <p className="text-xs">{formatDateTime(receipt.date)}</p>
          <p className="text-xs">Caissier : {receipt.cashier}</p>
          <p className="text-xs">Client : {receipt.customer}</p>
          <div className="border-t border-dashed border-black my-1" />
          <table className="w-full text-xs">
            <tbody>
              {receipt.items.map((it) => (
                <tr key={it.key}>
                  <td className="align-top py-0.5">
                    {it.name}
                    <br />
                    {it.qty} {it.unitLabel} × {formatMoney(it.unitPrice)}
                  </td>
                  <td className="align-top text-right py-0.5">{formatMoney(it.qty * it.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-dashed border-black my-1" />
          {receipt.discount > 0 && (
            <>
              <div className="flex justify-between text-xs">
                <span>Sous-total</span>
                <span>{formatMoney(receipt.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Réduction ({receipt.pointsUsed} pts)</span>
                <span>-{formatMoney(receipt.discount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-xs font-bold">
            <span>TOTAL</span>
            <span>{formatMoney(receipt.total)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Payé ({PAYMENT_LABELS[receipt.paymentMethod]})</span>
            <span>{formatMoney(receipt.paid)}</span>
          </div>
          {receipt.paid < receipt.total && (
            <div className="flex justify-between text-xs">
              <span>Reste à payer</span>
              <span>{formatMoney(receipt.total - receipt.paid)}</span>
            </div>
          )}
          {receipt.dueDate && (
            <div className="flex justify-between text-xs">
              <span>Échéance</span>
              <span>{formatDate(receipt.dueDate)}</span>
            </div>
          )}
          {receipt.pointsEarned > 0 && (
            <div className="flex justify-between text-xs">
              <span>Points gagnés</span>
              <span>+{receipt.pointsEarned}</span>
            </div>
          )}
          <div className="border-t border-dashed border-black my-1" />
          <p className="text-center text-xs mt-2">Merci de votre achat !</p>
        </div>
      )}
    </div>
  );
}
