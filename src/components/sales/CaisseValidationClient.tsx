"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { validateSale, cancelSale } from "@/lib/actions/sales";
import { Card, Modal, PageHeader, Select, Input, Label } from "@/components/ui";
import { SaleStatusBadge } from "@/components/sales/SaleStatusBadge";
import { formatMoney, formatDateTime, formatDate } from "@/lib/utils";
import { PAYMENT_LABELS } from "@/lib/constants";
import { Eye, Wallet, Ban, Printer, Search } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";

type SaleItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { name: string } | null;
  service: { name: string } | null;
};
type SaleRow = {
  id: string;
  number: string;
  date: Date;
  totalAmount: number;
  pointsEarned: number;
  pointsUsed: number;
  status: string;
  customerId: string | null;
  customer: { name: string; creditBalance: number } | null;
  warehouse: { name: string };
  user: { name: string } | null;
  validatedAt: Date | null;
  validatedBy: { name: string } | null;
  items: SaleItem[];
};
type ReceiptData = {
  number: string;
  warehouse: string;
  customer: string;
  items: SaleItem[];
  total: number;
  paid: number;
  paymentMethod: PaymentMethod;
  dueDate: string | null;
  pointsEarned: number;
};

export function CaisseValidationClient({
  pending,
  validated,
}: {
  pending: SaleRow[];
  validated: SaleRow[];
}) {
  const [viewing, setViewing] = useState<SaleRow | null>(null);
  const [validating, setValidating] = useState<SaleRow | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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

  function handleCancel(id: string) {
    if (!confirm("Annuler cette vente en attente ? Elle ne sera ni encaissée ni livrée.")) return;
    startTransition(async () => {
      await cancelSale(id);
      router.refresh();
      setViewing(null);
    });
  }

  return (
    <div>
      <PageHeader title="Caisse" subtitle="Validez le paiement des ventes saisies — la caisse ne fait qu'encaisser" />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4">
          <div>
            <h2 className="font-semibold text-slate-900">
              Tickets <span className="text-slate-400 font-normal">[ {filteredSales.length} ]</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Le stock n&apos;est décrémenté qu&apos;au moment de l&apos;encaissement d&apos;un ticket en attente.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-56 rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
                            <button
                              onClick={() => handleCancel(s.id)}
                              disabled={isPending}
                              title="Annuler"
                              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-red-600 disabled:opacity-60"
                            >
                              <Ban size={16} />
                            </button>
                            <button
                              onClick={() => setValidating(s)}
                              disabled={isPending}
                              title="Encaisser"
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                            >
                              <Wallet size={14} /> Encaisser
                            </button>
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
                {viewing.items.map((it) => (
                  <tr key={it.id} className="border-b border-slate-50">
                    <td className="py-1.5">{it.product?.name ?? it.service?.name ?? "—"}</td>
                    <td className="py-1.5 text-right">{it.quantity}</td>
                    <td className="py-1.5 text-right">{formatMoney(it.unitPrice)}</td>
                    <td className="py-1.5 text-right font-medium">{formatMoney(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between text-base font-semibold border-t border-slate-100 pt-2">
              <span>Total</span>
              <span>{formatMoney(viewing.totalAmount)}</span>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!validating} onClose={() => setValidating(null)} title={`Encaisser — ${validating?.number || ""}`}>
        {validating && (
          <ValidateForm
            sale={validating}
            onDone={() => setValidating(null)}
            onReceipt={(r) => setReceipt(r)}
          />
        )}
      </Modal>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReceipt(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <p className="text-lg font-semibold">Vente n° {receipt.number} encaissée</p>
            <p className="text-sm text-slate-500 mt-1">
              {formatMoney(receipt.paid)} ({PAYMENT_LABELS[receipt.paymentMethod]})
            </p>
            {receipt.paid < receipt.total && (
              <p className="text-xs text-amber-600 mt-1">
                Reste à payer : {formatMoney(receipt.total - receipt.paid)}
              </p>
            )}
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
            <p className="font-bold text-sm">{receipt.warehouse}</p>
          </div>
          <div className="border-t border-dashed border-black my-1" />
          <p className="text-xs">Vente n° {receipt.number}</p>
          <p className="text-xs">Client : {receipt.customer}</p>
          <div className="border-t border-dashed border-black my-1" />
          <table className="w-full text-xs">
            <tbody>
              {receipt.items.map((it) => (
                <tr key={it.id}>
                  <td className="align-top py-0.5">
                    {it.product?.name ?? it.service?.name}
                    <br />
                    {it.quantity} × {formatMoney(it.unitPrice)}
                  </td>
                  <td className="align-top text-right py-0.5">{formatMoney(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-dashed border-black my-1" />
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

function ValidateForm({
  sale,
  onDone,
  onReceipt,
}: {
  sale: SaleRow;
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
  const paid = paymentMethod === "CREDIT" ? 0 : amountPaid === "" ? total : Number(amountPaid);

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
        amountPaid: paid,
        dueDate: paid < total && dueDate ? dueDate : null,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onReceipt({
        number: sale.number,
        warehouse: sale.warehouse.name,
        customer: sale.customer?.name || "Client comptant",
        items: sale.items,
        total,
        paid,
        paymentMethod,
        dueDate: paid < total && dueDate ? dueDate : null,
        pointsEarned: sale.pointsEarned,
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
          <Label>Montant payé</Label>
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
