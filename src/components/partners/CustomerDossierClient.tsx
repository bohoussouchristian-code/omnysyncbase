"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, PageHeader, StatCard, Badge, Modal, Input, Label, Select, SubmitButton, FormError } from "@/components/ui";
import { formatMoney, formatDate, formatDateTime } from "@/lib/utils";
import { CUSTOMER_TYPE_LABELS, PAYMENT_LABELS } from "@/lib/constants";
import { ArrowLeft, User, Phone, MapPin, Wallet, Printer } from "lucide-react";
import type { CustomerType, SaleStatus } from "@prisma/client";
import { recordCustomerPayment } from "@/lib/actions/partners";
import {
  DebtPaymentReceiptDocument,
  type DebtPaymentReceiptData,
} from "@/components/partners/DebtPaymentReceiptDocument";

type Customer = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  type: CustomerType;
  creditBalance: number;
  creditLimit: number;
  loyaltyPoints: number;
};

type Sale = {
  id: string;
  number: string;
  date: Date;
  totalAmount: number;
  paidAmount: number;
  status: SaleStatus;
  warehouse: { name: string };
};

type Payment = {
  id: string;
  amount: number;
  date: Date;
  type: string;
  sale: { number: string; status: SaleStatus } | null;
};

type Proforma = {
  id: string;
  number: string;
  totalAmount: number;
  createdAt: Date;
  validUntil: Date | null;
};

// Une vente qui n'a jamais été validée en caisse (EN_ATTENTE) ou annulée
// (ANNULEE) n'a aucune réalité financière — elle n'apparaît pas dans le
// grand livre du client, seulement dans la liste brute des ventes.
const LEDGER_SALE_STATUSES: readonly SaleStatus[] = ["PAYEE", "PARTIELLE", "CREDIT"];

type LedgerRow = {
  date: Date;
  label: string;
  reference: string;
  debit: number;
  credit: number;
  payment: Payment | null;
};

