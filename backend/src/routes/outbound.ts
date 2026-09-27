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

// Outbound (Exbond) = ONE inbound container, plus any number of truck-lines
// splitting that single container's logs across multiple trucks. Each line
// can carry its own Ex-BE No/Date and Crane. (Weight was removed from the
// Outbound side per client request — still tracked on Inbound containers.)
const lineSchema = z.object({
  truckNumber: requiredText("Truck No"),
  issuedPackages: z.number().int().positive(),
  exBeNumber: requiredText("Ex-BE No"),
  exBeDate: z.coerce.date({ required_error: "Ex-BE Date is required" }),
  craneId: z.string().optional().nullable(),
});

// outboundNumber is server-generated — never accepted from the client.
const outboundSchema = z.object({
  outboundDate: z.coerce.date(),
  referenceNumber: z.string().optional().nullable(),
  inboundId: z.string().min(1),
  inboundContainerId: z.string().min(1),
  remarks: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1, "At least one truck line is required"),
});

const outboundInclude = {
  inbound: { include: { importer: true, cha: true, category: true } },
  inboundContainer: { include: { containerSize: true } },
  lines: { include: { crane: true, gatePass: true } },
  createdBy: { select: { id: true, name: true } },
};

function summarize(outbound: any) {
  const totalIssued = outbound.lines.reduce((s: number, l: any) => s + l.issuedPackages, 0);
  const trucks = Array.from(new Set(outbound.lines.map((l: any) => l.truckNumber)));
  const gatePassed = outbound.lines.every((l: any) => l.gatePassId);
  return { ...outbound, totalIssuedPackages: totalIssued, truckCount: trucks.length, trucks, fullyGatePassed: gatePassed };
}

