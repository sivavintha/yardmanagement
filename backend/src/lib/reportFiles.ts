import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

export async function buildStockSummaryExcel(rows: Awaited<ReturnType<any>>) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Stock Summary");
  ws.columns = [
    { header: "Inbound No.", key: "inboundNumber", width: 16 },
    { header: "Arrival Date", key: "arrivalDate", width: 14 },
    { header: "In BE No.", key: "inBeNumber", width: 16 },
    { header: "In BE Date", key: "inBeDate", width: 14 },
    { header: "Importer", key: "importer", width: 22 },
    { header: "CHA", key: "cha", width: 18 },
    { header: "Category", key: "category", width: 14 },
    { header: "Container No.", key: "containerNumber", width: 16 },
    { header: "Size", key: "containerSize", width: 10 },
    { header: "Bay", key: "bay", width: 10 },
    { header: "Crane", key: "crane", width: 10 },
    { header: "Weight", key: "weight", width: 10 },
    { header: "Duty Paid", key: "dutyPaid", width: 10 },
    { header: "Received", key: "received", width: 10 },
    { header: "Issued", key: "issued", width: 10 },
    { header: "Balance", key: "balance", width: 10 },
    { header: "Created Date", key: "createdAt", width: 14 },
    { header: "Created By", key: "createdBy", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      ...r,
      arrivalDate: new Date(r.arrivalDate).toLocaleDateString("en-IN"),
      inBeDate: r.inBeDate ? new Date(r.inBeDate).toLocaleDateString("en-IN") : "",
      createdAt: new Date(r.createdAt).toLocaleDateString("en-IN"),
    });
  }
  return wb.xlsx.writeBuffer();
}

export async function buildOutboundDetailExcel(rows: Awaited<ReturnType<any>>) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Outbound Detail");
  ws.columns = [
    { header: "Outbound No.", key: "outboundNumber", width: 16 },
    { header: "Outbound Date", key: "outboundDate", width: 14 },
    { header: "Inbound No.", key: "inboundNumber", width: 16 },
    { header: "Importer", key: "importer", width: 22 },
    { header: "Category", key: "category", width: 14 },
    { header: "Container No.", key: "containerNumber", width: 16 },
    { header: "Truck No.", key: "truckNumber", width: 14 },
    { header: "Ex-BE No.", key: "exBeNumber", width: 16 },
    { header: "Ex-BE Date", key: "exBeDate", width: 14 },
    { header: "Crane", key: "crane", width: 10 },
    { header: "Issued Packages", key: "issuedPackages", width: 16 },
    { header: "Created Date", key: "createdAt", width: 14 },
    { header: "Created By", key: "createdBy", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      ...r,
      outboundDate: new Date(r.outboundDate).toLocaleDateString("en-IN"),
      exBeDate: r.exBeDate ? new Date(r.exBeDate).toLocaleDateString("en-IN") : "",
      createdAt: new Date(r.createdAt).toLocaleDateString("en-IN"),
    });
  }
  return wb.xlsx.writeBuffer();
}

export async function buildInboundExcel(rows: any[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inbound");
  ws.columns = [
    { header: "Inbound No.", key: "inboundNumber", width: 16 },
    { header: "Arrival Date", key: "arrivalDate", width: 14 },
    { header: "Reference No.", key: "referenceNumber", width: 16 },
    { header: "Importer", key: "importer", width: 22 },
    { header: "CHA", key: "cha", width: 18 },
    { header: "Category", key: "category", width: 14 },
    { header: "In BE No.", key: "inBeNumber", width: 16 },
    { header: "In BE Date", key: "inBeDate", width: 14 },
    { header: "Cargo", key: "cargo", width: 20 },
    { header: "Container No.", key: "containerNumber", width: 16 },
    { header: "Size", key: "containerSize", width: 10 },
    { header: "Bay", key: "bay", width: 10 },
    { header: "Crane", key: "crane", width: 10 },
    { header: "Duty Paid", key: "dutyPaid", width: 10 },
    { header: "Received", key: "received", width: 10 },
    { header: "Balance", key: "balance", width: 10 },
    { header: "Created Date", key: "createdAt", width: 14 },
    { header: "Created By", key: "createdBy", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      ...r,
      arrivalDate: new Date(r.arrivalDate).toLocaleDateString("en-IN"),
      inBeDate: r.inBeDate ? new Date(r.inBeDate).toLocaleDateString("en-IN") : "",
      createdAt: new Date(r.createdAt).toLocaleDateString("en-IN"),
    });
  }
  return wb.xlsx.writeBuffer();
}

