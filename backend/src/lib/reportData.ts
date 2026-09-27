import { prisma } from "./prisma";

export interface CommonFilters {
  importerId?: string;
  categoryId?: string;
  chaId?: string;
  from?: Date;
  to?: Date;
}

const createdByInclude = { select: { id: true, name: true } };

export async function getStockSummary(filters: CommonFilters = {}) {
  const containers = await prisma.inboundContainer.findMany({
    where: {
      inbound: {
        status: "ACTIVE",
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.importerId ? { importerId: filters.importerId } : {}),
        ...(filters.chaId ? { chaId: filters.chaId } : {}),
        ...(filters.from || filters.to
          ? { inboundDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
          : {}),
      },
    },
    include: {
      inbound: { include: { importer: true, cha: true, category: true, createdBy: createdByInclude } },
      containerSize: true,
      bay: true,
      crane: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return containers.map((c) => ({
    inboundNumber: c.inbound.inboundNumber,
    arrivalDate: c.inbound.inboundDate,
    inBeNumber: c.inbound.beNumber ?? "",
    inBeDate: c.inbound.beDate,
    importer: c.inbound.importer.name,
    cha: c.inbound.cha?.name ?? "",
    category: c.inbound.category.name,
    containerNumber: c.containerNumber,
    containerSize: c.containerSize.name,
    bay: c.bay?.code ?? "",
    crane: c.crane?.name ?? "",
    weight: c.weight ?? "",
    dutyPaid: c.dutyPaid ? "Yes" : "No",
    received: c.receivedPackages,
    issued: c.receivedPackages - c.remainingPackages,
    balance: c.remainingPackages,
    createdAt: c.inbound.createdAt,
    createdBy: c.inbound.createdBy?.name ?? "",
  }));
}

export async function getOutboundDetail(filters: CommonFilters = {}) {
  const lines = await prisma.outboundLine.findMany({
    where: {
      status: "ACTIVE",
      outbound: {
        status: "ACTIVE",
        ...(filters.from || filters.to
          ? { outboundDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
          : {}),
        inbound: {
          ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
          ...(filters.importerId ? { importerId: filters.importerId } : {}),
          ...(filters.chaId ? { chaId: filters.chaId } : {}),
        },
      },
    },
    include: {
      outbound: {
        include: {
          inbound: { include: { importer: true, cha: true, category: true } },
          inboundContainer: { include: { containerSize: true } },
          createdBy: createdByInclude,
        },
      },
      crane: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return lines.map((l) => ({
    outboundNumber: l.outbound.outboundNumber,
    outboundDate: l.outbound.outboundDate,
    inboundNumber: l.outbound.inbound.inboundNumber,
    importer: l.outbound.inbound.importer.name,
    cha: l.outbound.inbound.cha?.name ?? "",
    category: l.outbound.inbound.category.name,
    containerNumber: l.outbound.inboundContainer.containerNumber,
    truckNumber: l.truckNumber,
    exBeNumber: l.exBeNumber ?? "",
    exBeDate: l.exBeDate,
    crane: l.crane?.name ?? "",
    issuedPackages: l.issuedPackages,
    createdAt: l.outbound.createdAt,
    createdBy: l.outbound.createdBy?.name ?? "",
  }));
}

export interface ConsolidatedGroup {
  inboundId: string;
  inboundNumber: string;
  inboundDate: Date;
  referenceNumber: string;
  importer: string;
  cha: string;
  beNumber: string;
  beDate: Date | null;
  category: string;
  createdAt: Date;
  createdBy: string;
  containers: {
    containerNumber: string;
    containerSize: string;
    bay: string;
    receivedQty: number;
    balanceQty: number;
    exBondLines: {
      outboundNumber: string;
      outDate: Date;
      exBeNumber: string;
      exBeDate: Date | null;
      truckNumber: string;
      issuedQty: number;
    }[];
  }[];
}

/**
 * Consolidated report grouped one block per inbound (like the client's
 * original Excel layout): inbound header info once, then every container
 * with its own ex-bond truck-lines nested underneath. Used for the on-screen
 * "Excel style" view; flattenConsolidated() below turns this into rows for
 * Excel/PDF export.
 */
export async function getConsolidatedGrouped(filters: CommonFilters = {}): Promise<ConsolidatedGroup[]> {
  const inbounds = await prisma.inbound.findMany({
    where: {
      status: "ACTIVE",
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.importerId ? { importerId: filters.importerId } : {}),
      ...(filters.chaId ? { chaId: filters.chaId } : {}),
      ...(filters.from || filters.to
        ? { inboundDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    include: {
      importer: true,
      cha: true,
      category: true,
      createdBy: createdByInclude,
      containers: {
        include: {
          containerSize: true,
          bay: true,
          outboundLines: { where: { status: "ACTIVE" }, include: { outbound: true } },
        },
      },
    },
    orderBy: { inboundDate: "desc" },
  });

  return inbounds.map((inbound) => ({
    inboundId: inbound.id,
    inboundNumber: inbound.inboundNumber,
    inboundDate: inbound.inboundDate,
    referenceNumber: inbound.referenceNumber ?? "",
    importer: inbound.importer.name,
    cha: inbound.cha?.name ?? "",
    beNumber: inbound.beNumber ?? "",
    beDate: inbound.beDate,
    category: inbound.category.name,
    createdAt: inbound.createdAt,
    createdBy: inbound.createdBy?.name ?? "",
    containers: inbound.containers.map((c) => ({
      containerNumber: c.containerNumber,
      containerSize: c.containerSize.name,
      bay: c.bay?.code ?? "",
      receivedQty: c.receivedPackages,
      balanceQty: c.remainingPackages,
      exBondLines: c.outboundLines.map((line) => ({
        outboundNumber: line.outbound.outboundNumber,
        outDate: line.outbound.outboundDate,
        exBeNumber: line.exBeNumber ?? "",
        exBeDate: line.exBeDate,
        truckNumber: line.truckNumber,
        issuedQty: line.issuedPackages,
      })),
    })),
  }));
}

/** Flat row-per-container-or-line shape, for Excel/PDF export. */
export function flattenConsolidated(groups: ConsolidatedGroup[]) {
  const rows: any[] = [];
  for (const g of groups) {
    for (const c of g.containers) {
      const base = {
        inboundNumber: g.inboundNumber,
        inboundDate: g.inboundDate,
        referenceNumber: g.referenceNumber,
        importer: g.importer,
        cha: g.cha,
        beNumber: g.beNumber,
        beDate: g.beDate,
        category: g.category,
        createdAt: g.createdAt,
        createdBy: g.createdBy,
        containerNumber: c.containerNumber,
        containerSize: c.containerSize,
        bay: c.bay,
        receivedQty: c.receivedQty,
        balanceQty: c.balanceQty,
      };
      if (c.exBondLines.length === 0) {
        rows.push({ ...base, outDate: null, exBeNumber: "", truckNumber: "", issuedQty: 0 });
      } else {
        for (const line of c.exBondLines) {
          rows.push({ ...base, outDate: line.outDate, exBeNumber: line.exBeNumber, truckNumber: line.truckNumber, issuedQty: line.issuedQty });
        }
      }
    }
  }
  return rows;
}

export async function getConsolidatedReport(filters: CommonFilters = {}) {
  return flattenConsolidated(await getConsolidatedGrouped(filters));
}

/** Inbound report: one row per inbound entry (header-level), for the
 * Reports > Inbound tab. */
/** Inbound report: one row per container (so container numbers are always
 * visible), for the Reports > Inbound tab. Distinct from Stock Summary by
 * surfacing booking-level fields (Reference No, Cargo) alongside it. */
export async function getInboundReport(filters: CommonFilters = {}) {
  const inbounds = await prisma.inbound.findMany({
    where: {
      status: "ACTIVE",
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.importerId ? { importerId: filters.importerId } : {}),
      ...(filters.chaId ? { chaId: filters.chaId } : {}),
      ...(filters.from || filters.to
        ? { inboundDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    },
    include: {
      importer: true,
      cha: true,
      category: true,
      createdBy: createdByInclude,
      containers: { include: { containerSize: true, bay: true, crane: true } },
    },
    orderBy: { inboundDate: "desc" },
  });

  const rows: any[] = [];
  for (const i of inbounds) {
    for (const c of i.containers) {
      rows.push({
        inboundNumber: i.inboundNumber,
        arrivalDate: i.inboundDate,
        referenceNumber: i.referenceNumber ?? "",
        importer: i.importer.name,
        cha: i.cha?.name ?? "",
        category: i.category.name,
        inBeNumber: i.beNumber ?? "",
        inBeDate: i.beDate,
        cargo: i.goodsDescription ?? "",
        containerNumber: c.containerNumber,
        containerSize: c.containerSize.name,
        bay: c.bay?.code ?? "",
        crane: c.crane?.name ?? "",
        dutyPaid: c.dutyPaid ? "Yes" : "No",
        received: c.receivedPackages,
        balance: c.remainingPackages,
        createdAt: i.createdAt,
        createdBy: i.createdBy?.name ?? "",
      });
    }
  }
  return rows;
}

/** Gate pass report: one row per container/line on the pass (a pass can
 * span several Exbond entries sharing a truck), for the Reports > Gate Pass
 * tab. Date filters apply to the pass's own delivery date; importer/
 * category/CHA filters keep only the lines that actually match, since a
 * single pass can mix entries that do and don't match the filter. */
export async function getGatePassReport(filters: CommonFilters = {}) {
  const gatePasses = await prisma.gatePass.findMany({
    where: {
      status: "ACTIVE",
      ...(filters.from || filters.to
        ? { deliveryDate: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
      ...(filters.importerId || filters.categoryId || filters.chaId
        ? {
            lines: {
              some: {
                outbound: {
                  inbound: {
                    ...(filters.importerId ? { importerId: filters.importerId } : {}),
                    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
                    ...(filters.chaId ? { chaId: filters.chaId } : {}),
                  },
                },
              },
            },
          }
        : {}),
    },
    include: {
      createdBy: createdByInclude,
      lines: {
        include: {
          inboundContainer: { include: { containerSize: true } },
          outbound: { include: { inbound: { include: { importer: true, cha: true, category: true } } } },
        },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  const rows: any[] = [];
  for (const g of gatePasses) {
    for (const line of g.lines) {
      const inbound = line.outbound.inbound;
      if (filters.importerId && inbound.importerId !== filters.importerId) continue;
      if (filters.categoryId && inbound.categoryId !== filters.categoryId) continue;
      if (filters.chaId && inbound.chaId !== filters.chaId) continue;

      rows.push({
        gatePassNumber: g.gatePassNumber,
        deliveryDate: g.deliveryDate,
        truckNumber: g.truckNumber,
        placeFrom: g.placeFrom,
        placeTo: g.placeTo,
        referenceNumber: g.referenceNumber ?? "",
        outboundNumber: line.outbound.outboundNumber,
        importer: inbound.importer.name,
        cha: inbound.cha?.name ?? "",
        category: inbound.category.name,
        containerNumber: line.inboundContainer.containerNumber,
        containerSize: line.inboundContainer.containerSize.name,
        inBeNumber: inbound.beNumber ?? "",
        exBeNumber: line.exBeNumber ?? "",
        issuedPackages: line.issuedPackages,
        createdAt: g.createdAt,
        createdBy: g.createdBy?.name ?? "",
      });
    }
  }
  return rows;
}
