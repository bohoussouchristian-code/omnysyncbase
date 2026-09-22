"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPayslip, markPayslipPaid } from "@/lib/actions/payslips";
import { Modal, Input, Select, Label, SubmitButton, FormError, Badge, PageHeader, Card } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/utils";
import { PayslipDocument, type PayslipData } from "@/components/hr/PayslipDocument";
import { Plus, Eye, CheckCircle2, Printer, Search } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  matricule: string | null;
  position: string | null;
  category: string | null;
  maritalStatus: string | null;
  dependents: number;
  paymentMethod: string | null;
  baseSalary: number;
};

type Payslip = {
  id: string;
  period: string;
  baseSalary: number;
  allowances: number;
  familyAllowance: number;
  grossTotal: number;
  socialContribution: number;
  incomeTax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  paidAt: Date | null;
  createdAt: Date;
  employee: Employee;
};

export function PayslipsClient({
  payslips,
  employees,
  companyName,
  companyAddress,
  companyPhone,
}: {
  payslips: Payslip[];
  employees: Employee[];
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [printing, setPrinting] = useState<Payslip | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payslips;
    return payslips.filter(
      (p) => p.employee.name.toLowerCase().includes(q) || p.period.toLowerCase().includes(q)
    );
  }, [payslips, query]);

  function handlePrint(p: Payslip) {
    setPrinting(p);
    setTimeout(() => window.print(), 50);
  }

  function handleMarkPaid(id: string) {
    startTransition(async () => {
      await markPayslipPaid(id);
      router.refresh();
    });
  }

  const printData: PayslipData | null = printing
    ? {
        number: printing.id,
        companyName,
        companyAddress,
        companyPhone,
        employeeName: printing.employee.name,
        matricule: printing.employee.matricule,
        position: printing.employee.position,
        category: printing.employee.category,
        maritalStatus: printing.employee.maritalStatus,
        dependents: printing.employee.dependents,
        paymentMethod: printing.employee.paymentMethod,
        period: printing.period,
        baseSalary: printing.baseSalary,
        allowances: printing.allowances,
        familyAllowance: printing.familyAllowance,
        grossTotal: printing.grossTotal,
        socialContribution: printing.socialContribution,
        incomeTax: printing.incomeTax,
        otherDeductions: printing.otherDeductions,
        totalDeductions: printing.totalDeductions,
        netPay: printing.netPay,
        paidAt: printing.paidAt,
        issuedAt: printing.createdAt,
      }
    : null;

  return (
    <div>
      <PageHeader
        title="Bulletins de salaire"
        action={
          <button
            onClick={() => setShowCreate(true)}
            disabled={employees.length === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={16} /> Nouveau bulletin
          </button>
        }
      />

      {employees.length === 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Ajoutez d&apos;abord un employé depuis le module Employés pour pouvoir créer un bulletin.
        </p>
      )}

      <div className="relative max-w-xs mb-4">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un employé, une période..."
          className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Employé</th>
                <th className="px-4 py-3 font-medium">Période</th>
                <th className="px-4 py-3 font-medium text-right">Total gains</th>
                <th className="px-4 py-3 font-medium text-right">Retenues</th>
                <th className="px-4 py-3 font-medium text-right">Net à payer</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">{p.employee.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.period}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatMoney(p.grossTotal)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatMoney(p.totalDeductions)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(p.netPay)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.paidAt ? "success" : "warning"}>
                      {p.paidAt ? `Payé le ${formatDate(p.paidAt)}` : "Non payé"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-center">
                      <button
                        onClick={() => handlePrint(p)}
                        title="Voir / imprimer"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      >
                        <Eye size={16} />
                      </button>
                      {!p.paidAt && (
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          disabled={pending}
                          title="Marquer payé"
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <CheckCircle2 size={14} /> Marquer payé
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {payslips.length === 0 ? "Aucun bulletin de salaire." : "Aucun résultat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau bulletin de salaire">
        <PayslipForm
          employees={employees}
          onDone={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      </Modal>

      {printData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPrinting(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <PayslipDocument data={printData} />
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setPrinting(null)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white py-2 text-sm hover:bg-blue-700"
              >
                <Printer size={14} /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {printData && (
        <div id="receipt-print" className="hidden">
          <PayslipDocument data={printData} />
        </div>
      )}
    </div>
  );
}

function PayslipForm({ employees, onDone }: { employees: Employee[]; onDone: () => void }) {
  const [state, formAction] = useActionState(async (prev: unknown, formData: FormData) => {
    const res = await createPayslip(prev, formData);
    if (res && "success" in res && res.success) onDone();
    return res;
  }, undefined as { error?: string } | undefined);

  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const [baseSalary, setBaseSalary] = useState(employees[0]?.baseSalary ?? 0);
  const [allowances, setAllowances] = useState(0);
  const [familyAllowance, setFamilyAllowance] = useState(0);
  const [socialContribution, setSocialContribution] = useState(0);
  const [incomeTax, setIncomeTax] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);

  function selectEmployee(id: string) {
    setEmployeeId(id);
    const emp = employees.find((e) => e.id === id);
    setBaseSalary(emp?.baseSalary ?? 0);
  }

  const grossTotal = baseSalary + allowances + familyAllowance;
  const totalDeductions = socialContribution + incomeTax + otherDeductions;
  const netPay = grossTotal - totalDeductions;

  return (
    <form action={formAction} className="space-y-4">
      <FormError error={state?.error} />

      <div>
        <Label>Employé</Label>
        <Select name="employeeId" value={employeeId} onChange={(e) => selectEmployee(e.target.value)}>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Période (ex : Septembre 2026)</Label>
        <Input name="period" required placeholder="Septembre 2026" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Salaire de base</Label>
          <Input
            type="number"
            name="baseSalary"
            min={0}
            step="1"
            value={baseSalary}
            onChange={(e) => setBaseSalary(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Primes et indemnités</Label>
          <Input
            type="number"
            name="allowances"
            min={0}
            step="1"
            value={allowances}
            onChange={(e) => setAllowances(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label>Allocations familiales</Label>
        <Input
          type="number"
          name="familyAllowance"
          min={0}
          step="1"
          value={familyAllowance}
          onChange={(e) => setFamilyAllowance(Number(e.target.value))}
        />
      </div>

      <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
        <div>
          <Label>Cotisation CNPS</Label>
          <Input
            type="number"
            name="socialContribution"
            min={0}
            step="1"
            value={socialContribution}
            onChange={(e) => setSocialContribution(Number(e.target.value))}
          />
        </div>
        <div>
          <Label>Impôt (ITS)</Label>
          <Input
            type="number"
            name="incomeTax"
            min={0}
            step="1"
            value={incomeTax}
            onChange={(e) => setIncomeTax(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <Label>Avances / autres retenues</Label>
        <Input
          type="number"
          name="otherDeductions"
          min={0}
          step="1"
          value={otherDeductions}
          onChange={(e) => setOtherDeductions(Number(e.target.value))}
        />
      </div>

      <div>
        <Label>Notes (optionnel)</Label>
        <Input name="notes" placeholder="Remarques..." />
      </div>

      <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Total des gains</span>
          <span className="font-medium">{formatMoney(grossTotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Total des retenues</span>
          <span className="font-medium">{formatMoney(totalDeductions)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-1.5 mt-1.5">
          <span>Net à payer</span>
          <span>{formatMoney(netPay)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onDone} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
          Annuler
        </button>
        <SubmitButton>Créer le bulletin</SubmitButton>
      </div>
    </form>
  );
}
