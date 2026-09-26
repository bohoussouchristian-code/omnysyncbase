"use client";

import { useActionState, useMemo, useState } from "react";
import { createProduct, updateProduct } from "@/lib/actions/products";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { Plus, Search, Pencil, Tag, Trash2 } from "lucide-react";
import Link from "next/link";

type BusinessType = "GENERIQUE" | "QUINCAILLERIE" | "BOISSON" | "LIBRAIRIE";

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  purchasePrice: number;
  salePrice: number;
  reorderLevel: number;
  active: boolean;
  categoryId: string | null;
  unitId: string | null;
  category: { id: string; name: string } | null;
  unit: { id: string; name: string; symbol: string } | null;
  stocks: { quantity: number; warehouseId: string }[];
  packUnitId: string | null;
  packUnit: { id: string; name: string; symbol: string } | null;
  piecesPerPack: number;
  packPurchasePrice: number | null;
  packSalePrice: number | null;
  proPrice: number | null;
  wholesalePrice: number | null;
  supplierPrices: { supplierId: string; purchasePrice: number }[];
  brand: string | null;
  reference: string | null;
  material: string | null;
  warrantyMonths: number | null;
  deposit: number | null;
  publisher: string | null;
};

type Option = { id: string; name: string; symbol?: string };
type Warehouse = { id: string; name: string };
type Supplier = { id: string; name: string };

