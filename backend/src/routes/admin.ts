import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requiredText } from "../lib/validation";

const router = Router();
router.use(requireAuth);

// Logo uploads land in a small persisted folder served statically by
// index.ts at /uploads/*. Only image files, capped at 2MB.
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".png";
      cb(null, `logo-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files are allowed"));
    cb(null, true);
  },
});

// --- Users ---
const userCreateSchema = z.object({
  name: requiredText("Name"),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  roleId: z.string().min(1),
  active: z.boolean().optional(),
});
const userUpdateSchema = userCreateSchema.partial().extend({ password: z.string().min(8).optional() });

router.get("/users", requirePermission("users", "view"), async (_req, res) => {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(users.map(({ passwordHash, ...u }) => u));
});

router.post("/users", requirePermission("users", "create"), async (req, res) => {
  const parsed = userCreateSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const data = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) throw conflict("A user with this email already exists");

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash: await bcrypt.hash(data.password, 10),
      roleId: data.roleId,
      active: data.active ?? true,
    },
    include: { role: true },
  });
  const { passwordHash, ...safe } = user;
  res.status(201).json(safe);
});

router.put("/users/:id", requirePermission("users", "edit"), async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("User not found");
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const data = parsed.data;

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      email: data.email?.toLowerCase(),
      roleId: data.roleId,
      active: data.active,
      ...(data.password ? { passwordHash: await bcrypt.hash(data.password, 10) } : {}),
    },
    include: { role: true },
  });
  const { passwordHash, ...safe } = user;
  res.json(safe);
});

// --- Roles ---
const roleSchema = z.object({
  name: requiredText("Role name"),
  permissions: z.record(z.any()),
});

router.get("/roles", requirePermission("roles", "view"), async (_req, res) => {
  res.json(await prisma.role.findMany({ orderBy: { createdAt: "asc" } }));
});

router.post("/roles", requirePermission("roles", "create"), async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  res.status(201).json(await prisma.role.create({ data: parsed.data }));
});

router.put("/roles/:id", requirePermission("roles", "edit"), async (req, res) => {
  const existing = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Role not found");
  const parsed = roleSchema.partial().safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  res.json(await prisma.role.update({ where: { id: req.params.id }, data: parsed.data }));
});

// --- Company settings (single row) ---
const settingsSchema = z.object({
  name: requiredText("Company name"),
  address: z.string().optional().nullable(),
  contacts: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  printFooter: z.string().optional().nullable(),
});

// Every authenticated user needs to see the company name/logo (sidebar,
// gate pass printout) regardless of their role's Settings menu permission,
// so this stays behind requireAuth only, not requirePermission.
router.get("/settings", async (_req, res) => {
  const settings = await prisma.companySetting.findFirst();
  res.json(settings);
});

router.post(
  "/settings/logo",
  requirePermission("settings", "edit"),
  upload.single("logo"),
  async (req, res) => {
    if (!req.file) throw badRequest("No file uploaded");
    const logoUrl = `/uploads/${req.file.filename}`;
    const existing = await prisma.companySetting.findFirst();
    const updated = existing
      ? await prisma.companySetting.update({ where: { id: existing.id }, data: { logoUrl } })
      : await prisma.companySetting.create({ data: { name: "My Company", logoUrl } });
    res.json(updated);
  }
);

router.put("/settings", requirePermission("settings", "edit"), async (req, res) => {
  const parsed = settingsSchema.partial().safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const existing = await prisma.companySetting.findFirst();
  const updated = existing
    ? await prisma.companySetting.update({ where: { id: existing.id }, data: parsed.data })
    : await prisma.companySetting.create({ data: { name: "My Company", ...parsed.data } });
  res.json(updated);
});

export default router;