export function inboundPdfTable(rows: any[]) {
  const dateStr = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
  return {
    columns: [
      "Inbound No.", "Arrival Date", "Reference No.", "Importer", "CHA", "Category", "In-BE No.", "In-BE Date",
      "Cargo", "Container", "Size", "Bay", "Received", "Balance", "Created", "By",
    ],
    rows: rows.map((r) => [
      r.inboundNumber, dateStr(r.arrivalDate), r.referenceNumber, r.importer, r.cha, r.category,
      r.inBeNumber, dateStr(r.inBeDate), r.cargo, r.containerNumber, r.containerSize, r.bay,
      r.received, r.balance, dateStr(r.createdAt), r.createdBy,
    ]),
  };
}

export async function buildGatePassExcel(rows: any[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Gate Pass");
  ws.columns = [
    { header: "Gate Pass No.", key: "gatePassNumber", width: 16 },
    { header: "Delivery Date", key: "deliveryDate", width: 14 },
    { header: "Truck No.", key: "truckNumber", width: 14 },
    { header: "Place From", key: "placeFrom", width: 16 },
    { header: "Place To", key: "placeTo", width: 16 },
    { header: "Reference No.", key: "referenceNumber", width: 16 },
    { header: "Exbond No.", key: "outboundNumber", width: 16 },
    { header: "Importer", key: "importer", width: 22 },
    { header: "CHA", key: "cha", width: 18 },
    { header: "Category", key: "category", width: 14 },
    { header: "Container No.", key: "containerNumber", width: 16 },
    { header: "Size", key: "containerSize", width: 10 },
    { header: "In BE No.", key: "inBeNumber", width: 16 },
    { header: "Ex BE No.", key: "exBeNumber", width: 16 },
    { header: "Issued Packages", key: "issuedPackages", width: 16 },
    { header: "Created Date", key: "createdAt", width: 14 },
    { header: "Created By", key: "createdBy", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      ...r,
      deliveryDate: new Date(r.deliveryDate).toLocaleDateString("en-IN"),
      createdAt: new Date(r.createdAt).toLocaleDateString("en-IN"),
    });
  }
  return wb.xlsx.writeBuffer();
}

export function gatePassPdfTable(rows: any[]) {
  const dateStr = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
  return {
    columns: [
      "Gate Pass No.", "Delivery Date", "Truck", "From", "To", "Exbond No.", "Importer",
      "Container", "Ex-BE No.", "Issued", "Created", "By",
    ],
    rows: rows.map((r) => [
      r.gatePassNumber, dateStr(r.deliveryDate), r.truckNumber, r.placeFrom, r.placeTo, r.outboundNumber,
      r.importer, r.containerNumber, r.exBeNumber, r.issuedPackages, dateStr(r.createdAt), r.createdBy,
    ]),
  };
}

export async function buildConsolidatedExcel(rows: Awaited<ReturnType<any>>) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Consolidated");
  ws.columns = [
    { header: "Inbound No.", key: "inboundNumber", width: 16 },
    { header: "Inbound Date", key: "inboundDate", width: 14 },
    { header: "Reference No.", key: "referenceNumber", width: 16 },
    { header: "Importer", key: "importer", width: 22 },
    { header: "CHA", key: "cha", width: 18 },
    { header: "In-Bond BE No.", key: "beNumber", width: 16 },
    { header: "In-Bond BE Date", key: "beDate", width: 14 },
    { header: "Container No.", key: "containerNumber", width: 16 },
    { header: "Size", key: "containerSize", width: 8 },
    { header: "Bay", key: "bay", width: 8 },
    { header: "Received Qty", key: "receivedQty", width: 12 },
    { header: "Out Date", key: "outDate", width: 14 },
    { header: "Ex-Bond BE No.", key: "exBeNumber", width: 16 },
    { header: "Truck No.", key: "truckNumber", width: 14 },
    { header: "Issued Qty", key: "issuedQty", width: 10 },
    { header: "Balance Qty", key: "balanceQty", width: 12 },
    { header: "Category", key: "category", width: 14 },
    { header: "Created Date", key: "createdAt", width: 14 },
    { header: "Created By", key: "createdBy", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) {
    ws.addRow({
      ...r,
      inboundDate: new Date(r.inboundDate).toLocaleDateString("en-IN"),
      beDate: r.beDate ? new Date(r.beDate).toLocaleDateString("en-IN") : "",
      outDate: r.outDate ? new Date(r.outDate).toLocaleDateString("en-IN") : "",
      createdAt: new Date(r.createdAt).toLocaleDateString("en-IN"),
    });
  }
  return wb.xlsx.writeBuffer();
}

