import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Propriétaire de la plateforme : peut créer des entreprises depuis /console.
  // N'appartient à aucune entreprise.
  const ownerEmail = "bohoussouchristian@gmail.com";
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!existingOwner) {
    await prisma.user.create({
      data: {
        name: "Propriétaire plateforme",
        email: ownerEmail,
        passwordHash: await bcrypt.hash("changeme123", 10),
        role: "ADMIN",
        isPlatformOwner: true,
        companyId: null,
      },
    });
    console.log(`Propriétaire plateforme créé : ${ownerEmail} / changeme123`);
  }

  // Entreprise de démonstration, utile après un `prisma migrate reset` en local.
  const demoSlug = "demo";
  let demoCompany = await prisma.company.findUnique({ where: { slug: demoSlug } });
  if (!demoCompany) {
    demoCompany = await prisma.company.create({ data: { name: "Entreprise de démonstration", slug: demoSlug } });
    console.log(`Entreprise de démonstration créée : ${demoCompany.id}`);
  }
  const companyId = demoCompany.id;

  const adminEmail = "admin@entreprise.com";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        name: "Administrateur",
        email: adminEmail,
        passwordHash: await bcrypt.hash("admin123", 10),
        role: "ADMIN",
        companyId,
      },
    });
    console.log(`Utilisateur admin créé : ${adminEmail} / admin123`);
  }

  const units = [
    { name: "Pièce", symbol: "pc" },
    { name: "Carton", symbol: "ctn" },
    { name: "Casier", symbol: "csr" },
    { name: "Sac", symbol: "sac" },
    { name: "Kilogramme", symbol: "kg" },
    { name: "Litre", symbol: "L" },
    { name: "Mètre", symbol: "m" },
    { name: "Bidon", symbol: "bdn" },
  ];
  for (const u of units) {
    await prisma.unit.upsert({
      where: { companyId_name: { companyId, name: u.name } },
      update: {},
      create: { ...u, companyId },
    });
  }

  const categories = ["Boissons gazeuses", "Bières", "Eaux minérales", "Jus & sirops"];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { name, companyId },
    });
  }

  const existingWarehouse = await prisma.warehouse.findFirst({ where: { companyId } });
  if (!existingWarehouse) {
    await prisma.warehouse.create({
      data: { name: "Entrepôt principal", type: "ENTREPOT", address: "", companyId },
    });
    console.log("Dépôt par défaut créé : Entrepôt principal");
  }

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
