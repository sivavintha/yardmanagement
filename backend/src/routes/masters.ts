import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { AuthedRequest, requireAuth, requirePermission } from "../middleware/auth";
import { nextNumber } from "../lib/sequence";
import { getPageParams, paginatedResponse } from "../lib/pagination";
import { requiredText } from "../lib/validation";

const router = Router();
router.use(requireAuth);

// Shared list handler: paginated when ?page=/?pageSize= are present (search
// by name/code via ?q=), otherwise the old plain-array shape for callers
// that just want "all active options" (e.g. populating a dropdown).
function listHandler(model: any, searchFields: string[]) {
  return async (req: any, res: any) => {
    const { q, active } = req.query as Record<string, string>;
    const where = {
      ...(active !== undefined ? { active: active === "true" } : {}),
      ...(q
        ? { OR: searchFields.map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })) }
        : {}),
    };

    if (req.query.page || req.query.pageSize) {
      const params = getPageParams(req, ["name", "code", "createdAt"], "createdAt");
      const [items, total] = await Promise.all([
        model.findMany({ where, orderBy: params.orderBy, skip: params.skip, take: params.take }),
        model.count({ where }),
      ]);
      return res.json(paginatedResponse(items, total, params));
    }

    res.json(await model.findMany({ where, orderBy: { createdAt: "desc" } }));
  };
}


// Generic factory for auto-coded lookup masters (Importer, CHA, Bay, Crane).
// - `code` is system-generated on create and can never be edited afterwards.
// - Delete is a hard delete, but only for superadmins, and only if the
//   record isn't referenced anywhere; otherwise it's blocked outright (no
//   more silent soft-disable-instead) per the phase-2 spec.
function masterRouter(opts: {
  model: any;
  sequenceKey: Parameters<typeof nextNumber>[1];
  usageChecks: (id: string) => Promise<boolean>;
  schema: z.AnyZodObject; // fields other than `code`
  searchFields?: string[];
}) {
  const r = Router();

  r.get("/", requirePermission("masters", "view"), listHandler(opts.model, opts.searchFields ?? ["name", "code"]));

  r.post("/", requirePermission("masters", "create"), async (req, res) => {
    const parsed = opts.schema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));

    const created = await prisma.$transaction(async (tx) => {
      const code = await nextNumber(tx, opts.sequenceKey);
      return opts.model.create({ data: { ...parsed.data, code } });
    });
    res.status(201).json(created);
  });

  r.put("/:id", requirePermission("masters", "edit"), async (req, res) => {
    const existing = await opts.model.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Not found");
    // `code` is never editable once created — silently drop it if sent.
    const { code, ...rest } = req.body ?? {};
    const parsed = opts.schema.partial().safeParse(rest);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
    res.json(await opts.model.update({ where: { id: req.params.id }, data: parsed.data }));
  });

  r.delete("/:id", requirePermission("masters", "edit"), async (req: AuthedRequest, res) => {
    if (req.user!.roleName !== "Superadmin") {
      throw forbidden("Only a superadmin can delete master records");
    }
    const existing = await opts.model.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Not found");
    const inUse = await opts.usageChecks(req.params.id);
    if (inUse) {
      throw conflict("This record is already used in one or more transactions and cannot be deleted. Disable it instead.");
    }
    await opts.model.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  });

  return r;
}

// Simpler factory for masters that don't have a system-generated code
// (StockCategory, ContainerSize) — same superadmin-only, block-if-used
// delete semantics, just no `code` field to manage.
function simpleMasterRouter(opts: {
  model: any;
  usageChecks: (id: string) => Promise<boolean>;
  schema: z.AnyZodObject;
}) {
  const r = Router();

  r.get("/", requirePermission("masters", "view"), listHandler(opts.model, ["name"]));

  r.post("/", requirePermission("masters", "create"), async (req, res) => {
    const parsed = opts.schema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
    res.status(201).json(await opts.model.create({ data: parsed.data }));
  });

  r.put("/:id", requirePermission("masters", "edit"), async (req, res) => {
    const existing = await opts.model.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Not found");
    const parsed = opts.schema.partial().safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
    res.json(await opts.model.update({ where: { id: req.params.id }, data: parsed.data }));
  });

  r.delete("/:id", requirePermission("masters", "edit"), async (req: AuthedRequest, res) => {
    if (req.user!.roleName !== "Superadmin") {
      throw forbidden("Only a superadmin can delete master records");
    }
    const existing = await opts.model.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Not found");
    const inUse = await opts.usageChecks(req.params.id);
    if (inUse) {
      throw conflict("This record is already used in one or more transactions and cannot be deleted. Disable it instead.");
    }
    await opts.model.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  });

  return r;
}

router.use(
  "/importers",
  masterRouter({
    model: prisma.importer,
    sequenceKey: "importer",
    schema: z.object({
      name: requiredText("Name"),
      address1: z.string().optional().nullable(),
      address2: z.string().optional().nullable(),
      address3: z.string().optional().nullable(),
      address4: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      pincode: z.string().optional().nullable(),
      phone: z.string().regex(/^[0-9+\-\s]*$/, "Phone must be a valid number").optional().nullable(),
      email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
      contactPerson: z.string().optional().nullable(),
      active: z.boolean().optional(),
    }),
    usageChecks: async (id) => (await prisma.inbound.count({ where: { importerId: id } })) > 0,
  })
);

router.use(
  "/chas",
  masterRouter({
    model: prisma.cha,
    sequenceKey: "cha",
    schema: z.object({
      name: requiredText("Name"),
      address1: z.string().optional().nullable(),
      address2: z.string().optional().nullable(),
      address3: z.string().optional().nullable(),
      address4: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      pincode: z.string().optional().nullable(),
      phone: z.string().regex(/^[0-9+\-\s]*$/, "Phone must be a valid number").optional().nullable(),
      email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
      contactPerson: z.string().optional().nullable(),
      active: z.boolean().optional(),
    }),
    usageChecks: async (id) => (await prisma.inbound.count({ where: { chaId: id } })) > 0,
  })
);

router.use(
  "/bays",
  masterRouter({
    model: prisma.bay,
    sequenceKey: "bay",
    schema: z.object({ description: z.string().optional().nullable(), active: z.boolean().optional() }),
    usageChecks: async (id) => (await prisma.inboundContainer.count({ where: { bayId: id } })) > 0,
    searchFields: ["code", "description"],
  })
);

router.use(
  "/cranes",
  masterRouter({
    model: prisma.crane,
    sequenceKey: "crane",
    schema: z.object({ name: requiredText("Name"), active: z.boolean().optional() }),
    usageChecks: async (id) =>
      (await prisma.inboundContainer.count({ where: { craneId: id } })) +
        (await prisma.outboundLine.count({ where: { craneId: id } })) >
      0,
  })
);

router.use(
  "/stock-categories",
  simpleMasterRouter({
    model: prisma.stockCategory,
    schema: z.object({ name: requiredText("Name"), active: z.boolean().optional() }),
    usageChecks: async (id) => (await prisma.inbound.count({ where: { categoryId: id } })) > 0,
  })
);

router.use(
  "/container-sizes",
  simpleMasterRouter({
    model: prisma.containerSize,
    schema: z.object({ name: requiredText("Name"), active: z.boolean().optional() }),
    usageChecks: async (id) => (await prisma.inboundContainer.count({ where: { containerSizeId: id } })) > 0,
  })
);

export default router;
