"use server";

import { prisma } from "@/lib/prisma";
import { requireCompanyUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// La fiche employé (et donc la paie) ne peut être créée/modifiée que par un
// administrateur — même règle que le reste des données de base sensibles.
async function requireManager() {
  const check = await requireCompanyUser();
  if ("error" in check) return { error: check.error };
  if (check.user.role !== "ADMIN") return { error: "Seul un administrateur peut gérer les employés." } as const;
  return check;
}

export async function createEmployee(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const name = String(formData.get("name") || "").trim();
  const matricule = String(formData.get("matricule") || "").trim() || null;
  const position = String(formData.get("position") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;
  const hireDateRaw = String(formData.get("hireDate") || "");
  const hireDate = hireDateRaw ? new Date(hireDateRaw) : null;
  const maritalStatus = String(formData.get("maritalStatus") || "").trim() || null;
  const dependents = Number(formData.get("dependents") || 0);
  const paymentMethod = String(formData.get("paymentMethod") || "").trim() || null;
  const baseSalary = Number(formData.get("baseSalary") || 0);

  if (!name) return { error: "Le nom de l'employé est requis." };

  await prisma.employee.create({
    data: {
      name,
      matricule,
      position,
      category,
      hireDate,
      maritalStatus,
      dependents,
      paymentMethod,
      baseSalary,
      companyId,
    },
  });

  revalidatePath("/employes");
  return { success: true };
}

export async function updateEmployee(_prev: unknown, formData: FormData) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const matricule = String(formData.get("matricule") || "").trim() || null;
  const position = String(formData.get("position") || "").trim() || null;
  const category = String(formData.get("category") || "").trim() || null;
  const hireDateRaw = String(formData.get("hireDate") || "");
  const hireDate = hireDateRaw ? new Date(hireDateRaw) : null;
  const maritalStatus = String(formData.get("maritalStatus") || "").trim() || null;
  const dependents = Number(formData.get("dependents") || 0);
  const paymentMethod = String(formData.get("paymentMethod") || "").trim() || null;
  const baseSalary = Number(formData.get("baseSalary") || 0);

  if (!id || !name) return { error: "Données invalides." };

  const existing = await prisma.employee.findFirst({ where: { id, companyId } });
  if (!existing) return { error: "Employé introuvable." };

  await prisma.employee.update({
    where: { id, companyId },
    data: { name, matricule, position, category, hireDate, maritalStatus, dependents, paymentMethod, baseSalary },
  });

  revalidatePath("/employes");
  return { success: true };
}

export async function toggleEmployeeActive(id: string) {
  const check = await requireManager();
  if ("error" in check) return { error: check.error };
  const { companyId } = check;

  const existing = await prisma.employee.findFirst({ where: { id, companyId } });
  if (!existing) return { error: "Employé introuvable." };

  await prisma.employee.update({ where: { id, companyId }, data: { active: !existing.active } });
  revalidatePath("/employes");
  return { success: true };
}
