"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateSale } from "@/lib/actions/sales";
import { openCashSession } from "@/lib/actions/cash";
import { CashClosingForm } from "@/components/cash/CashClosingForm";
import { Card, Modal, PageHeader, Select, Input, Label, FormError, SubmitButton } from "@/components/ui";
import { DateRangePicker } from "@/components/DateRangePicker";
import { SaleStatusBadge } from "@/components/sales/SaleStatusBadge";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { PAYMENT_LABELS } from "@/lib/constants";
import { ReceiptDocument, buildReceiptData, packAwareQtyLabel, type ReceiptData } from "@/components/sales/ReceiptDocument";
import { Eye, Wallet, Printer, Search, Lock, Unlock } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";

type SaleItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: {
    name: string;
    unit: { symbol: string } | null;
    packUnit: { symbol: string } | null;
    piecesPerPack: number;
  } | null;
  service: { name: string } | null;
};
type SaleRow = {
  id: string;
  number: string;
  date: Date;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  dueDate: Date | null;
  pointsEarned: number;
  pointsUsed: number;
  status: string;
  customerId: string | null;
  customer: { name: string; creditBalance: number } | null;
  warehouseId: string;
  warehouse: { name: string; address: string | null };
  user: { name: string } | null;
  validatedAt: Date | null;
  validatedBy: { name: string } | null;
  items: SaleItem[];
  payments: { amount: number; cashReceived: number | null; changeGiven: number | null }[];
};

