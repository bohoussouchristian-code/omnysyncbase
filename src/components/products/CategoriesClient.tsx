"use client";

import { useActionState } from "react";
import { createCategory, createUnit, createPackagingType, togglePackagingTypeActive } from "@/lib/actions/products";
import { Card, Input, SubmitButton, FormError, PageHeader, Badge } from "@/components/ui";
import { Power } from "lucide-react";
import { formatMoney } from "@/lib/utils";

type Category = { id: string; name: string; _count: { products: number } };
type Unit = { id: string; name: string; symbol: string; _count: { products: number } };
type PackagingType = {
  id: string;
  name: string;
  deposit: number;
  active: boolean;
  _count: { products: number };
};

export function CategoriesClient({
  categories,
  units,
  packagingTypes,
}: {
  categories: Category[];
  units: Unit[];
  packagingTypes: PackagingType[];
}) {
  const [catState, catAction] = useActionState(createCategory, undefined as { error?: string } | undefined);
  const [unitState, unitAction] = useActionState(createUnit, undefined as { error?: string } | undefined);
  const [packagingState, packagingAction] = useActionState(
    createPackagingType,
    undefined as { error?: string } | undefined
  );

  return (
    <div>
      <PageHeader title="Catégories & unités" />

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Catégories</h2>
          <form action={catAction} className="flex gap-2 mb-4">
            <Input name="name" placeholder="Nouvelle catégorie" required />
            <SubmitButton pendingText="...">Ajouter</SubmitButton>
          </form>
          <FormError error={catState?.error} />
          <ul className="divide-y divide-slate-100">
            {categories.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-slate-700">{c.name}</span>
                <span className="text-slate-400">{c._count.products} produit(s)</span>
              </li>
            ))}
            {categories.length === 0 && <p className="text-sm text-slate-400 py-2">Aucune catégorie.</p>}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-3">Unités de mesure</h2>
          <form action={unitAction} className="grid grid-cols-2 gap-2 mb-4">
            <Input name="name" placeholder="Nom (ex: Carton)" required />
            <div className="flex gap-2">
              <Input name="symbol" placeholder="Symbole" required />
              <SubmitButton pendingText="...">+</SubmitButton>
            </div>
          </form>
          <FormError error={unitState?.error} />
          <ul className="divide-y divide-slate-100">
            {units.map((u) => (
              <li key={u.id} className="py-2 flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {u.name} <span className="text-slate-400">({u.symbol})</span>
                </span>
                <span className="text-slate-400">{u._count.products} produit(s)</span>
              </li>
            ))}
            {units.length === 0 && <p className="text-sm text-slate-400 py-2">Aucune unité.</p>}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-900 mb-1">Types d&apos;emballage</h2>
          <p className="text-xs text-slate-400 mb-3">
            Consigne emballage (boissons) — chaque type a son propre montant, partagé par les produits qui
            l&apos;utilisent.
          </p>
          <form action={packagingAction} className="grid grid-cols-2 gap-2 mb-4">
            <Input name="name" placeholder="Nom (ex: Casier standard)" required />
            <div className="flex gap-2">
              <Input type="number" name="deposit" min={1} step="1" placeholder="Consigne" required />
              <SubmitButton pendingText="...">+</SubmitButton>
            </div>
          </form>
          <FormError error={packagingState?.error} />
          <ul className="divide-y divide-slate-100">
            {packagingTypes.map((p) => (
              <li key={p.id} className={`py-2 flex items-center justify-between text-sm ${!p.active ? "opacity-50" : ""}`}>
                <span className="text-slate-700 flex items-center gap-2">
                  {p.name} <span className="text-slate-400">({formatMoney(p.deposit)})</span>
                  {!p.active && <Badge tone="default">Désactivé</Badge>}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-slate-400">{p._count.products} produit(s)</span>
                  <button
                    onClick={() => togglePackagingTypeActive(p.id)}
                    title={p.active ? "Désactiver" : "Réactiver"}
                    className="text-slate-300 hover:text-slate-600"
                  >
                    <Power size={13} />
                  </button>
                </span>
              </li>
            ))}
            {packagingTypes.length === 0 && (
              <p className="text-sm text-slate-400 py-2">Aucun type d&apos;emballage.</p>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
