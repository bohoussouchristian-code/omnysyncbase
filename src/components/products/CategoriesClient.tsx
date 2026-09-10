"use client";

import { useActionState } from "react";
import { createCategory, createUnit } from "@/lib/actions/products";
import { Card, Input, SubmitButton, FormError, PageHeader } from "@/components/ui";

type Category = { id: string; name: string; _count: { products: number } };
type Unit = { id: string; name: string; symbol: string; _count: { products: number } };

export function CategoriesClient({ categories, units }: { categories: Category[]; units: Unit[] }) {
  const [catState, catAction] = useActionState(createCategory, undefined as { error?: string } | undefined);
  const [unitState, unitAction] = useActionState(createUnit, undefined as { error?: string } | undefined);

  return (
    <div>
      <PageHeader title="Catégories & unités" subtitle="Organisez votre catalogue de produits" />

      <div className="grid md:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
}