export function buildSimplePdf(title: string, columns: string[], rows: any[][]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
    doc.pipe(stream);

    doc.fontSize(16).text(title, { align: "center" });
    doc.moveDown();
    doc.fontSize(9);
    const colWidth = (doc.page.width - 60) / columns.length;
    let y = doc.y;
    columns.forEach((c, i) => doc.text(c, 30 + i * colWidth, y, { width: colWidth, continued: false }));
    doc.moveDown(0.5);
    doc.moveTo(30, doc.y).lineTo(doc.page.width - 30, doc.y).stroke();

    for (const row of rows) {
      if (doc.y > doc.page.height - 50) doc.addPage({ margin: 30, size: "A4", layout: "landscape" });
      y = doc.y + 4;
      row.forEach((val, i) => doc.text(String(val ?? ""), 30 + i * colWidth, y, { width: colWidth }));
      doc.moveDown();
    }

    doc.end();
  });
}

// Shared column/row builders for PDF exports, so the manual "Export PDF"
// button and the auto-report scheduler's PDF attachment always show the
// same full set of fields as the Excel export — previously the PDF path
// only had ~7 columns while Excel had 15+, which is what "PDF attachments
// missing details" was about.

export function stockSummaryPdfTable(rows: any[]) {
  const dateStr = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
  return {
    columns: ["Inbound No.", "Arrival Date", "In-BE No.", "In-BE Date", "Importer", "CHA", "Category", "Container", "Size", "Bay", "Crane", "Weight", "Duty Paid", "Received", "Issued", "Balance", "Created", "By"],
    rows: rows.map((r) => [
      r.inboundNumber, dateStr(r.arrivalDate), r.inBeNumber, dateStr(r.inBeDate), r.importer, r.cha, r.category,
      r.containerNumber, r.containerSize, r.bay, r.crane, r.weight, r.dutyPaid, r.received, r.issued, r.balance,
      dateStr(r.createdAt), r.createdBy,
    ]),
  };
}

export function outboundDetailPdfTable(rows: any[]) {
  const dateStr = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
  return {
    columns: ["Outbound No.", "Outbound Date", "Inbound No.", "Importer", "Container", "Truck", "Ex-BE No.", "Ex-BE Date", "Crane", "Issued", "Created", "By"],
    rows: rows.map((r) => [
      r.outboundNumber, dateStr(r.outboundDate), r.inboundNumber, r.importer, r.containerNumber, r.truckNumber,
      r.exBeNumber, dateStr(r.exBeDate), r.crane, r.issuedPackages, dateStr(r.createdAt), r.createdBy,
    ]),
  };
}

export function consolidatedPdfTable(rows: any[]) {
  const dateStr = (d: any) => (d ? new Date(d).toLocaleDateString("en-IN") : "");
  return {
    columns: ["Importer", "CHA", "In-BE No.", "In-BE Date", "Container", "Size", "Bay", "Received", "Out Date", "Ex-BE No.", "Truck", "Issued", "Balance", "Created", "By"],
    rows: rows.map((r) => [
      r.importer, r.cha, r.beNumber, dateStr(r.beDate), r.containerNumber, r.containerSize, r.bay, r.receivedQty,
      dateStr(r.outDate), r.exBeNumber, r.truckNumber, r.issuedQty, r.balanceQty, dateStr(r.createdAt), r.createdBy,
    ]),
  };
}

