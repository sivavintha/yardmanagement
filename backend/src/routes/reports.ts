import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  CommonFilters,
  getConsolidatedGrouped,
  getConsolidatedReport,
  getGatePassReport,
  getInboundReport,
  getOutboundDetail,
  getStockSummary,
} from "../lib/reportData";
import {
  buildConsolidatedExcelLegacyStyle,
  buildGatePassExcel,
  buildInboundExcel,
  buildOutboundDetailExcel,
  buildSimplePdf,
  buildStockSummaryExcel,
  gatePassPdfTable,
  inboundPdfTable,
  stockSummaryPdfTable,
  outboundDetailPdfTable,
  consolidatedPdfTable,
} from "../lib/reportFiles";

const router = Router();
router.use(requireAuth);

function parseFilters(q: Record<string, string>): CommonFilters {
  return {
    importerId: q.importerId || undefined,
    categoryId: q.categoryId || undefined,
    chaId: q.chaId || undefined,
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
  };
}

router.get("/stock-summary", requirePermission("reports", "view"), async (req, res) => {
  const rows = await getStockSummary(parseFilters(req.query as Record<string, string>));
  res.json(rows);
});

router.get("/inbound", requirePermission("reports", "view"), async (req, res) => {
  const rows = await getInboundReport(parseFilters(req.query as Record<string, string>));
  res.json(rows);
});

router.get("/gate-pass", requirePermission("reports", "view"), async (req, res) => {
  const rows = await getGatePassReport(parseFilters(req.query as Record<string, string>));
  res.json(rows);
});

router.get("/outbound-detail", requirePermission("reports", "view"), async (req, res) => {
  const rows = await getOutboundDetail(parseFilters(req.query as Record<string, string>));
  res.json(rows);
});

router.get("/consolidated", requirePermission("reports", "view"), async (req, res) => {
  const rows = await getConsolidatedReport(parseFilters(req.query as Record<string, string>));
  res.json(rows);
});

// Grouped-by-inbound shape for the "Excel style" on-screen view.
router.get("/consolidated/grouped", requirePermission("reports", "view"), async (req, res) => {
  const groups = await getConsolidatedGrouped(parseFilters(req.query as Record<string, string>));
  res.json(groups);
});

// POST /api/reports/generate  { type: "stock-summary" | "outbound-detail" | "consolidated", format: "excel" | "pdf", ...filters }
router.post("/generate", requirePermission("reports", "export"), async (req, res) => {
  const { type, format, ...rest } = req.body as { type: string; format: "excel" | "pdf" } & Record<string, string>;
  const filters = parseFilters(rest);

  if (type === "stock-summary") {
    const rows = await getStockSummary(filters);
    if (format === "pdf") {
      const t = stockSummaryPdfTable(rows);
      const buf = await buildSimplePdf("Stock Summary", t.columns, t.rows);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="stock-summary.pdf"');
      return res.send(buf);
    }
    const buf = await buildStockSummaryExcel(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="stock-summary.xlsx"');
    return res.send(buf);
  }

  if (type === "inbound") {
    const rows = await getInboundReport(filters);
    if (format === "pdf") {
      const t = inboundPdfTable(rows);
      const buf = await buildSimplePdf("Inbound Report", t.columns, t.rows);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="inbound.pdf"');
      return res.send(buf);
    }
    const buf = await buildInboundExcel(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="inbound.xlsx"');
    return res.send(buf);
  }

  if (type === "gate-pass") {
    const rows = await getGatePassReport(filters);
    if (format === "pdf") {
      const t = gatePassPdfTable(rows);
      const buf = await buildSimplePdf("Gate Pass Report", t.columns, t.rows);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="gate-pass.pdf"');
      return res.send(buf);
    }
    const buf = await buildGatePassExcel(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="gate-pass.xlsx"');
    return res.send(buf);
  }

  if (type === "outbound-detail") {
    const rows = await getOutboundDetail(filters);
    if (format === "pdf") {
      const t = outboundDetailPdfTable(rows);
      const buf = await buildSimplePdf("Outbound Detail", t.columns, t.rows);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="outbound-detail.pdf"');
      return res.send(buf);
    }
    const buf = await buildOutboundDetailExcel(rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="outbound-detail.xlsx"');
    return res.send(buf);
  }

  if (type === "consolidated") {
    if (format === "pdf") {
      const rows = await getConsolidatedReport(filters);
      const t = consolidatedPdfTable(rows);
      const buf = await buildSimplePdf("Consolidated Report", t.columns, t.rows);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="consolidated.pdf"');
      return res.send(buf);
    }
    // Excel export uses the legacy grouped layout (one block per inbound,
    // merged header cells, UNITS/TOTAL LOGS summary rows) rather than the
    // flat row-per-line shape, per the client's reference sheet.
    const groups = await getConsolidatedGrouped(filters);
    const buf = await buildConsolidatedExcelLegacyStyle(groups, "Consolidated");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="consolidated.xlsx"');
    return res.send(buf);
  }

  res.status(400).json({ error: "Unknown report type" });
});

export default router;
