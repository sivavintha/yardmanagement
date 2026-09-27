import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, notFound } from "../lib/errors";
import { AuthedRequest, requireAuth, requirePermission } from "../middleware/auth";
import { getPageParams, paginatedResponse } from "../lib/pagination";
import { nextNumber } from "../lib/sequence";
import { requiredText } from "../lib/validation";

const router = Router();
router.use(requireAuth);

// Gate Pass is truck-centric: pick a truck number, pull in every ACTIVE
// OutboundLine (across any Outbound/Exbond entries — different containers,
// different BEs) that shares that truck number and isn't already on
// another gate pass, per the confirmed phase-2 model.
const createSchema = z.object({
  truckNumber: requiredText("Truck No"),
  placeFrom: requiredText("Place From"),
  placeTo: requiredText("Place To"),
  referenceNumber: z.string().optional().nullable(),
  deliveryDate: z.coerce.date(),
});

const gatePassInclude = {
  createdBy: { select: { id: true, name: true } },
  lines: {
    include: {
      inboundContainer: { include: { containerSize: true } },
      crane: true,
      outbound: { include: { inbound: { include: { importer: true, cha: true, category: true } } } },
    },
  },
};

router.get("/", requirePermission("gatepass", "view"), async (req, res) => {
  const { q } = req.query as Record<string, string>;
  const where = q
    ? {
        OR: [
          { gatePassNumber: { contains: q, mode: "insensitive" as const } },
          { truckNumber: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  if (req.query.page || req.query.pageSize) {
    const params = getPageParams(req, ["issuedAt", "gatePassNumber"], "issuedAt");
    const [items, total] = await Promise.all([
      prisma.gatePass.findMany({ where, include: gatePassInclude, orderBy: params.orderBy, skip: params.skip, take: params.take }),
      prisma.gatePass.count({ where }),
    ]);
    return res.json(paginatedResponse(items, total, params));
  }

  const gatePasses = await prisma.gatePass.findMany({ where, include: gatePassInclude, orderBy: { issuedAt: "desc" } });
  res.json(gatePasses);
});

// Distinct truck numbers that currently have at least one ACTIVE,
// not-yet-gate-passed line — what the entry screen's "pick a truck" step
// searches against.
router.get("/available-trucks", requirePermission("gatepass", "create"), async (req, res) => {
  const { q } = req.query as Record<string, string>;
  const lines = await prisma.outboundLine.findMany({
    where: {
      status: "ACTIVE",
      gatePassId: null,
      outbound: { status: "ACTIVE" },
      ...(q ? { truckNumber: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: { truckNumber: true },
    distinct: ["truckNumber"],
  });
  res.json(lines.map((l) => l.truckNumber));
});

// Preview: every active, not-yet-passed line for a given truck number,
// across all Outbound entries — shown to the user before they confirm.
router.get("/preview/:truckNumber", requirePermission("gatepass", "create"), async (req, res) => {
  const lines = await prisma.outboundLine.findMany({
    where: { status: "ACTIVE", gatePassId: null, truckNumber: req.params.truckNumber, outbound: { status: "ACTIVE" } },
    include: {
      inboundContainer: { include: { containerSize: true } },
      crane: true,
      outbound: { include: { inbound: { include: { importer: true, cha: true, category: true } } } },
    },
  });
  res.json(lines);
});

router.post("/", requirePermission("gatepass", "create"), async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const data = parsed.data;

  const gatePass = await prisma.$transaction(async (tx) => {
    // Lock every matching line so a concurrent gate pass request against the
    // same truck can't grab the same lines twice.
    const lineIds = await tx.$queryRaw<{ id: string }[]>`
      SELECT ol.id FROM "OutboundLine" ol
      JOIN "Outbound" o ON o.id = ol."outboundId"
      WHERE ol."truckNumber" = ${data.truckNumber}
        AND ol.status = 'ACTIVE' AND ol."gatePassId" IS NULL AND o.status = 'ACTIVE'
      FOR UPDATE OF ol`;

    if (lineIds.length === 0) {
      throw conflict("No active, unpassed lines found for this truck number — someone may have just used them");
    }

    const gatePassNumber = await nextNumber(tx, "gatepass");
    const created = await tx.gatePass.create({
      data: {
        gatePassNumber,
        truckNumber: data.truckNumber,
        placeFrom: data.placeFrom,
        placeTo: data.placeTo,
        referenceNumber: data.referenceNumber,
        deliveryDate: data.deliveryDate,
        createdById: req.user!.id,
      },
    });

    await tx.outboundLine.updateMany({
      where: { id: { in: lineIds.map((l) => l.id) } },
      data: { gatePassId: created.id },
    });

    return tx.gatePass.findUniqueOrThrow({ where: { id: created.id }, include: gatePassInclude });
  });

  res.status(201).json(gatePass);
});

router.get("/:id", requirePermission("gatepass", "view"), async (req, res) => {
  const gatePass = await prisma.gatePass.findUnique({ where: { id: req.params.id }, include: gatePassInclude });
  if (!gatePass) throw notFound("Gate pass not found");
  res.json(gatePass);
});

router.get("/:id/print", requirePermission("gatepass", "print"), async (req, res) => {
  const gatePass = await prisma.gatePass.update({
    where: { id: req.params.id },
    data: { printCount: { increment: 1 } },
    include: gatePassInclude,
  });
  res.json(gatePass);
});

// Voiding releases every line back to "available" (gatePassId cleared) so
// it can be picked up by a future gate pass.
router.post("/:id/void", requirePermission("gatepass", "void"), async (req, res) => {
  const gatePass = await prisma.gatePass.findUnique({ where: { id: req.params.id } });
  if (!gatePass) throw notFound("Gate pass not found");
  if (gatePass.status === "VOID") throw conflict("Already voided");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.outboundLine.updateMany({ where: { gatePassId: gatePass.id }, data: { gatePassId: null } });
    return tx.gatePass.update({ where: { id: gatePass.id }, data: { status: "VOID" } });
  });
  res.json(updated);
});

export default router;
