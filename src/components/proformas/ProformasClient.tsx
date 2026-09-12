"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProforma, deleteProforma } from "@/lib/actions/proformas";
import { Card, Modal, Select, Input, Label, Badge, PageHeader } from "@/components/ui";
import { formatMoney, formatDateTime, formatDate } from "@/lib/utils";
import { ProformaDocument, type ProformaDocumentData } from "@/components/proformas/ProformaDocument";
import { Search, Trash2, Plus, Minus, FileText, Printer, Eye } from "lucide-react";
import type { CustomerType } from "@prisma/client";

type Product = {
  id: string;
  name: string;
  salePrice: number;
  proPrice: number | null;
  wholesalePrice: number | null;
  unit: { symbol: string } | null;
};
type Service = { id: string; name: string; price: number; proPrice: number | null };
type Customer = { id: string; name: string; phone: string | null; type: CustomerType };
type ProformaItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { name: string; unit: { symbol: string } | null } | null;
  service: { name: string } | null;
};
type ProformaRow = {
  id: string;
  number: string;
  createdAt: Date;
  validUntil: Date | null;
  totalAmount: number;
  clientName: string | null;
  customer: { name: string; phone: string | null } | null;
  user: { name: string } | null;
  items: ProformaItem[];
};

type Line = {
  key: string;
  kind: "product" | "service";
  productId?: string;
  serviceId?: string;
  name: string;
  unitLabel: string;
  qty: number;
  unitPrice: number;
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

function toDoc(companyName: string, p: ProformaRow): ProformaDocumentData {
  return {
    number: p.number,
    companyName,
    clientName: p.customer?.name || p.clientName || "Client",
    clientPhone: p.customer?.phone || null,
    createdAt: p.createdAt,
    validUntil: p.validUntil,
    totalAmount: p.totalAmount,
    items: p.items,
  };
}

export function ProformasClient({
  products,
  services,
  customers,
  proformas,
  companyName,
}: {
  products: Product[];
  services: Service[];
  customers: Customer[];
  proformas: ProformaRow[];
  companyName: string;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<ProformaRow | null>(null);
  const [printing, setPrinting] = useState<ProformaDocumentData | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return proformas;
    return proformas.filter(
      (p) =>
        p.number.toLowerCase().includes(q) ||
        (p.customer?.name.toLowerCase().includes(q) ?? false) ||
        (p.clientName?.toLowerCase().includes(q) ?? false)
    );
  }, [proformas, query]);

  function handlePrint(doc: ProformaDocumentData) {
    setPrinting(doc);
    setTimeout(() => window.print(), 50);
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer ce devis ? Cette action est définitive.")) return;
    startTransition(async () => {
      await deleteProforma(id);
      router.refresh();
    });
  }

  return (
    <div>
      <PageHeader
        title="Proformas"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <FileText size={16} /> Nouvelle proforma
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <h2 className="font-semibold text-slate-900">
            Devis émis <span className="text-slate-400 font-normal">[ {filtered.length} ]</span>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un devis, un client..."
              className="w-64 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Émis le</th>
                <th className="px-4 py-3 font-medium">Valable jusqu&apos;au</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{p.number}</td>
                  <td className="px-4 py-3 text-slate-600">{p.customer?.name || p.clientName || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.validUntil ? (
                      formatDate(p.validUntil)
                    ) : (
                      <Badge tone="default">Sans échéance</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(p.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-center">
                      <button
                        onClick={() => setViewing(p)}
                        title="Voir le détail"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handlePrint(toDoc(companyName, p))}
                        title="Imprimer"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={pending}
                        title="Supprimer"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-60"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    {proformas.length === 0 ? "Aucun devis pour le moment." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle proforma">
        <ProformaForm
          products={products}
          services={services}
          customers={customers}
          companyName={companyName}
          onDone={() => {
            setShowCreate(false);
            router.refresh();
          }}
          onPrint={handlePrint}
        />
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Devis ${viewing?.number || ""}`}>
        {viewing && (
          <div>
            <ProformaDocument data={toDoc(companyName, viewing)} />
            <button
              onClick={() => handlePrint(toDoc(companyName, viewing))}
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2 text-sm hover:bg-blue-700"
            >
              <Printer size={14} /> Imprimer
            </button>
          </div>
        )}
      </Modal>

      {printing && (
        <div id="receipt-print" className="hidden">
          <ProformaDocument data={printing} />
        </div>
      )}
    </div>
  );
}

function ProformaForm({
  products,
  services,
  customers,
  companyName,
  onDone,
  onPrint,
}: {
  products: Product[];
  services: Service[];
  customers: Customer[];
  companyName: string;
  onDone: () => void;
  onPrint: (doc: ProformaDocumentData) => void;
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const total = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q));
  }, [products, query]);
  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [services, query]);

  function addProduct(p: Product) {
    const unitPrice = priceForCustomer(p, selectedCustomer?.type ?? null);
    const key = `p:${p.id}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key, kind: "product", productId: p.id, name: p.name, unitLabel: p.unit?.symbol || "", qty: 1, unitPrice }];
    });
  }

  function addService(s: Service) {
    const unitPrice = priceForCustomerService(s, selectedCustomer?.type ?? null);
    const key = `s:${s.id}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key, kind: "service", serviceId: s.id, name: s.name, unitLabel: "u", qty: 1, unitPrice }];
    });
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, qty: Math.max(0, l.qty + delta) } : l)).filter((l) => l.qty > 0)
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function handleCustomerChange(id: string) {
    setCustomerId(id);
    const type = customers.find((c) => c.id === id)?.type ?? null;
    setCart((prev) =>
      prev.map((l) => {
        if (l.kind === "service") {
          const service = services.find((s) => s.id === l.serviceId);
          return service ? { ...l, unitPrice: priceForCustomerService(service, type) } : l;
        }
        const product = products.find((p) => p.id === l.productId);
        return product ? { ...l, unitPrice: priceForCustomer(product, type) } : l;
      })
    );
  }

  function submit() {
    setError(null);
    if (cart.length === 0) return setError("Ajoutez au moins un article.");
    if (!customerId && !clientName.trim()) return setError("Indiquez un client (compte existant ou nom).");

    startTransition(async () => {
      const res = await createProforma({
        customerId: customerId || null,
        clientName: clientName || null,
        clientPhone: clientPhone || null,
        validUntil: validUntil || null,
        notes: notes || null,
        items: cart.map((l) => ({ productId: l.productId, serviceId: l.serviceId, quantity: l.qty })),
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onDone();
      onPrint({
        number: res.number!,
        companyName,
        clientName: selectedCustomer?.name || clientName || "Client",
        clientPhone: selectedCustomer?.phone || clientPhone || null,
        createdAt: new Date(),
        validUntil: validUntil ? new Date(validUntil) : null,
        totalAmount: total,
        items: cart.map((l, i) => ({
          id: String(i),
          quantity: l.qty,
          unitPrice: l.unitPrice,
          subtotal: l.qty * l.unitPrice,
          product: l.kind === "product" ? { name: l.name, unit: { symbol: l.unitLabel } } : null,
          service: l.kind === "service" ? { name: l.name } : null,
        })),
      });
    });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit ou une prestation..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          {filteredProducts.map((p) => {
            const price = priceForCustomer(p, selectedCustomer?.type ?? null);
            return (
              <button
                key={p.id}
                onClick={() => addProduct(p)}
                className="bg-white border border-slate-200 rounded-lg p-2.5 text-left hover:border-blue-400 hover:shadow-sm transition-all"
              >
                <p className="font-medium text-slate-800 text-sm leading-tight">{p.name}</p>
                <p className="text-blue-600 font-semibold text-xs">{formatMoney(price)}</p>
              </button>
            );
          })}
          {filteredServices.map((s) => {
            const price = priceForCustomerService(s, selectedCustomer?.type ?? null);
            return (
              <button
                key={s.id}
                onClick={() => addService(s)}
                className="bg-white border border-slate-200 rounded-lg p-2.5 text-left hover:border-blue-400 hover:shadow-sm transition-all"
              >
                <p className="font-medium text-slate-800 text-sm leading-tight">{s.name}</p>
                <p className="text-blue-600 font-semibold text-xs">{formatMoney(price)}</p>
              </button>
            );
          })}
          {filteredProducts.length === 0 && filteredServices.length === 0 && (
            <p className="col-span-full text-center text-slate-400 py-6">Aucun résultat.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-900 mb-2 text-sm">Articles du devis</h3>
        {cart.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Aucun article sélectionné.</p>
        ) : (
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
            {cart.map((l) => (
              <div key={l.key} className="flex items-center gap-2 text-sm border-b border-slate-50 pb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{l.name}</p>
                  <p className="text-xs text-slate-400">{formatMoney(l.unitPrice)}</p>
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

        <div className="flex items-center justify-between text-base font-semibold border-t border-slate-100 pt-2 mb-4">
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Client</Label>
            <Select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)}>
              <option value="">Client ponctuel (sans compte)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          {!customerId && (
            <>
              <div>
                <Label>Nom du client</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: Jean Kouassi" />
              </div>
              <div>
                <Label>Téléphone (optionnel)</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <Label>Valable jusqu&apos;au (optionnel)</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div>
            <Label>Notes (optionnel)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            onClick={submit}
            disabled={pending || cart.length === 0}
            className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Création..." : "Créer le devis"}
          </button>
        </div>
      </div>
    </div>
  );
}