/**
 * Consolidated report in the client's original legacy layout: one row per
 * container (not per ex-bond truck-line — multiple trucks against the same
 * container are comma-joined into one row, matching how the legacy sheet
 * compresses them), with the inbound's date/ref/importer/BE cells merged
 * down across every container row in that group, and a "TOTAL LOGS" /
 * "BALANCE LOGS" summary row closing each group.
 *
 * Note: this system doesn't track a separate "actual counted qty" distinct
 * from the BE-stated log count the way the legacy sheet's "ACTUAL QTY" /
 * "BALANCE ... ACTUAL QTY WISE" columns do — those are populated with the
 * same received/balance figures as the "BE WISE" columns here.
 */
export async function buildConsolidatedExcelLegacyStyle(groups: any[], sheetTitle: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetTitle.slice(0, 31) || "Consolidated");

  const headers1 = [
    "DATE", "REF.NO", "IMPORTER NAME", "IN-BOND BE-NO", "20'", "40'", "BAY NO", "CONT-NO",
    "NO OF LOGS BE WISE", "ACTUAL QTY", "DATE", "EX-BOND BE-NO", "20", "40", "CONTR-NO",
    "TRUCK NO", "NO OF LOGS LOADED", "BALANCE LOGS BE WISE", "REMARKS",
  ];
  ws.addRow(headers1);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  const widths = [11, 12, 26, 18, 6, 6, 9, 15, 10, 10, 11, 15, 6, 6, 15, 14, 10, 10, 16];
  ws.columns = widths.map((w) => ({ width: w }));

  const is20 = (size: string) => /20/.test(size || "") ? 1 : 0;
  const is40 = (size: string) => /40/.test(size || "") ? 1 : 0;
  const dateStr = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB").replace(/\//g, ".") : " ");
  const join = (vals: string[]) => (vals.length ? Array.from(new Set(vals)).join(",") : " ");

  for (const g of groups) {
    const groupStartRow = ws.rowCount + 1;
    let units20 = 0, units40 = 0, totalReceived = 0, totalActual = 0;
    let balUnits20 = 0, balUnits40 = 0, totalBalanceBe = 0;

    for (const c of g.containers) {
      units20 += is20(c.containerSize);
      units40 += is40(c.containerSize);
      totalReceived += c.receivedQty;
      totalActual += c.receivedQty;

      const hasBalance = c.balanceQty > 0;
      if (hasBalance) {
        balUnits20 += is20(c.containerSize);
        balUnits40 += is40(c.containerSize);
      }
      totalBalanceBe += c.balanceQty;

      const exDates = c.exBondLines.map((l: any) => dateStr(l.outDate)).filter((d: string) => d !== " ");
      const exBeNos = c.exBondLines.map((l: any) => l.exBeNumber).filter(Boolean);
      const trucks = c.exBondLines.map((l: any) => l.truckNumber).filter(Boolean);
      const loadedTotal = c.exBondLines.reduce((s: number, l: any) => s + l.issuedQty, 0);

      ws.addRow([
        dateStr(g.inboundDate), g.referenceNumber || " ", g.importer, `${g.beNumber} / ${dateStr(g.beDate)}`,
        is20(c.containerSize), is40(c.containerSize), c.bay || " ", c.containerNumber,
        c.receivedQty, c.receivedQty,
        join(exDates), join(exBeNos), 0, 0, c.exBondLines.length ? c.containerNumber : " ",
        join(trucks), loadedTotal, c.balanceQty, g.category,
      ]);
    }

    const groupEndRow = ws.rowCount;
    // Merge the per-inbound header columns down across every container row
    // in this group, matching the legacy sheet's B4:B8-style merges.
    if (groupEndRow > groupStartRow) {
      for (const col of [1, 2, 3, 4]) {
        ws.mergeCells(groupStartRow, col, groupEndRow, col);
      }
    }

    ws.addRow([
      null, null, null, "UNITS", units20, units40, null, "TOTAL LOGS", totalReceived, totalActual,
      null, "BALANCE UNITS", balUnits20, balUnits40, null, " ", "TOTAL BALANCE LOGS", totalBalanceBe, null,
    ]);
    ws.getRow(ws.rowCount).font = { bold: true };
    ws.addRow([]); // spacer row between groups, matching the legacy sheet
  }

  return wb.xlsx.writeBuffer();
}
