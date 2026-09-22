"use client";

import { useActionState, useState } from "react";
import { createEmployee, updateEmployee, toggleEmployeeActive } from "@/lib/actions/employees";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";
import { Plus, Pencil, Power } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  matricule: string | null;
  position: string | null;
  category: string | null;
  hireDate: Date | null;
  maritalStatus: string | null;
  dependents: number;
  paymentMethod: string | null;
  baseSalary: number;
  active: boolean;
};

const PAYMENT_METHODS = ["Espèces", "Virement bancaire", "Mobile Money"];
const MARITAL_STATUSES = ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf(ve)"];

export function EmployeesClient({ employees }: { employees: Employee[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  return (
    <div>
      <PageHeader
        title="Employés"
        action={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            <Plus size={16} /> Nouvel employé
          </button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Poste</th>
                <th className="px-4 py-3 font-medium">Matricule</th>
                <th className="px-4 py-3 font-medium">Embauché le</th>
                <th className="px-4 py-3 font-medium text-right">Salaire de base</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                  <td className="px-4 py-3 text-slate-600">{e.position || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{e.matricule || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{e.hireDate ? formatDate(e.hireDate) : "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(e.baseSalary)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={e.active ? "success" : "default"}>{e.active ? "Actif" : "Inactif"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => setEditing(e)}
                        className="text-slate-400 hover:text-blue-600"
                        title="Modifier"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => toggleEmployeeActive(e.id)}
                        className="text-slate-400 hover:text-red-600"
                        title={e.active ? "Désactiver" : "Activer"}
                      >
                        <Power size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Aucun employé enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel employé">
        <EmployeeForm onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'employé">
        {editing && <EmployeeForm employee={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

function EmployeeForm({ employee, onDone }: { employee?: Employee; onDone: () => void }) {
  const action = employee ? updateEmployee : createEmployee;
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await action(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />
      {employee && <input type="hidden" name="id" value={employee.id} />}

      <div>
        <Label>Nom et prénoms</Label>
        <Input name="name" required defaultValue={employee?.name} placeholder="Ex: Awa Koné" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Matricule (optionnel)</Label>
          <Input name="matricule" defaultValue={employee?.matricule || ""} />
        </div>
        <div>
          <Label>Poste / Fonction</Label>
          <Input name="position" defaultValue={employee?.position || ""} placeholder="Ex: Caissière" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Catégorie (optionnel)</Label>
          <Input name="category" defaultValue={employee?.category || ""} />
        </div>
        <div>
          <Label>Date d&apos;embauche</Label>
          <Input
            type="date"
            name="hireDate"
            defaultValue={employee?.hireDate ? new Date(employee.hireDate).toISOString().slice(0, 10) : ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Situation matrimoniale</Label>
          <Select name="maritalStatus" defaultValue={employee?.maritalStatus || ""}>
            <option value="">— Non renseignée —</option>
            {MARITAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Enfants à charge</Label>
          <Input type="number" name="dependents" min={0} step="1" defaultValue={employee?.dependents ?? 0} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Mode de paiement</Label>
          <Select name="paymentMethod" defaultValue={employee?.paymentMethod || ""}>
            <option value="">— Non renseigné —</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Salaire de base</Label>
          <Input type="number" name="baseSalary" min={0} step="1" defaultValue={employee?.baseSalary ?? 0} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>{employee ? "Enregistrer" : "Créer l'employé"}</SubmitButton>
      </div>
    </form>
  );
}
