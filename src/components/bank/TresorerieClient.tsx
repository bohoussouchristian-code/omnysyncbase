"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createBankAccount,
  recordBankTransaction,
  toggleBankAccountActive,
  toggleTransactionReconciled,
  recordBankReconciliation,
} from "@/lib/actions/bank";
import { Modal, Input, Label, SubmitButton, FormError, PageHeader, Card, StatCard, Badge } from "@/components/ui";
import { formatMoney, formatDateTime, formatDate } from "@/lib/utils";
import { Plus, ArrowDownCircle, ArrowUpCircle, Power, Landmark, ClipboardCheck } from "lucide-react";

type Transaction = {
  id: string;
  type: "RECETTE" | "DECAISSEMENT";
  amount: number;
  label: string;
  reference: string | null;
  date: Date;
  reconciled: boolean;
  user: { name: string } | null;
};
type Reconciliation = {
  id: string;
  statementDate: Date;
  statementBalance: number;
  bookBalance: number;
  difference: number;
  note: string | null;
  createdAt: Date;
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
  reconciliations: Reconciliation[];
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

export function TresorerieClient({ accounts, canManage }: { accounts: Account[]; canManage: boolean }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showTx, setShowTx] = useState<{ account: Account; type: "RECETTE" | "DECAISSEMENT" } | null>(null);
  const [showReconcile, setShowReconcile] = useState<Account | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(accounts[0]?.id ?? null);

  function toggleReconciled(id: string) {
    toggleTransactionReconciled(id).then(() => router.refresh());
  }

  const totalBalance = accounts.filter((a) => a.active).reduce((s, a) => s + a.balance, 0);
  const selected = accounts.find((a) => a.id === selectedId) || null;
  const ledger = useMemo(() => (selected ? buildLedger(selected) : []), [selected]);

  return (
    <div>
      <PageHeader
        title="Comptes bancaires"
        subtitle="Chaque recette et décaissement saisi ici met à jour le solde, comme si le compte était directement lié à l'app."
        action={
          canManage ? (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> Nouveau compte
            </button>
          ) : undefined
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
                {canManage && (
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
                )}
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
              {canManage && (
                <>
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
                </>
              )}
              <button
                onClick={() => setShowReconcile(selected)}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 text-blue-700 text-xs font-semibold px-3 py-1.5 hover:bg-blue-100"
              >
                <ClipboardCheck size={13} /> Rapprocher
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
                  <th className="pb-2 font-medium text-center">Pointé</th>
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
                    <td className="py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={tx.reconciled}
                        onChange={() => toggleReconciled(tx.id)}
                        title="Confirmer que ce mouvement apparaît sur le relevé bancaire"
                        className="h-4 w-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400">
                      Aucun mouvement enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selected && selected.reconciliations.length > 0 && (
        <Card className="p-5 mt-4">
          <h3 className="font-semibold text-slate-900 text-sm mb-3">Historique des rapprochements</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Date du relevé</th>
                  <th className="pb-2 font-medium text-right">Solde relevé</th>
                  <th className="pb-2 font-medium text-right">Solde théorique</th>
                  <th className="pb-2 font-medium text-right">Écart</th>
                  <th className="pb-2 font-medium">Note</th>
                  <th className="pb-2 font-medium">Par</th>
                </tr>
              </thead>
              <tbody>
                {selected.reconciliations.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-1.5 text-slate-600">{formatDate(r.statementDate)}</td>
                    <td className="py-1.5 text-right">{formatMoney(r.statementBalance)}</td>
                    <td className="py-1.5 text-right text-slate-500">{formatMoney(r.bookBalance)}</td>
                    <td className="py-1.5 text-right">
                      <Badge tone={r.difference === 0 ? "success" : "danger"}>{formatMoney(r.difference)}</Badge>
                    </td>
                    <td className="py-1.5 text-slate-500 max-w-xs truncate" title={r.note || ""}>
                      {r.note || "—"}
                    </td>
                    <td className="py-1.5 text-slate-500">{r.user?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau compte bancaire">
        <CreateAccountForm onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal
        open={!!showReconcile}
        onClose={() => setShowReconcile(null)}
        title={`Rapprochement — ${showReconcile?.name || ""}`}
      >
        {showReconcile && <ReconciliationForm account={showReconcile} onDone={() => setShowReconcile(null)} />}
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

function ReconciliationForm({ account, onDone }: { account: Account; onDone: () => void }) {
  const router = useRouter();
  const [statementBalance, setStatementBalance] = useState("");
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await recordBankReconciliation(prev, formData);
    if (res && "success" in res && res.success) {
      router.refresh();
      onDone();
    }
    return res;
  }, undefined as { error?: string } | undefined);

  const difference = statementBalance === "" ? null : Number(statementBalance) - account.balance;

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="bankAccountId" value={account.id} />
      <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        Solde théorique actuel de « {account.name} » : <strong>{formatMoney(account.balance)}</strong>
      </p>
      <div>
        <Label>Date du relevé</Label>
        <Input type="date" name="statementDate" defaultValue={new Date().toISOString().slice(0, 10)} required />
      </div>
      <div>
        <Label>Solde du relevé bancaire</Label>
        <Input
          type="number"
          name="statementBalance"
          step="1"
          required
          value={statementBalance}
          onChange={(e) => setStatementBalance(e.target.value)}
        />
      </div>
      {difference != null && (
        <div
          className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 border ${
            difference === 0
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <span>Écart</span>
          <span className="font-semibold">{formatMoney(difference)}</span>
        </div>
      )}
      <div>
        <Label>Note {difference && difference !== 0 ? "(obligatoire pour justifier l'écart)" : "(optionnel)"}</Label>
        <Input name="note" placeholder="Ex : frais bancaires non encore saisis, chèque non débité..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Enregistrer le rapprochement</SubmitButton>
      </div>
    </form>
  );
}
