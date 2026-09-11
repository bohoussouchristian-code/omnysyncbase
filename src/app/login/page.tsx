"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined as
    | { error?: string }
    | undefined);

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white text-xs font-bold tracking-wide">
            OSB
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">OSB</h1>
          <p className="text-sm text-slate-500 mt-1">
            Le tout-en-un pour gérer votre entreprise
          </p>
        </div>

        <form action={action} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
          {state?.error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="username"
              defaultValue="admin@entreprise.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              defaultValue="admin123"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {pending ? "Connexion..." : "Se connecter"}
          </button>

          <p className="text-xs text-slate-400 text-center pt-2">
            Compte par défaut : admin@entreprise.com / admin123
          </p>
        </form>
      </div>
    </div>
  );
}