export function CustomerDossierClient({
  customer,
  sales,
  payments,
  proformas,
  companyName,
  userName,
}: {
  customer: Customer;
  sales: Sale[];
  payments: Payment[];
  proformas: Proforma[];
  canManage: boolean;
  companyName: string;
  userName: string;
}) {
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<DebtPaymentReceiptData | null>(null);
  const totalPurchased = sales
    .filter((s) => LEDGER_SALE_STATUSES.includes(s.status))
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const rows: LedgerRow[] = [
    ...sales
      .filter((s) => LEDGER_SALE_STATUSES.includes(s.status))
      .map((s) => ({
        date: s.date,
        label: `Vente — ${s.warehouse.name}`,
        reference: s.number,
        debit: s.totalAmount,
        credit: 0,
        payment: null as Payment | null,
      })),
    ...payments.map((p) => ({
      date: p.date,
      label: p.type === "DETTE_CLIENT" ? "Paiement de dette" : "Paiement à la vente",
      reference: p.sale ? p.sale.number : p.id.slice(-8).toUpperCase(),
      debit: 0,
      credit: p.amount,
      payment: p.type === "DETTE_CLIENT" ? p : null,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const ledger = rows
    .reduce<(LedgerRow & { balance: number })[]>((acc, r) => {
      const previousBalance = acc.length > 0 ? acc[acc.length - 1].balance : 0;
      acc.push({ ...r, balance: previousBalance + r.debit - r.credit });
      return acc;
    }, [])
    .reverse();

  return (
    <div>
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3"
      >
        <ArrowLeft size={14} /> Retour aux clients
      </Link>

      <PageHeader
        title={customer.name}
        subtitle={customer.code ?? undefined}
        action={
          <div className="flex items-center gap-3">
            <Badge tone="default">{CUSTOMER_TYPE_LABELS[customer.type]}</Badge>
            {customer.creditBalance > 0 && (
              <button
                onClick={() => setPaying(true)}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
              >
                <Wallet size={16} /> Payer sa dette
              </button>
            )}
          </div>
        }
      />

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <User size={14} className="text-slate-400" /> {customer.code ?? "—"}
          </span>
          {customer.phone && (
            <span className="flex items-center gap-1.5">
              <Phone size={14} className="text-slate-400" /> {customer.phone}
            </span>
          )}
          {customer.address && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400" /> {customer.address}
            </span>
          )}
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total acheté" value={formatMoney(totalPurchased)} />
        <StatCard label="Total payé" value={formatMoney(totalPaid)} tone="success" />
        <StatCard
          label="Solde (créance)"
          value={formatMoney(customer.creditBalance)}
          tone={customer.creditBalance > 0 ? "danger" : "default"}
          hint={customer.creditLimit > 0 ? `Limite : ${formatMoney(customer.creditLimit)}` : undefined}
        />
        <StatCard label="Points fidélité" value={String(Math.floor(customer.loyaltyPoints))} />
      </div>

      <Card className="overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Historique du compte</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Chaque vente à crédit augmente le solde ; chaque paiement le réduit.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Opération</th>
                <th className="px-4 py-2.5 font-medium">Référence</th>
                <th className="px-4 py-2.5 font-medium text-right">Débit</th>
                <th className="px-4 py-2.5 font-medium text-right">Crédit</th>
                <th className="px-4 py-2.5 font-medium text-right">Solde</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-600">{formatDateTime(r.date)}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.label}</td>
                  <td className="px-4 py-2.5 text-slate-400">{r.reference}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">
                    {r.debit > 0 ? formatMoney(r.debit) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-700">
                    {r.credit > 0 ? formatMoney(r.credit) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{formatMoney(r.balance)}</td>
                  <td className="px-4 py-2.5 text-center">
                    {r.payment && (
                      <button
                        onClick={() =>
                          setReceipt({
                            companyName,
                            customerName: customer.name,
                            customerCode: customer.code,
                            amount: r.payment!.amount,
                            appliedSales: r.payment!.sale
                              ? [{ number: r.payment!.sale!.number, applied: r.payment!.amount, newStatus: r.payment!.sale!.status as "PAYEE" | "PARTIELLE" }]
                              : [],
                            leftover: r.payment!.sale ? 0 : r.payment!.amount,
                            newBalance: r.balance,
                            cashierName: userName,
                            issuedAt: r.payment!.date,
                          })
                        }
                        title="Réimprimer le reçu de ce paiement"
                        className="text-slate-400 hover:text-blue-600"
                      >
                        <Printer size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Aucune opération enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {proformas.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900 text-sm">Proformas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-medium">N°</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Valide jusqu&apos;au</th>
                  <th className="px-4 py-2.5 font-medium text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {proformas.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 text-slate-700">{p.number}</td>
                    <td className="px-4 py-2.5 text-slate-600">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {p.validUntil ? formatDate(p.validUntil) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{formatMoney(p.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={paying} onClose={() => setPaying(false)} title="Encaisser un paiement">
        <DossierPaymentForm
          customer={customer}
          companyName={companyName}
          userName={userName}
          onDone={() => setPaying(false)}
          onReceipt={(r) => setReceipt(r)}
        />
      </Modal>

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setReceipt(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <DebtPaymentReceiptDocument data={receipt} />
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
          <DebtPaymentReceiptDocument data={receipt} />
        </div>
      )}
    </div>
  );
}

function DossierPaymentForm({
  customer,
  companyName,
  userName,
  onDone,
  onReceipt,
}: {
  customer: Customer;
  companyName: string;
  userName: string;
  onDone: () => void;
  onReceipt: (data: DebtPaymentReceiptData) => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await recordCustomerPayment(prev, formData);
    if (res && "success" in res && res.success) {
      onReceipt({
        companyName,
        customerName: customer.name,
        customerCode: customer.code,
        amount: res.amount,
        appliedSales: res.appliedSales,
        leftover: res.leftover,
        newBalance: res.newBalance,
        cashierName: userName,
        issuedAt: new Date(),
      });
      onDone();
      router.refresh();
    }
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="customerId" value={customer.id} />
      <p className="text-sm text-slate-500">
        Dette actuelle : <span className="font-semibold text-slate-800">{formatMoney(customer.creditBalance)}</span>
      </p>
      <div>
        <Label>Montant encaissé</Label>
        <Input type="number" name="amount" min={1} step="1" max={customer.creditBalance} required autoFocus />
      </div>
      <div>
        <Label>Mode de paiement</Label>
        <Select name="method" defaultValue="ESPECES">
          {Object.entries(PAYMENT_LABELS)
            .filter(([k]) => k !== "CREDIT")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </Select>
      </div>
      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        Encaisser ce paiement exige d&apos;avoir ouvert votre caisse — un règlement en espèces y sera compté à la
        fermeture.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Encaisser</SubmitButton>
      </div>
    </form>
  );
}
