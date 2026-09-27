import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { requiredText } from "../lib/validation";
import { AuthedRequest, requireAuth, requirePermission } from "../middleware/auth";
import { getPageParams, paginatedResponse } from "../lib/pagination";
import { nextNumber } from "../lib/sequence";

const router = Router();
router.use(requireAuth);

// Container numbers: 4 letters + 7 digits (ISO 6346 style), the standard
// shipping-container format — matches the "container no validation" ask.
// ISO 6346 shipping container format: 4 letters (owner code + category) +
// 7 digits (serial + check digit) = 11 characters, sometimes written with a
// hyphen before the final check digit (e.g. "MSCU630889-3").
const CONTAINER_NUMBER_RE = /^[A-Za-z]{4}\d{6}-?\d$/;

const containerSchema = z.object({
  containerNumber: z.string().regex(CONTAINER_NUMBER_RE, "Container number must look like ABCD1234567"),
  containerSizeId: z.string().min(1),
  bayId: z.string().min(1, "Bay is required"),
  craneId: z.string().optional().nullable(),
  weight: z.number().optional().nullable(),
  dutyPaid: z.boolean().optional(),
  receivedPackages: z.number().int().positive(),
  remarks: z.string().optional().nullable(),
});

// inboundNumber is server-generated — never accepted from the client.
const inboundSchema = z.object({
  inboundDate: z.coerce.date(),
  referenceNumber: z.string().optional().nullable(),
  importerId: z.string().min(1),
  chaId: z.string().optional().nullable(),
  beNumber: requiredText("In BE No"),
  beDate: z.coerce.date({ required_error: "In BE Date is required" }),
  goodsDescription: z.string().optional().nullable(),
  categoryId: z.string().min(1),
  containers: z.array(containerSchema).min(1, "At least one container is required"),
});

const inboundInclude = {
  importer: true,
  cha: true,
  category: true,
  createdBy: { select: { id: true, name: true } },
  containers: { include: { containerSize: true, bay: true, crane: true } },
};


