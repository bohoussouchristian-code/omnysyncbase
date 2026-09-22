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
    <div className="relative h-dvh w-full overflow-hidden bg-slate-950">
      <Image
        src="/login-bg.png"
        alt=""
        fill
        priority
        className="object-cover object-[22%_5%]"
      />
      {/* Léger voile uniforme pour la lisibilité générale, puis un fondu
          concentré en bas où repose la carte — le haut de l'image (logo)
          reste net et pleinement visible. */}
      <div className="absolute inset-0 bg-slate-950/15" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80" />

      <div className="relative z-10 flex h-full w-full items-end justify-center overflow-hidden px-4 pb-6 pt-4">
        <div className="w-full max-w-sm">
          <div className="mb-3 text-center">
            <h1 className="text-[2rem] font-semibold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.5)]">
              Bienvenue
            </h1>
            <p className="text-[1.3rem] text-slate-200 mt-0.5 [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
              Connectez-vous pour accéder à votre espace
            </p>
          </div>

          <form
            action={action}
            className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl shadow-black/40 p-5 space-y-3"
          >
            {state?.error && (
              <div className="text-sm text-red-200 bg-red-500/15 border border-red-400/30 rounded-lg px-3 py-2">
                {state.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium tracking-wide text-slate-300 uppercase mb-1">
                Email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="username"
                  className="w-full rounded-lg bg-white/5 border border-white/15 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium tracking-wide text-slate-300 uppercase mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg bg-white/5 border border-white/15 pl-9 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-amber-400/50 transition-colors"
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
              className="w-full rounded-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 py-2 text-sm font-semibold hover:from-amber-300 hover:to-yellow-400 disabled:opacity-60 transition-all shadow-lg shadow-amber-500/20"
            >
              {pending ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