// GET /api/outbounds — "Summary" tab: one row per outbound header.
router.get("/", requirePermission("outbound", "view"), async (req, res) => {
  const { status, importerId, categoryId, from, to, q } = req.query as Record<string, string>;
  const where = {
    ...(status ? { status: status as any } : {}),
    ...(from || to
      ? {
          outboundDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(importerId ? { inbound: { importerId } } : {}),
    ...(categoryId ? { inbound: { categoryId } } : {}),
    ...(q
      ? {
          OR: [
            { outboundNumber: { contains: q, mode: "insensitive" as const } },
            { inbound: { inboundNumber: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  if (req.query.page || req.query.pageSize) {
    const params = getPageParams(req, ["outboundDate", "outboundNumber", "createdAt"], "createdAt");
    const [items, total] = await Promise.all([
      prisma.outbound.findMany({ where, include: outboundInclude, orderBy: params.orderBy, skip: params.skip, take: params.take }),
      prisma.outbound.count({ where }),
    ]);
    return res.json(paginatedResponse(items.map(summarize), total, params));
  }

  const outbounds = await prisma.outbound.findMany({ where, include: outboundInclude, orderBy: { createdAt: "desc" } });
  res.json(outbounds.map(summarize));
});

// GET /api/outbounds/detail — "Detail" tab: one row per truck line.
router.get("/detail", requirePermission("outbound", "view"), async (req, res) => {
  const { status, importerId, categoryId, from, to, q } = req.query as Record<string, string>;
  const where = {
    ...(status ? { status: status as any } : {}),
    outbound: {
      ...(from || to
        ? { outboundDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
      ...(importerId ? { inbound: { importerId } } : {}),
      ...(categoryId ? { inbound: { categoryId } } : {}),
      ...(q ? { outboundNumber: { contains: q, mode: "insensitive" as const } } : {}),
    },
  };

  const include = {
    outbound: { include: { inbound: { include: { importer: true, cha: true, category: true } }, inboundContainer: { include: { containerSize: true } } } },
    crane: true,
    gatePass: true,
  };

  if (req.query.page || req.query.pageSize) {
    const params = getPageParams(req, ["createdAt", "truckNumber", "issuedPackages"], "createdAt");
    const [items, total] = await Promise.all([
      prisma.outboundLine.findMany({ where, include, orderBy: params.orderBy, skip: params.skip, take: params.take }),
      prisma.outboundLine.count({ where }),
    ]);
    return res.json(paginatedResponse(items, total, params));
  }

  const lines = await prisma.outboundLine.findMany({ where, include, orderBy: { createdAt: "desc" } });
  res.json(lines);
});

router.get("/:id", requirePermission("outbound", "view"), async (req, res) => {
  const outbound = await prisma.outbound.findUnique({ where: { id: req.params.id }, include: outboundInclude });
  if (!outbound) throw notFound("Outbound not found");
  res.json(summarize(outbound));
});

// Row-locks the chosen container so concurrent partial-outbound submissions
// can't both pass balance validation against a stale value.
router.post("/", requirePermission("outbound", "create"), async (req: AuthedRequest, res) => {
  const parsed = outboundSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const data = parsed.data;

  const inbound = await prisma.inbound.findUnique({ where: { id: data.inboundId } });
  if (!inbound) throw notFound("Selected inbound not found");
  if (inbound.status !== "ACTIVE") throw conflict("Cannot issue against a voided inbound");

  const totalRequested = data.lines.reduce((s, l) => s + l.issuedPackages, 0);

  const outbound = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; remainingPackages: number; inboundId: string }[]>`
      SELECT id, "remainingPackages", "inboundId" FROM "InboundContainer"
      WHERE id = ${data.inboundContainerId}
      FOR UPDATE`;

    if (locked.length === 0) throw notFound("Selected container not found");
    const container = locked[0];
    if (container.inboundId !== data.inboundId) {
      throw badRequest("Selected container does not belong to the chosen inbound");
    }
    if (totalRequested > container.remainingPackages) {
      throw conflict(`Total issued packages (${totalRequested}) exceed remaining balance (${container.remainingPackages})`);
    }

    await tx.inboundContainer.update({
      where: { id: data.inboundContainerId },
      data: { remainingPackages: { decrement: totalRequested } },
    });

    const outboundNumber = await nextNumber(tx, "outbound");

    return tx.outbound.create({
      data: {
        outboundNumber,
        outboundDate: data.outboundDate,
        referenceNumber: data.referenceNumber,
        inboundId: data.inboundId,
        inboundContainerId: data.inboundContainerId,
        remarks: data.remarks,
        createdById: req.user!.id,
        lines: {
          create: data.lines.map((l) => ({
            inboundContainerId: data.inboundContainerId,
            truckNumber: l.truckNumber,
            issuedPackages: l.issuedPackages,
            exBeNumber: l.exBeNumber,
            exBeDate: l.exBeDate,
            craneId: l.craneId,
          })),
        },
      },
      include: outboundInclude,
    });
  });

  res.status(201).json(summarize(outbound));
});

// Editable (replace-all-lines) until any line has been pulled into a gate
// pass. Adjusts the container balance by the delta between old and new
// total, inside the same locked transaction.
router.put("/:id", requirePermission("outbound", "edit"), async (req, res) => {
  const existing = await prisma.outbound.findUnique({ where: { id: req.params.id }, include: { lines: true } });
  if (!existing) throw notFound("Outbound not found");
  if (existing.status === "VOID") throw conflict("Voided outbounds cannot be edited");
  if (existing.lines.some((l) => l.gatePassId)) {
    throw conflict("This outbound has lines already on a gate pass and can no longer be edited");
  }

  const parsed = outboundSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const data = parsed.data;

  if (data.inboundContainerId !== existing.inboundContainerId) {
    throw badRequest("Changing the container on an existing outbound isn't supported — void and re-create instead");
  }

  const oldTotal = existing.lines.reduce((s, l) => s + l.issuedPackages, 0);
  const newTotal = data.lines.reduce((s, l) => s + l.issuedPackages, 0);
  const delta = newTotal - oldTotal;

  const updated = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ remainingPackages: number }[]>`
      SELECT "remainingPackages" FROM "InboundContainer" WHERE id = ${existing.inboundContainerId} FOR UPDATE`;
    if (delta > 0 && delta > locked[0].remainingPackages) {
      throw conflict(`Increasing issued packages by ${delta} exceeds remaining balance (${locked[0].remainingPackages})`);
    }

    await tx.inboundContainer.update({
      where: { id: existing.inboundContainerId },
      data: { remainingPackages: { decrement: delta } },
    });

    await tx.outboundLine.deleteMany({ where: { outboundId: existing.id } });

    return tx.outbound.update({
      where: { id: existing.id },
      data: {
        outboundDate: data.outboundDate,
        referenceNumber: data.referenceNumber,
        remarks: data.remarks,
        lines: {
          create: data.lines.map((l) => ({
            inboundContainerId: existing.inboundContainerId,
            truckNumber: l.truckNumber,
            issuedPackages: l.issuedPackages,
            exBeNumber: l.exBeNumber,
            exBeDate: l.exBeDate,
            craneId: l.craneId,
          })),
        },
      },
      include: outboundInclude,
    });
  });

  res.json(summarize(updated));
});

router.post("/:id/void", requirePermission("outbound", "void"), async (req, res) => {
  const outbound = await prisma.outbound.findUnique({ where: { id: req.params.id }, include: { lines: true } });
  if (!outbound) throw notFound("Outbound not found");
  if (outbound.status === "VOID") throw conflict("Already voided");
  if (outbound.lines.some((l) => l.gatePassId)) {
    throw conflict("Void the gate pass(es) covering this outbound's lines before voiding it");
  }

  const totalIssued = outbound.lines.reduce((s, l) => s + l.issuedPackages, 0);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.inboundContainer.update({
      where: { id: outbound.inboundContainerId },
      data: { remainingPackages: { increment: totalIssued } },
    });
    await tx.outboundLine.updateMany({ where: { outboundId: outbound.id }, data: { status: "VOID" } });
    return tx.outbound.update({ where: { id: outbound.id }, data: { status: "VOID" } });
  });

  res.json(updated);
});

export default router;
