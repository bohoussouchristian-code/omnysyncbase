"use client";

import Link from "next/link";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { ArrowLeft, User, Phone, MapPin } from "lucide-react";
import type { PurchaseStatus } from "@prisma/client";

type Supplier = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  balance: number;
};

type Purchase = {
  id: string;
  number: string;
  date: Date;
  totalAmount: number;
  validatedAt: Date | null;
  status: PurchaseStatus;
  warehouse: { name: string };
};

type Payment = {
  id: string;
  amount: number;
  date: Date;
};

type LedgerRow = {
  date: Date;
  label: string;
  reference: string;
  debit: number;
  credit: number;
};

export function SupplierDossierClient({
  supplier,
  purchases,
  payments,
}: {
  supplier: Supplier;
  purchases: Purchase[];
  payments: Payment[];
}) {
  // Une commande non encore validée n'a aucune réalité financière — le
  // solde fournisseur n'est mouvementé qu'à la validation (voir
  // validatePurchase dans src/lib/actions/purchases.ts).
  const validatedPurchases = purchases.filter((p) => p.validatedAt);
  const totalPurchased = validatedPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const rows: LedgerRow[] = [
    ...validatedPurchases.map((p) => ({
      date: p.date,
      label: `Achat — ${p.warehouse.name}`,
      reference: p.number,
      debit: p.totalAmount,
      credit: 0,
    })),
    ...payments.map((p) => ({
      date: p.date,
      label: "Paiement fournisseur",
      reference: p.id.slice(-8).toUpperCase(),
      debit: 0,
      credit: p.amount,
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
        href="/fournisseurs"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3"
      >
        <ArrowLeft size={14} /> Retour aux fournisseurs
      </Link>

      <PageHeader title={supplier.name} subtitle={supplier.code ?? undefined} />

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <User size={14} className="text-slate-400" /> {supplier.code ?? "—"}
          </span>
          {supplier.phone && (
            <span className="flex items-center gap-1.5">
              <Phone size={14} className="text-slate-400" /> {supplier.phone}
            </span>
          )}
          {supplier.address && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400" /> {supplier.address}
            </span>
          )}
        </div>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total acheté" value={formatMoney(totalPurchased)} />
        <StatCard label="Total payé" value={formatMoney(totalPaid)} tone="success" />
        <StatCard
          label="Solde (montant dû)"
          value={formatMoney(supplier.balance)}
          tone={supplier.balance > 0 ? "danger" : "default"}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Historique du compte</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Chaque achat validé augmente le solde dû ; chaque paiement le réduit.
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
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucune opération enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
