"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireManager() {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  if (check.user.role !== "ADMIN") return { error: "Seul un administrateur peut gérer la paie." } as const;
  return check;
}

// Les totaux ne sont jamais pris tels quels depuis le formulaire : ils sont
// recalculés ici à partir des montants de base, pour ne jamais dépendre d'un
// total falsifié côté client.
export async function createPayslip(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const employeeId = String(formData.get("employeeId") || "");
  const period = String(formData.get("period") || "").trim();
  const baseSalary = Number(formData.get("baseSalary") || 0);
  const allowances = Number(formData.get("allowances") || 0);
  const familyAllowance = Number(formData.get("familyAllowance") || 0);
  const socialContribution = Number(formData.get("socialContribution") || 0);
  const incomeTax = Number(formData.get("incomeTax") || 0);
  const otherDeductions = Number(formData.get("otherDeductions") || 0);
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!employeeId || !period) return { error: "Employé et période requis." };

  const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId } });
  if (!employee) return { error: "Employé introuvable." };

  const grossTotal = baseSalary + allowances + familyAllowance;
  const totalDeductions = socialContribution + incomeTax + otherDeductions;
  const netPay = grossTotal - totalDeductions;

  try {
    await prisma.payslip.create({
      data: {
        employeeId,
        period,
        baseSalary,
        allowances,
        familyAllowance,
        grossTotal,
        socialContribution,
        incomeTax,
        otherDeductions,
        totalDeductions,
        netPay,
        notes,
        companyId,
      },
    });
    revalidatePath("/paie");
    return { success: true };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique"))
      return { error: "Un bulletin existe déjà pour cet employé sur cette période." };
    return { error: "Erreur lors de la création du bulletin." };
  }
}

// Marquer un bulletin comme payé enregistre aussi la sortie d'argent dans
// Dépenses (catégorie Salaires), pour que le suivi financier (bilan,
// rapports) reflète automatiquement la paie sans double saisie.
export async function markPayslipPaid(payslipId: string) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { user, companyId } = check;

  const payslip = await prisma.payslip.findFirst({
    where: { id: payslipId, companyId },
    include: { employee: true },
  });
  if (!payslip) return { error: "Bulletin introuvable." };
  if (payslip.paidAt) return { error: "Ce bulletin est déjà marqué payé." };

  await prisma.$transaction(async (tx) => {
    await tx.payslip.update({
      where: { id: payslipId, companyId },
      data: { paidAt: new Date(), userId: user.id },
    });
    await tx.expense.create({
      data: {
        category: "Salaires",
        description: `Salaire ${payslip.employee.name} — ${payslip.period}`,
        amount: payslip.netPay,
        userId: user.id,
        companyId,
      },
    });
  });

  revalidatePath("/paie");
  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  return { success: true };
}
