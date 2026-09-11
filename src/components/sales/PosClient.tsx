"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSale } from "@/lib/actions/sales";
import { Card, Select, Badge } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { CUSTOMER_TYPE_LABELS, LOYALTY_POINT_VALUE_FCFA } from "@/lib/constants";
import { Search, Trash2, Plus, Minus, PackagePlus, Star, Sparkles, ArrowRight } from "lucide-react";
import type { CustomerType } from "@prisma/client";

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
type Service = {
  id: string;
  name: string;
  price: number;
  proPrice: number | null;
  durationMin: number | null;
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

const SERVICE_MAX_QTY = 20;

type Line = {
  key: string;
  kind: "product" | "service";
  productId?: string;
  serviceId?: string;
  name: string;
  mode: "piece" | "pack";
  qty: number;
  unitPrice: number;
  unitLabel: string;
  piecesPerPack: number;
  maxQty: number;
};

function priceForCustomer(p: Product, customerType: CustomerType | null) {
  if (customerType === "REVENDEUR" && p.wholesalePrice) return p.wholesalePrice;
  if (customerType === "PROFESSIONNEL" && p.proPrice) return p.proPrice;
  return p.salePrice;
}

function priceForCustomerService(s: Service, customerType: CustomerType | null) {
  if (customerType === "PROFESSIONNEL" && s.proPrice) return s.proPrice;
  return s.price;
}

export function PosClient({
  products,
  services,
  warehouses,
  customers,
}: {
  products: Product[];
  services: Service[];
  warehouses: Warehouse[];
  customers: Customer[];
}) {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || "");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [pointsToRedeem, setPointsToRedeem] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ number: string; total: number } | null>(null);
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

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [services, query]);

  function addToCart(p: Product, mode: "piece" | "pack") {
    const baseQty = availableBase.get(p.id) || 0;
    const piecesPerPack = mode === "pack" ? p.piecesPerPack : 1;
    const maxQty = mode === "pack" ? Math.floor(baseQty / p.piecesPerPack) : baseQty;
    if (maxQty <= 0) return;
    const unitPrice =
      mode === "pack" ? p.packSalePrice ?? p.salePrice * p.piecesPerPack : priceForCustomer(p, selectedCustomer?.type ?? null);
    const unitLabel = mode === "pack" ? p.packUnit?.symbol || "lot" : p.unit?.symbol || "";
    const key = `p:${p.id}:${mode}`;

    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        if (existing.qty >= maxQty) return prev;
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        { key, kind: "product", productId: p.id, name: p.name, mode, qty: 1, unitPrice, unitLabel, piecesPerPack, maxQty },
      ];
    });
  }

  function addServiceToCart(s: Service) {
    const unitPrice = priceForCustomerService(s, selectedCustomer?.type ?? null);
    const key = `s:${s.id}`;

    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        if (existing.qty >= SERVICE_MAX_QTY) return prev;
        return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          key,
          kind: "service",
          serviceId: s.id,
          name: s.name,
          mode: "piece",
          qty: 1,
          unitPrice,
          unitLabel: "u",
          piecesPerPack: 1,
          maxQty: SERVICE_MAX_QTY,
        },
      ];
    });
  }

  function handleCustomerChange(id: string) {
    setCustomerId(id);
    setPointsToRedeem("");
    const type = customers.find((c) => c.id === id)?.type ?? null;
    setCart((prev) =>
      prev.map((l) => {
        if (l.kind === "service") {
          const service = services.find((s) => s.id === l.serviceId);
          if (!service) return l;
          return { ...l, unitPrice: priceForCustomerService(service, type) };
        }
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
    if (filtered.length === 1 && filteredServices.length === 0) {
      addToCart(filtered[0], "piece");
      setQuery("");
    } else if (filteredServices.length === 1 && filtered.length === 0) {
      addServiceToCart(filteredServices[0]);
      setQuery("");
    }
  }

  function handleSubmit() {
    setError(null);
    if (cart.length === 0) {
      setError("Le panier est vide.");
      return;
    }

    const items = cart.map((l) => {
      if (l.kind === "service") {
        return { serviceId: l.serviceId, quantity: l.qty, unitPrice: l.unitPrice };
      }
      const baseQty = l.mode === "pack" ? l.qty * l.piecesPerPack : l.qty;
      const baseUnitPrice = (l.qty * l.unitPrice) / baseQty;
      return { productId: l.productId, quantity: baseQty, unitPrice: baseUnitPrice };
    });

    startTransition(async () => {
      const res = await createSale({
        warehouseId,
        customerId: customerId || null,
        items,
        pointsToRedeem: pointsUsedNum,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setConfirmation({ number: res.saleNumber!, total });
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
              placeholder="Rechercher un produit, une prestation, ou scanner un code-barres..."
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

        {products.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
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
              <p className="col-span-full text-center text-slate-400 py-6">
                Aucun produit disponible dans ce dépôt.
              </p>
            )}
          </div>
        )}

        {services.length > 0 && (
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 mb-3">
              <Sparkles size={14} /> Prestations
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredServices.map((s) => {
                const price = priceForCustomerService(s, selectedCustomer?.type ?? null);
                return (
                  <button
                    key={s.id}
                    onClick={() => addServiceToCart(s)}
                    className="bg-white border border-slate-200 rounded-xl p-3 text-left hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <p className="font-medium text-slate-800 text-sm leading-tight mb-1">{s.name}</p>
                    <p className="text-blue-600 font-semibold text-sm">{formatMoney(price)}</p>
                    {s.durationMin && <p className="text-xs text-slate-400 mt-1">{s.durationMin} min</p>}
                  </button>
                );
              })}
              {filteredServices.length === 0 && (
                <p className="col-span-full text-center text-slate-400 py-6">Aucune prestation trouvée.</p>
              )}
            </div>
          </div>
        )}
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
                    <p className="font-medium text-slate-800 truncate flex items-center gap-1">
                      {l.kind === "service" && <Sparkles size={11} className="text-blue-500 shrink-0" />}
                      {l.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatMoney(l.unitPrice)} {l.kind === "product" ? `/ ${l.unitLabel}` : ""}
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

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={pending || cart.length === 0}
              className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Enregistrement..." : "Enregistrer la vente"}
            </button>
            <p className="text-xs text-slate-400 text-center">
              Le paiement sera encaissé séparément depuis la Caisse.
            </p>
          </div>
        </Card>
      </div>

      {confirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmation(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <Badge tone="warning">En attente de paiement</Badge>
            <p className="text-lg font-semibold mt-3">Vente n° {confirmation.number}</p>
            <p className="text-sm text-slate-500 mt-1">{formatMoney(confirmation.total)}</p>
            <p className="text-xs text-slate-400 mt-2">
              Cette vente attend d&apos;être encaissée à la Caisse.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setConfirmation(null)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Nouvelle vente
              </button>
              <Link
                href="/caisse-ventes"
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2 text-sm hover:bg-blue-700"
              >
                Aller à la caisse <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
