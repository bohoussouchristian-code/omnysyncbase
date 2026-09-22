"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { login } from "@/lib/actions/auth";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined as
    | { error?: string }
    | undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative flex flex-1 flex-col bg-slate-950 overflow-hidden">
      <div className="relative h-52 sm:h-64 w-full shrink-0 overflow-hidden">
        <Image
          src="/login-bg.png"
          alt=""
          fill
          priority
          className="object-cover object-[8%_16%] sm:object-[22%_20%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/50 to-slate-950" />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <p className="text-[11px] font-semibold tracking-[0.3em] text-amber-400/90 uppercase">
              Espace privé
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold text-white">Bienvenue</h1>
            <p className="text-sm text-slate-300 mt-1">
              Connectez-vous pour accéder à votre espace
            </p>
          </div>

          <form
            action={action}
            className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl shadow-black/40 p-7 space-y-5"
          >
            {state?.error && (
              <div className="text-sm text-red-200 bg-red-500/15 border border-red-400/30 rounded-lg px-3 py-2">
                {state.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium tracking-wide text-slate-300 uppercase mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="username"
                  className="w-full rounded-lg bg-white/5 border border-white/15 pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium tracking-wide text-slate-300 uppercase mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg bg-white/5 border border-white/15 pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 py-2.5 text-sm font-semibold hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60 transition-all shadow-lg shadow-amber-500/20"
            >
              {pending ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
