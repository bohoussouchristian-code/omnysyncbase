"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createBankAccount,
  recordBankTransaction,
  toggleBankAccountActive,
} from "@/lib/actions/bank";
import { Modal, Input, Label, SubmitButton, FormError, PageHeader, Card, StatCard } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Plus, ArrowDownCircle, ArrowUpCircle, Power, Landmark } from "lucide-react";

type Transaction = {
  id: string;
  type: "RECETTE" | "DECAISSEMENT";
  amount: number;
  label: string;
  reference: string | null;
  date: Date;
  user: { name: string } | null;
};
type Account = {
  id: string;
  name: string;
  bankName: string | null;
  accountNumber: string | null;
  balance: number;
  active: boolean;
  transactions: Transaction[];
};

// Reconstitue le relevé (solde après chaque mouvement) à partir du solde
// actuel du compte, en "remontant" le temps depuis les transactions les plus
// récentes (déjà triées desc) — évite d'avoir à stocker un solde historique
// sur chaque ligne.
function buildLedger(account: Account) {
  let running = account.balance;
  const rows: (Transaction & { balanceAfter: number })[] = [];
  for (const tx of account.transactions) {
    rows.push({ ...tx, balanceAfter: running });
    running += tx.type === "RECETTE" ? -tx.amount : tx.amount;
  }
  return rows;
}

export function TresorerieClient({ accounts }: { accounts: Account[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showTx, setShowTx] = useState<{ account: Account; type: "RECETTE" | "DECAISSEMENT" } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(accounts[0]?.id ?? null);

  const totalBalance = accounts.filter((a) => a.active).reduce((s, a) => s + a.balance, 0);
  const selected = accounts.find((a) => a.id === selectedId) || null;
  const ledger = useMemo(() => (selected ? buildLedger(selected) : []), [selected]);

  return (
    <div>
      <PageHeader
        title="Comptes bancaires"
        subtitle="Chaque recette et décaissement saisi ici met à jour le solde, comme si le compte était directement lié à l'app."
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Nouveau compte
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Trésorerie totale (comptes actifs)" value={formatMoney(totalBalance)} />
      </div>

      {accounts.length === 0 ? (
        <Card className="p-8 text-center text-slate-400">Aucun compte bancaire enregistré.</Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={`text-left border rounded-lg p-3 transition-colors ${
                selectedId === a.id ? "border-blue-400 bg-blue-50/40" : "border-slate-200 hover:bg-slate-50"
              } ${!a.active ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-1.5 font-medium text-slate-800 text-sm">
                  <Landmark size={14} className="text-slate-400" /> {a.name}
                </span>
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBankAccountActive(a.id);
                  }}
                  title={a.active ? "Désactiver" : "Réactiver"}
                  className="text-slate-300 hover:text-slate-600"
                >
                  <Power size={13} />
                </span>
              </div>
              {a.bankName && <p className="text-xs text-slate-400">{a.bankName}{a.accountNumber ? ` — ${a.accountNumber}` : ""}</p>}
              <p className={`text-lg font-bold mt-1 ${a.balance < 0 ? "text-red-600" : "text-slate-900"}`}>
                {formatMoney(a.balance)}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">{selected.name}</h2>
              <p className="text-xs text-slate-400">Solde actuel : {formatMoney(selected.balance)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTx({ account: selected, type: "RECETTE" })}
                disabled={!selected.active}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 text-emerald-700 text-xs font-semibold px-3 py-1.5 hover:bg-emerald-100 disabled:opacity-40"
              >
                <ArrowDownCircle size={13} /> Recette
              </button>
              <button
                onClick={() => setShowTx({ account: selected, type: "DECAISSEMENT" })}
                disabled={!selected.active}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/70 text-red-700 text-xs font-semibold px-3 py-1.5 hover:bg-red-100 disabled:opacity-40"
              >
                <ArrowUpCircle size={13} /> Décaissement
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Libellé</th>
                  <th className="pb-2 font-medium">Référence</th>
                  <th className="pb-2 font-medium text-right">Recette</th>
                  <th className="pb-2 font-medium text-right">Décaissement</th>
                  <th className="pb-2 font-medium text-right">Solde</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-50">
                    <td className="py-1.5 text-slate-500 whitespace-nowrap">{formatDateTime(tx.date)}</td>
                    <td className="py-1.5 text-slate-700">
                      {tx.label}
                      {tx.user && <span className="text-slate-400"> — {tx.user.name}</span>}
                    </td>
                    <td className="py-1.5 text-slate-400 font-mono text-xs">{tx.reference || "—"}</td>
                    <td className="py-1.5 text-right text-emerald-700">
                      {tx.type === "RECETTE" ? formatMoney(tx.amount) : "—"}
                    </td>
                    <td className="py-1.5 text-right text-red-600">
                      {tx.type === "DECAISSEMENT" ? formatMoney(tx.amount) : "—"}
                    </td>
                    <td className="py-1.5 text-right font-medium">{formatMoney(tx.balanceAfter)}</td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      Aucun mouvement enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau compte bancaire">
        <CreateAccountForm onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal
        open={!!showTx}
        onClose={() => setShowTx(null)}
        title={showTx?.type === "RECETTE" ? "Nouvelle recette" : "Nouveau décaissement"}
      >
        {showTx && <TransactionForm account={showTx.account} type={showTx.type} onDone={() => setShowTx(null)} />}
      </Modal>
    </div>
  );
}

function CreateAccountForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createBankAccount(prev, formData);
    if (res && "success" in res && res.success) {
      router.refresh();
      onDone();
    }
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <div>
        <Label>Nom du compte</Label>
        <Input name="name" placeholder="Ex : Compte principal" required />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Banque (optionnel)</Label>
          <Input name="bankName" placeholder="Ex : SGBCI" />
        </div>
        <div>
          <Label>N° de compte (optionnel)</Label>
          <Input name="accountNumber" />
        </div>
      </div>
      <div>
        <Label>Solde d&apos;ouverture</Label>
        <Input type="number" name="openingBalance" step="1" defaultValue={0} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Créer</SubmitButton>
      </div>
    </form>
  );
}

function TransactionForm({
  account,
  type,
  onDone,
}: {
  account: Account;
  type: "RECETTE" | "DECAISSEMENT";
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await recordBankTransaction(prev, formData);
    if (res && "success" in res && res.success) {
      router.refresh();
      onDone();
    }
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="bankAccountId" value={account.id} />
      <input type="hidden" name="type" value={type} />
      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        Solde actuel de « {account.name} » : <strong>{formatMoney(account.balance)}</strong>
      </p>
      <div>
        <Label>Libellé</Label>
        <Input
          name="label"
          placeholder={type === "RECETTE" ? "Ex : Dépôt recette caisse du jour" : "Ex : Paiement fournisseur"}
          required
        />
      </div>
      <div>
        <Label>Montant</Label>
        <Input type="number" name="amount" min={1} step="1" required />
      </div>
      <div>
        <Label>Référence (optionnel)</Label>
        <Input name="reference" placeholder="N° de virement, chèque..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>{type === "RECETTE" ? "Enregistrer la recette" : "Enregistrer le décaissement"}</SubmitButton>
      </div>
    </form>
  );
}