type Warehouse = { id: string; name: string };
type OpenSession = {
  id: string;
  warehouseId: string;
  openingAmount: number;
  openedAt: Date;
  warehouse: { name: string };
};
export function CaisseValidationClient({
  pending,
  validated,
  from,
  to,
  warehouses,
  openSessions,
  companyName,
}: {
  pending: SaleRow[];
  validated: SaleRow[];
  from: string;
  to: string;
  warehouses: Warehouse[];
  openSessions: OpenSession[];
  companyName: string;
}) {
  const [viewing, setViewing] = useState<SaleRow | null>(null);
  const [validating, setValidating] = useState<SaleRow | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const openWarehouseIds = useMemo(() => new Set(openSessions.map((s) => s.warehouseId)), [openSessions]);

  // Un seul ticket, en attente ou déjà validé : pas deux listes séparées,
  // le statut de chaque ligne suffit à distinguer.
  const allSales = useMemo(() => {
    return [...pending, ...validated].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [pending, validated]);

  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSales;
    return allSales.filter(
      (s) => s.number.toLowerCase().includes(q) || (s.customer?.name.toLowerCase().includes(q) ?? false)
    );
  }, [allSales, query]);

  return (
    <div>
      <PageHeader title="Caisse" />

      <CashSessionBar warehouses={warehouses} openSessions={openSessions} />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Tickets <span className="text-slate-400 font-normal">[ {filteredSales.length} ]</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Les tickets en attente restent toujours visibles ; la période ne filtre que l&apos;historique validé.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-56 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <DateRangePicker from={from} to={to} onApply={(f, t) => router.push(`/caisse-ventes?from=${f}&to=${t}`)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Boutique</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => {
                const isPendingRow = s.status === "EN_ATTENTE";
                return (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-700">{s.number}</td>
                    <td className="px-4 py-3 text-slate-600">{s.customer?.name || "Client comptant"}</td>
                    <td className="px-4 py-3 text-slate-600">{s.warehouse.name}</td>
                    <td className="px-4 py-3">
                      <SaleStatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(s.date)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(s.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-center">
                        <button
                          onClick={() => setViewing(s)}
                          title="Voir le détail"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        >
                          <Eye size={16} />
                        </button>
                        {isPendingRow && (
                          <>
                            {openWarehouseIds.has(s.warehouseId) ? (
                              <button
                                onClick={() => setValidating(s)}
                                title="Encaisser"
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                              >
                                <Wallet size={14} /> Encaisser
                              </button>
                            ) : (
                              <span
                                title={`Ouvrez votre caisse pour ${s.warehouse.name} avant d'encaisser`}
                                className="flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-400 px-3 py-1.5 text-xs font-medium cursor-not-allowed"
                              >
                                <Lock size={14} /> Caisse fermée
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {allSales.length === 0 ? "Aucun ticket pour le moment." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`Vente ${viewing?.number || ""}`}>
        {viewing && (
          <div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div>
                <p className="text-slate-400">Date</p>
                <p className="font-medium">{formatDateTime(viewing.date)}</p>
              </div>
              <div>
                <p className="text-slate-400">Client</p>
                <p className="font-medium">{viewing.customer?.name || "Client comptant"}</p>
              </div>
              <div>
                <p className="text-slate-400">Boutique</p>
                <p className="font-medium">{viewing.warehouse.name}</p>
              </div>
              <div>
                <p className="text-slate-400">Saisie par</p>
                <p className="font-medium">{viewing.user?.name || "—"}</p>
              </div>
              {viewing.validatedAt && (
                <>
                  <div>
                    <p className="text-slate-400">Validée le</p>
                    <p className="font-medium">{formatDateTime(viewing.validatedAt)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Validée par</p>
                    <p className="font-medium">{viewing.validatedBy?.name || "—"}</p>
                  </div>
                </>
              )}
            </div>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Produit / Prestation</th>
                  <th className="pb-2 font-medium text-right">Qté</th>
                  <th className="pb-2 font-medium text-right">P.U.</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewing.items.map((it) => {
                  const isPack = it.product?.packUnit && it.product.piecesPerPack > 0 && it.quantity % it.product.piecesPerPack === 0;
                  const unitPrice = isPack ? it.unitPrice * it.product!.piecesPerPack : it.unitPrice;
                  return (
                    <tr key={it.id} className="border-b border-slate-50">
                      <td className="py-1.5">{it.product?.name ?? it.service?.name ?? "—"}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">{packAwareQtyLabel(it.quantity, it.product)}</td>
                      <td className="py-1.5 text-right">{formatMoney(unitPrice)}</td>
                      <td className="py-1.5 text-right font-medium">{formatMoney(it.subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex justify-between text-base font-semibold border-t border-slate-100 pt-2">
              <span>Total</span>
              <span>{formatMoney(viewing.totalAmount)}</span>
            </div>
            {viewing.status !== "EN_ATTENTE" && (
              <button
                onClick={() => {
                  setReceipt(buildReceiptData(viewing, companyName));
                  setViewing(null);
                }}
                className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2 text-sm hover:bg-blue-700"
              >
                <Printer size={14} /> Imprimer le reçu
              </button>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!validating} onClose={() => setValidating(null)} title={`Encaisser — ${validating?.number || ""}`}>
        {validating && (
          <ValidateForm
            sale={validating}
            companyName={companyName}
            onDone={() => setValidating(null)}
            onReceipt={(r) => setReceipt(r)}
          />
        )}
      </Modal>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReceipt(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <ReceiptDocument data={receipt} />
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
          <ReceiptDocument data={receipt} />
        </div>
      )}
    </div>
  );
}

function CashSessionBar({ warehouses, openSessions }: { warehouses: Warehouse[]; openSessions: OpenSession[] }) {
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState<OpenSession | null>(null);
  const availableWarehouses = warehouses.filter((w) => !openSessions.some((s) => s.warehouseId === w.id));

  return (
    <Card className="p-4 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700 mr-1">Votre caisse :</span>
        {openSessions.length === 0 && (
          <span className="text-sm text-slate-400">Aucune caisse ouverte — encaissement bloqué</span>
        )}
        {openSessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 pl-3 pr-1.5 py-1 text-xs font-medium text-emerald-700"
          >
            <Unlock size={12} />
            {s.warehouse.name}
            <span className="font-normal text-emerald-500">depuis {formatDateTime(s.openedAt)}</span>
            <button
              onClick={() => setClosing(s)}
              className="ml-1 rounded-full bg-white/70 hover:bg-white text-emerald-700 px-2 py-0.5 text-[11px] font-semibold"
            >
              Fermer
            </button>
          </div>
        ))}
        {availableWarehouses.length > 0 && (
          <button
            onClick={() => setOpening(true)}
            className="flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 text-xs font-medium hover:bg-blue-100"
          >
            <Unlock size={12} /> Ouvrir une caisse
          </button>
        )}
      </div>

      <Modal open={opening} onClose={() => setOpening(false)} title="Ouvrir une caisse">
        <OpenSessionForm warehouses={availableWarehouses} onDone={() => setOpening(false)} />
      </Modal>

      <Modal open={!!closing} onClose={() => setClosing(null)} title={`Fermer la caisse — ${closing?.warehouse.name || ""}`}>
        {closing && <CloseSessionForm session={closing} onDone={() => setClosing(null)} />}
      </Modal>
    </Card>
  );
}

function OpenSessionForm({ warehouses, onDone }: { warehouses: Warehouse[]; onDone: () => void }) {
  const [state, formAction] = useActionState(openCashSession, undefined as { error?: string; success?: boolean } | undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      onDone();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success]);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
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
        <Label>Fond de caisse initial</Label>
        <Input type="number" name="openingAmount" min={0} step="1" defaultValue={0} required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Ouvrir la caisse</SubmitButton>
      </div>
    </form>
  );
}

function CloseSessionForm({ session, onDone }: { session: OpenSession; onDone: () => void }) {
  const router = useRouter();
  return (
    <CashClosingForm
      session={session}
      onClosed={() => {
        router.refresh();
        onDone();
      }}
    />
  );
}

function ValidateForm({
  sale,
  companyName,
  onDone,
  onReceipt,
}: {
  sale: SaleRow;
  companyName: string;
  onDone: () => void;
  onReceipt: (r: ReceiptData) => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("ESPECES");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const total = sale.totalAmount;
  // "Montant reçu" = ce que le client remet physiquement (peut dépasser le
  // total en espèces) ; "paid" = ce qui est effectivement appliqué à la vente,
  // jamais plus que le total — l'excédent est de la monnaie à rendre.
  const received = paymentMethod === "CREDIT" ? 0 : amountPaid === "" ? total : Number(amountPaid);
  const paid = Math.min(received, total);
  const changeDue = paymentMethod === "ESPECES" ? Math.max(0, received - total) : 0;

  function submit() {
    setError(null);
    if (paid < total && !sale.customerId) {
      setError("Cette vente n'a pas de client : impossible de l'encaisser partiellement ou à crédit.");
      return;
    }
    startTransition(async () => {
      const res = await validateSale({
        saleId: sale.id,
        paymentMethod,
        amountReceived: received,
        dueDate: paid < total && dueDate ? dueDate : null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onReceipt({
        number: sale.number,
        companyName,
        warehouse: sale.warehouse.name,
        warehouseAddress: sale.warehouse.address,
        customer: sale.customer?.name || "Client comptant",
        items: sale.items,
        total,
        paid,
        received,
        changeGiven: res.changeGiven ?? changeDue,
        paymentMethod,
        dueDate: paid < total && dueDate ? dueDate : null,
        pointsEarned: sale.pointsEarned,
        issuedAt: new Date(),
      });
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="text-sm bg-slate-50 rounded-lg p-3">
        <div className="flex justify-between">
          <span className="text-slate-500">Client</span>
          <span className="font-medium">{sale.customer?.name || "Client comptant"}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-slate-500">Total à encaisser</span>
          <span className="font-semibold">{formatMoney(total)}</span>
        </div>
      </div>

      <div>
        <Label>Mode de paiement</Label>
        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      {paymentMethod !== "CREDIT" && (
        <div>
          <Label>{paymentMethod === "ESPECES" ? "Montant reçu du client" : "Montant payé"}</Label>
          <Input
            type="number"
            min={0}
            step="1"
            placeholder={`Défaut : ${total}`}
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
          />
          {amountPaid !== "" && Number(amountPaid) < total && (
            <p className="text-xs text-amber-600 mt-1">
              Reste à payer : {formatMoney(total - Number(amountPaid))} (nécessite un client)
            </p>
          )}
          {changeDue > 0 && (
            <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-2">
              Monnaie à rendre au client : {formatMoney(changeDue)}
            </p>
          )}
        </div>
      )}

      {(paymentMethod === "CREDIT" || (amountPaid !== "" && Number(amountPaid) < total)) && (
        <div>
          <Label>Échéance de paiement (optionnel)</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Encaissement..." : "Valider le paiement"}
        </button>
      </div>
    </div>
  );
}
