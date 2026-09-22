"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { login } from "@/lib/actions/auth";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined as
    | { error?: string }
    | undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative flex flex-1 items-center justify-center px-4 overflow-hidden">
      <Image
        src="/login-bg.png"
        alt=""
        fill
        priority
        className="object-cover"
        style={{ objectPosition: "22% 18%" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/55 to-slate-950/75" />

      <div className="relative z-10 w-full max-w-sm mt-40">
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                title={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {pending ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
