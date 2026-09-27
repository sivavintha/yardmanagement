import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import {
  SUPERADMIN_PERMISSIONS,
  YARD_USER_PERMISSIONS,
  VIEWER_PERMISSIONS,
} from "./lib/permissions";

/**
 * Idempotent first-boot setup: default roles, initial superadmin (from env),
 * and default master values (StockCategory, ContainerSize) per the LLD.
 * Safe to run on every container start.
 */
export async function ensureBootstrapData() {
  const superadminRole = await prisma.role.upsert({
    where: { name: "Superadmin" },
    update: {},
    create: { name: "Superadmin", permissions: SUPERADMIN_PERMISSIONS as any },
  });
  await prisma.role.upsert({
    where: { name: "Yard User" },
    update: {},
    create: { name: "Yard User", permissions: YARD_USER_PERMISSIONS as any },
  });
  await prisma.role.upsert({
    where: { name: "Viewer" },
    update: {},
    create: { name: "Viewer", permissions: VIEWER_PERMISSIONS as any },
  });

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const email = (process.env.SUPERADMIN_EMAIL || "admin@example.com").toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD || "ChangeMe123!";
    await prisma.user.create({
      data: {
        name: process.env.SUPERADMIN_NAME || "Super Admin",
        email,
        passwordHash: await bcrypt.hash(password, 10),
        roleId: superadminRole.id,
      },
    });
    console.log(`[bootstrap] created initial superadmin: ${email}`);
  }

  const categoryCount = await prisma.stockCategory.count();
  if (categoryCount === 0) {
    await prisma.stockCategory.createMany({
      data: [{ name: "Bonding" }, { name: "Non Bonding" }, { name: "Section-49" }],
    });
  }

  const sizeCount = await prisma.containerSize.count();
  if (sizeCount === 0) {
    await prisma.containerSize.createMany({ data: [{ name: "20 ft" }, { name: "40 ft" }] });
  }

  const settingsCount = await prisma.companySetting.count();
  if (settingsCount === 0) {
    await prisma.companySetting.create({ data: { name: "Yard Management" } });
  }
}