export function ProductsClient({
  products,
  categories,
  units,
  warehouses,
  suppliers,
  canManage,
  businessType,
}: {
  products: Product[];
  categories: Option[];
  units: Option[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  canManage: boolean;
  businessType: BusinessType;
}) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category?.name.toLowerCase().includes(q) ?? false)
    );
  }, [products, query]);

  return (
    <div>
      <PageHeader
        title="Configuration des produits"
        subtitle={`${products.length} produit(s) au catalogue`}
        action={
          canManage ? (
            <div className="flex items-center gap-2">
              <Link
                href="/categories"
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Tag size={16} /> Catégories & unités
              </Link>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
              >
                <Plus size={16} /> Nouveau produit
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un produit, code-barres..."
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Unité</th>
                <th className="px-4 py-3 font-medium text-right">Achat</th>
                <th className="px-4 py-3 font-medium text-right">Vente</th>
                <th className="px-4 py-3 font-medium text-right">Stock total</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const totalStock = p.stocks.reduce((s, st) => s + st.quantity, 0);
                const low = p.reorderLevel > 0 && totalStock <= p.reorderLevel;
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      {p.barcode && <div className="text-xs text-slate-400">{p.barcode}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.category?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.unit?.symbol || "—"}
                      {p.packUnit && (
                        <div className="text-xs text-slate-400">
                          1 {p.packUnit.symbol} = {p.piecesPerPack} {p.unit?.symbol}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatMoney(p.purchasePrice)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatMoney(p.salePrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge tone={low ? "danger" : "default"}>{totalStock}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={p.active ? "success" : "default"}>
                        {p.active ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEditing(p)}
                            className="text-slate-400 hover:text-blue-600"
                            title="Modifier"
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Aucun produit trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau produit">
        <ProductForm
          categories={categories}
          units={units}
          warehouses={warehouses}
          suppliers={suppliers}
          businessType={businessType}
          onDone={() => setShowCreate(false)}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier le produit">
        {editing && (
          <ProductForm
            categories={categories}
            units={units}
            warehouses={warehouses}
            suppliers={suppliers}
            businessType={businessType}
            product={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function ProductForm({
  categories,
  units,
  warehouses,
  suppliers,
  businessType,
  product,
  onDone,
}: {
  categories: Option[];
  units: Option[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  businessType: BusinessType;
  product?: Product;
  onDone: () => void;
}) {
  const action = product ? updateProduct : createProduct;
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await action(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);
  const [packEnabled, setPackEnabled] = useState(!!product?.packUnitId);
  const [unitId, setUnitId] = useState(product?.unitId || "");
  const [supplierPrices, setSupplierPrices] = useState<{ supplierId: string; purchasePrice: number }[]>(
    product?.supplierPrices ?? []
  );
  const [newSupplierId, setNewSupplierId] = useState("");
  const [newSupplierPrice, setNewSupplierPrice] = useState(0);
  const availableSuppliers = suppliers.filter((s) => !supplierPrices.some((sp) => sp.supplierId === s.id));

  function addSupplierPrice() {
    if (!newSupplierId) return;
    setSupplierPrices((prev) => [...prev, { supplierId: newSupplierId, purchasePrice: newSupplierPrice }]);
    setNewSupplierId("");
    setNewSupplierPrice(0);
  }

  function updateSupplierPrice(supplierId: string, purchasePrice: number) {
    setSupplierPrices((prev) => prev.map((sp) => (sp.supplierId === supplierId ? { ...sp, purchasePrice } : sp)));
  }

  function removeSupplierPrice(supplierId: string) {
    setSupplierPrices((prev) => prev.filter((sp) => sp.supplierId !== supplierId));
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="supplierPrices" value={JSON.stringify(supplierPrices)} />

      <div>
        <Label>Nom du produit</Label>
        <Input name="name" required defaultValue={product?.name} placeholder="Ex: Coca-Cola 1.5L" />
      </div>

      <div>
        <Label>Code-barres</Label>
        <Input
          disabled
          value={product ? product.barcode || "" : "Généré automatiquement à la création"}
          className="bg-slate-100 text-slate-500 cursor-not-allowed"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Catégorie</Label>
          <Select name="categoryId" defaultValue={product?.categoryId || ""}>
            <option value="">— Aucune —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Unité</Label>
          <Select name="unitId" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">— Aucune —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.symbol})
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prix d&apos;achat</Label>
          <Input
            type="number"
            name="purchasePrice"
            min={0}
            step="1"
            defaultValue={product?.purchasePrice ?? 0}
          />
        </div>
        <div>
          <Label>Prix de vente (particulier)</Label>
          <Input type="number" name="salePrice" min={0} step="1" defaultValue={product?.salePrice ?? 0} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Prix professionnel (optionnel)</Label>
          <Input type="number" name="proPrice" min={0} step="1" defaultValue={product?.proPrice ?? ""} />
        </div>
        <div>
          <Label>Prix revendeur (optionnel)</Label>
          <Input type="number" name="wholesalePrice" min={0} step="1" defaultValue={product?.wholesalePrice ?? ""} />
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Appliqués automatiquement en caisse selon le type du client sélectionné. Laissez vide pour garder le prix
        particulier.
      </p>

      <div>
        <Label>Seuil d&apos;alerte stock bas</Label>
        <Input type="number" name="reorderLevel" min={0} step="1" defaultValue={product?.reorderLevel ?? 0} />
      </div>

      {businessType !== "GENERIQUE" && (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Informations complémentaires</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{businessType === "LIBRAIRIE" ? "Auteur" : "Marque"}</Label>
              <Input name="brand" defaultValue={product?.brand ?? ""} />
            </div>
            <div>
              <Label>Référence</Label>
              <Input name="reference" defaultValue={product?.reference ?? ""} />
            </div>
          </div>
          {businessType === "QUINCAILLERIE" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Matériau</Label>
                <Input name="material" defaultValue={product?.material ?? ""} placeholder="Ex: Acier, PVC, Bois" />
              </div>
              <div>
                <Label>Garantie (mois)</Label>
                <Input type="number" name="warrantyMonths" min={0} step="1" defaultValue={product?.warrantyMonths ?? ""} />
              </div>
            </div>
          )}
          {businessType === "BOISSON" && (
            <div>
              <Label>Consigne emballage (par casier)</Label>
              <Input type="number" name="deposit" min={0} step="1" defaultValue={product?.deposit ?? ""} />
              <p className="text-xs text-slate-400 mt-1">
                Montant du liquide (prix de vente ci-dessus) et de l&apos;emballage (ici) restent distincts — le
                client pourra choisir de payer la consigne ou non à la vente selon qu&apos;il rapporte ses
                emballages vides.
              </p>
            </div>
          )}
          {businessType === "LIBRAIRIE" && (
            <div>
              <Label>Éditeur</Label>
              <Input name="publisher" defaultValue={product?.publisher ?? ""} />
            </div>
          )}
        </div>
      )}

      <div className="border-t border-slate-100 pt-4">
        <Label>Prix d&apos;achat par fournisseur (optionnel)</Label>
        <p className="text-xs text-slate-500 mb-2">
          Prioritaire sur le prix d&apos;achat par défaut lors d&apos;un bon de commande auprès de ce fournisseur.
        </p>
        {supplierPrices.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {supplierPrices.map((sp) => {
              const supplier = suppliers.find((s) => s.id === sp.supplierId);
              return (
                <div key={sp.supplierId} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-slate-700 truncate">{supplier?.name || "?"}</span>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={sp.purchasePrice}
                    onChange={(e) => updateSupplierPrice(sp.supplierId, Number(e.target.value))}
                    className="w-28"
                  />
                  <button
                    type="button"
                    onClick={() => removeSupplierPrice(sp.supplierId)}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {availableSuppliers.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={newSupplierId} onChange={(e) => setNewSupplierId(e.target.value)} className="flex-1">
              <option value="">— Choisir un fournisseur —</option>
              {availableSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              step="1"
              value={newSupplierPrice}
              onChange={(e) => setNewSupplierPrice(Number(e.target.value))}
              placeholder="Prix"
              className="w-28"
            />
            <button
              type="button"
              onClick={addSupplierPrice}
              disabled={!newSupplierId}
              className="rounded-lg bg-slate-800 text-white text-sm px-3 py-2 hover:bg-slate-900 disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
          <input
            type="checkbox"
            checked={packEnabled}
            onChange={(e) => setPackEnabled(e.target.checked)}
            className="rounded border-slate-300"
          />
          Vendre aussi par lot (carton, casier...)
        </label>
        {packEnabled && (
          <div className="space-y-3 bg-slate-50 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unité du lot</Label>
                <Select name="packUnitId" defaultValue={product?.packUnitId || ""} required={packEnabled}>
                  <option value="">— Choisir —</option>
                  {units
                    .filter((u) => u.id !== unitId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                </Select>
                <p className="mt-1 text-xs text-slate-500">
                  Doit être différente de l&apos;unité de base ci-dessus (ex : Casier ≠ Bouteille).
                </p>
              </div>
              <div>
                <Label>Unités de base par lot</Label>
                <Input
                  type="number"
                  name="piecesPerPack"
                  min={2}
                  step="1"
                  defaultValue={product?.piecesPerPack && product.piecesPerPack > 1 ? product.piecesPerPack : 24}
                  placeholder="Ex: 24"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prix d&apos;achat du lot</Label>
                <Input
                  type="number"
                  name="packPurchasePrice"
                  min={0}
                  step="1"
                  defaultValue={product?.packPurchasePrice ?? ""}
                />
              </div>
              <div>
                <Label>Prix de vente du lot</Label>
                <Input
                  type="number"
                  name="packSalePrice"
                  min={0}
                  step="1"
                  defaultValue={product?.packSalePrice ?? ""}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Le stock reste toujours compté dans l&apos;unité de base ci-dessus. Ex: un &quot;Carton&quot; de
              24 &quot;Pièce&quot; — la caisse et les achats pourront vendre/acheter dans les deux unités.
            </p>
          </div>
        )}
      </div>

      {product && product.stocks.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            Stock actuel :{" "}
            {product.stocks
              .map((s) => `${warehouses.find((w) => w.id === s.warehouseId)?.name || "?"} (${s.quantity})`)
              .join(", ")}
            {" — "}
            <span className="text-slate-400">
              l&apos;entrée en stock se fait via Bon de commande → Bon de livraison → Approvisionnement.
            </span>
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>{product ? "Enregistrer" : "Créer le produit"}</SubmitButton>
      </div>
    </form>
  );
}