router.get("/", requirePermission("inbound", "view"), async (req, res) => {
  const { status, importerId, categoryId, chaId, from, to, q } = req.query as Record<string, string>;
  const where = {
    ...(status ? { status: status as any } : {}),
    ...(importerId ? { importerId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(chaId ? { chaId } : {}),
    ...(from || to
      ? {
          inboundDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { inboundNumber: { contains: q, mode: "insensitive" as const } },
            { referenceNumber: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  if (req.query.page || req.query.pageSize) {
    const params = getPageParams(req, ["inboundDate", "inboundNumber", "totalPackages", "createdAt"], "createdAt");
    const [items, total] = await Promise.all([
      prisma.inbound.findMany({ where, include: inboundInclude, orderBy: params.orderBy, skip: params.skip, take: params.take }),
      prisma.inbound.count({ where }),
    ]);
    return res.json(paginatedResponse(items, total, params));
  }

  const inbounds = await prisma.inbound.findMany({ where, include: inboundInclude, orderBy: { createdAt: "desc" } });
  res.json(inbounds);
});

router.get("/:id", requirePermission("inbound", "view"), async (req, res) => {
  const inbound = await prisma.inbound.findUnique({
    where: { id: req.params.id },
    include: {
      importer: true,
      cha: true,
      category: true,
      containers: { include: { containerSize: true, bay: true, crane: true, outboundLines: true } },
      outbounds: { include: { lines: true } },
    },
  });
  if (!inbound) throw notFound("Inbound not found");
  res.json(inbound);
});

router.post("/", requirePermission("inbound", "create"), async (req: AuthedRequest, res) => {
  const parsed = inboundSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const data = parsed.data;

  const totalPackages = data.containers.reduce((sum, c) => sum + c.receivedPackages, 0);

  const inbound = await prisma.$transaction(async (tx) => {
    const inboundNumber = await nextNumber(tx, "inbound");
    return tx.inbound.create({
      data: {
        inboundNumber,
        inboundDate: data.inboundDate,
        referenceNumber: data.referenceNumber,
        importerId: data.importerId,
        chaId: data.chaId,
        beNumber: data.beNumber,
        beDate: data.beDate,
        goodsDescription: data.goodsDescription,
        categoryId: data.categoryId,
        totalPackages,
        createdById: req.user!.id,
        containers: {
          create: data.containers.map((c) => ({
            containerNumber: c.containerNumber,
            containerSizeId: c.containerSizeId,
            bayId: c.bayId ?? null,
            craneId: c.craneId ?? null,
            weight: c.weight ?? null,
            dutyPaid: c.dutyPaid ?? false,
            receivedPackages: c.receivedPackages,
            remainingPackages: c.receivedPackages,
            remarks: c.remarks,
          })),
        },
      },
      include: inboundInclude,
    });
  });

  res.status(201).json(inbound);
});

// Rule: once an outbound exists for an inbound, its stock-affecting inbound
// fields and containers are locked. Only non-stock-affecting metadata may change.
const editableWhenLocked = new Set(["referenceNumber", "chaId", "beNumber", "beDate", "goodsDescription"]);

router.put("/:id", requirePermission("inbound", "edit"), async (req, res) => {
  const inbound = await prisma.inbound.findUnique({
    where: { id: req.params.id },
    include: { outbounds: { where: { status: "ACTIVE" } } },
  });
  if (!inbound) throw notFound("Inbound not found");
  if (inbound.status === "VOID") throw conflict("Voided inbounds cannot be edited");

  const hasOutbound = inbound.outbounds.length > 0;

  const parsed = inboundSchema.partial({ containers: true as any }).safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const data: any = parsed.data;

  if (hasOutbound) {
    const attemptedKeys = Object.keys(data);
    const disallowed = attemptedKeys.filter((k) => !editableWhenLocked.has(k) && data[k] !== undefined);
    if (disallowed.length > 0 || data.containers) {
      throw conflict(
        "This inbound has active outbounds; stock-affecting fields and containers are locked. Only reference/CHA/BE/cargo details can be edited."
      );
    }
  }

  let totalPackages = inbound.totalPackages;
  let containerOps: any[] | undefined;
  if (!hasOutbound && data.containers) {
    totalPackages = data.containers.reduce((s: number, c: any) => s + c.receivedPackages, 0);
    containerOps = data.containers;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (containerOps) {
      await tx.inboundContainer.deleteMany({ where: { inboundId: inbound.id } });
      await tx.inboundContainer.createMany({
        data: containerOps.map((c: any) => ({
          inboundId: inbound.id,
          containerNumber: c.containerNumber,
          containerSizeId: c.containerSizeId,
          bayId: c.bayId ?? null,
          craneId: c.craneId ?? null,
          weight: c.weight ?? null,
          dutyPaid: c.dutyPaid ?? false,
          receivedPackages: c.receivedPackages,
          remainingPackages: c.receivedPackages,
          remarks: c.remarks,
        })),
      });
    }
    return tx.inbound.update({
      where: { id: inbound.id },
      data: {
        referenceNumber: data.referenceNumber ?? undefined,
        chaId: data.chaId ?? undefined,
        beNumber: data.beNumber ?? undefined,
        beDate: data.beDate ?? undefined,
        goodsDescription: data.goodsDescription ?? undefined,
        importerId: !hasOutbound ? data.importerId ?? undefined : undefined,
        categoryId: !hasOutbound ? data.categoryId ?? undefined : undefined,
        inboundDate: data.inboundDate ?? undefined,
        totalPackages,
      },
      include: inboundInclude,
    });
  });

  res.json(updated);
});

router.post("/:id/void", requirePermission("inbound", "void"), async (req, res) => {
  const inbound = await prisma.inbound.findUnique({
    where: { id: req.params.id },
    include: { outbounds: { where: { status: "ACTIVE" } } },
  });
  if (!inbound) throw notFound("Inbound not found");
  if (inbound.status === "VOID") throw conflict("Already voided");

  if (inbound.outbounds.length > 0) {
    throw conflict("Cannot void an inbound that has active outbounds against it");
  }

  const updated = await prisma.inbound.update({ where: { id: inbound.id }, data: { status: "VOID" } });
  res.json(updated);
});

export default router;
