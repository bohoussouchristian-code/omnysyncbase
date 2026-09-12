"use client";

import { useState, useTransition } from "react";
import { closeCashSession, previewCashClosing } from "@/lib/actions/cash";
import { Input, Label } from "@/components/ui";
import { formatMoney, formatDateTime } from "@/lib/utils";

type Session = {
  id: string;
  warehouse: { name: string };
  openingAmount: number;
  openedAt: Date;
};

// Fermeture de caisse en deux temps : l'agent saisit le montant compté, puis
// DOIT vérifier les fonds (comparaison avec le montant attendu recalculé côté
// serveur) et confirmer explicitement avant que la clôture ne soit définitive.
export function CashClosingForm({
  session,
  onClosed,
}: {
  session: Session;
  onClosed?: () => void;
}) {
  const [step, setStep] = useState<"count" | "confirm" | "done">("count");
  const [closingAmount, setClosingAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [expectedAmount, setExpectedAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counted = Number(closingAmount || 0);
  const diff = expectedAmount != null ? counted - expectedAmount : null;

  function verify() {
    setError(null);
    if (closingAmount === "") {
      setError("Indiquez le montant compté en caisse.");
      return;
    }
    startTransition(async () => {
      const res = await previewCashClosing(session.id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setExpectedAmount(res.expectedAmount ?? 0);
      setStep("confirm");
    });
  }

  // Un excédent (compté > attendu) doit être justifié avant de pouvoir
  // confirmer : un surplus inexpliqué est aussi suspect qu'un manquant.
  const requiresJustification = (diff || 0) > 0;
  // Un manquant (compté < attendu) bloque totalement la fermeture : impossible
  // de la contourner par une simple note, il faut remettre l'argent manquant
  // en caisse et recompter avant de pouvoir continuer.
  const isShortfall = (diff || 0) < 0;

  function confirmClose() {
    setError(null);
    if (isShortfall) return;
    if (requiresJustification && notes.trim() === "") {
      setError("Un excédent de caisse doit être justifié avant de confirmer la fermeture.");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", session.id);
      formData.set("closingAmount", closingAmount);
      formData.set("notes", notes);
      const res = await closeCashSession(undefined, formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setStep("done");
    });
  }

  if (step === "done") {
    return (
      <div className="space-y-4">
        <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Session fermée. Montant attendu : {formatMoney(expectedAmount || 0)}
        </div>
        <button
          onClick={onClosed}
          className="w-full rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
        >
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-slate-900">Session ouverte — {session.warehouse.name}</h2>
      <p className="text-xs text-slate-400">Depuis {formatDateTime(session.openedAt)}</p>
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}
      <p className="text-sm text-slate-500">Fond initial : {formatMoney(session.openingAmount)}</p>

      {step === "count" && (
        <>
          <div>
            <Label>Montant compté en caisse</Label>
            <Input
              type="number"
              min={0}
              step="1"
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Remarques (optionnel)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button
            type="button"
            onClick={verify}
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {pending ? "Vérification..." : "Vérifier les fonds"}
          </button>
        </>
      )}

      {step === "confirm" && expectedAmount != null && (
        <>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm overflow-hidden">
            <div className="flex justify-between px-3 py-2">
              <span className="text-slate-500">Montant attendu</span>
              <span className="font-medium">{formatMoney(expectedAmount)}</span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-slate-500">Montant compté</span>
              <span className="font-medium">{formatMoney(counted)}</span>
            </div>
            <div
              className={`flex justify-between px-3 py-2 font-semibold ${
                diff === 0 ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
              }`}
            >
              <span>{diff === 0 ? "Aucun écart" : diff! > 0 ? "Excédent" : "Manquant"}</span>
              <span>{formatMoney(Math.abs(diff || 0))}</span>
            </div>
          </div>
          {isShortfall && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Fermeture bloquée : il manque {formatMoney(Math.abs(diff || 0))} en caisse. Remettez le
              montant manquant en place, puis recomptez avant de pouvoir continuer.
            </div>
          )}
          {requiresJustification && (
            <div>
              <Label>Justificatif de l&apos;excédent (obligatoire)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex : pourboire non déclaré, erreur de rendu-monnaie retrouvée..."
                required
              />
            </div>
          )}
          {diff === 0 && (
            <p className="text-xs text-slate-400">
              Vérifiez le fond de caisse avant de confirmer : la fermeture est définitive.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("count")}
              disabled={pending}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              {isShortfall ? "Recompter" : "Modifier"}
            </button>
            {!isShortfall && (
              <button
                type="button"
                onClick={confirmClose}
                disabled={pending || (requiresJustification && notes.trim() === "")}
                className="flex-1 rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending ? "Fermeture..." : "Confirmer la fermeture"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
