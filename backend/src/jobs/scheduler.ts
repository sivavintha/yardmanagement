import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { prisma } from "../lib/prisma";
import type { ReportDelivery } from "@prisma/client";
import { sendMail } from "../lib/mailer";
import { getConsolidatedGrouped, getConsolidatedReport, getOutboundDetail, getStockSummary } from "../lib/reportData";
import {
  buildOutboundDetailExcel,
  buildStockSummaryExcel,
  buildSimplePdf,
  buildConsolidatedExcelLegacyStyle,
  stockSummaryPdfTable,
  outboundDetailPdfTable,
  consolidatedPdfTable,
} from "../lib/reportFiles";
import type { CommonFilters } from "../lib/reportData";
import type { ReportSchedule } from "@prisma/client";

dayjs.extend(utc);
dayjs.extend(timezone);

const APP_TZ = process.env.TZ || "Asia/Kolkata";

/**
 * A dayjs value keeps the right calendar day in memory, but naively calling
 * `.toDate()` on a timezone-shifted dayjs and handing that JS Date to a
 * Postgres `@db.Date` (date-only) column silently loses that shift: Prisma
 * reads the Date object's *UTC* year/month/day, and "2026-08-24 00:00
 * +05:30" is "2026-08-23 18:30 UTC" underneath — so it got stored as the
 * 23rd. This constructs a UTC-midnight Date whose UTC calendar fields
 * *are* the intended local date, so nothing gets lost in translation.
 */
function toDateOnly(d: dayjs.Dayjs): Date {
  return new Date(Date.UTC(d.year(), d.month(), d.date()));
}

async function buildAttachments(reportType: string, categoryId?: string | null, importerId?: string | null) {
  const attachments: { filename: string; content: Buffer; type: string }[] = [];

  const filters: CommonFilters = { categoryId: categoryId ?? undefined, importerId: importerId ?? undefined };

  if (reportType === "STOCK_SUMMARY" || reportType === "BOTH") {
    const rows = await getStockSummary(filters);
    attachments.push({
      filename: "stock-summary.xlsx",
      content: Buffer.from(await buildStockSummaryExcel(rows)),
      type: "STOCK_SUMMARY_EXCEL",
    });
    const t = stockSummaryPdfTable(rows);
    const pdf = await buildSimplePdf("Stock Summary", t.columns, t.rows);
    attachments.push({ filename: "stock-summary.pdf", content: pdf, type: "STOCK_SUMMARY_PDF" });
  }

  if (reportType === "OUTBOUND_DETAIL" || reportType === "BOTH") {
    const today = dayjs().tz(APP_TZ).endOf("day").toDate();
    const rows = await getOutboundDetail({ ...filters, to: today });
    attachments.push({
      filename: "outbound-detail.xlsx",
      content: Buffer.from(await buildOutboundDetailExcel(rows)),
      type: "OUTBOUND_DETAIL_EXCEL",
    });
    const t = outboundDetailPdfTable(rows);
    const pdf = await buildSimplePdf("Outbound Detail", t.columns, t.rows);
    attachments.push({ filename: "outbound-detail.pdf", content: pdf, type: "OUTBOUND_DETAIL_PDF" });
  }

  if (reportType === "CONSOLIDATED") {
    const [grouped, flatRows] = await Promise.all([getConsolidatedGrouped(filters), getConsolidatedReport(filters)]);
    attachments.push({
      filename: "consolidated.xlsx",
      content: Buffer.from(await buildConsolidatedExcelLegacyStyle(grouped, "Consolidated")),
      type: "CONSOLIDATED_EXCEL",
    });
    const t = consolidatedPdfTable(flatRows);
    const pdf = await buildSimplePdf("Consolidated Report", t.columns, t.rows);
    attachments.push({ filename: "consolidated.pdf", content: pdf, type: "CONSOLIDATED_PDF" });
  }

  return attachments;
}

function filterByAttachmentType(
  attachments: { filename: string; content: Buffer; type: string }[],
  attachmentType: string
) {
  if (attachmentType === "BOTH") return attachments;
  const suffix = attachmentType === "EXCEL" ? "_EXCEL" : "_PDF";
  return attachments.filter((a) => a.type.endsWith(suffix));
}

/**
 * Runs one schedule for "today" (Asia/Kolkata). Uses the ReportDelivery
 * (scheduleId, reportDate) unique constraint as the send lock: whichever
 * process/tick wins the insert is the one that actually sends the email,
 * so the daily report can never be sent twice even with concurrent ticks.
 */
export async function runScheduleNow(
  schedule: ReportSchedule,
  opts: { forceSend?: boolean; testRecipients?: string[]; reportDateOverride?: Date } = {}
) {
  const now = dayjs().tz(APP_TZ);
  const reportDate = opts.reportDateOverride ? dayjs(opts.reportDateOverride) : now.startOf("day");
  const reportDateOnly = reportDate.format("YYYY-MM-DD");

  // Acquire the send lock by attempting the unique insert first.
  let delivery: ReportDelivery;
  try {
    delivery = await prisma.reportDelivery.create({
      data: {
        reportDate: toDateOnly(reportDate),
        scheduleId: schedule.id,
        recipients: opts.testRecipients ?? schedule.recipients,
        reportType: schedule.reportType,
        attachmentNames: [],
        status: "FAILED", // placeholder until send succeeds; updated below
        errorText: "pending",
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002" && !opts.forceSend) {
      return { skipped: true, reason: `Already sent for ${reportDateOnly}` };
    }
    if (e?.code === "P2002" && opts.forceSend) {
      // retry/test path: reuse the existing row
      delivery = await prisma.reportDelivery.findUniqueOrThrow({
        where: { scheduleId_reportDate: { scheduleId: schedule.id, reportDate: toDateOnly(reportDate) } },
      });
    } else {
      throw e;
    }
  }

  try {
    const all = await buildAttachments(schedule.reportType, schedule.categoryFilter, schedule.importerFilter);
    const attachments = filterByAttachmentType(all, schedule.attachmentType);

    const subject = schedule.subjectTemplate.replace("{date}", reportDateOnly);
    const body = schedule.bodyTemplate.replace("{date}", reportDateOnly);

    await sendMail({
      to: opts.testRecipients ?? schedule.recipients,
      cc: schedule.ccRecipients,
      subject,
      html: body.replace(/\n/g, "<br/>"),
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content })),
    });

    const updated = await prisma.reportDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        errorText: null,
        attachmentNames: attachments.map((a) => a.filename),
      },
    });
    return { sent: true, delivery: updated };
  } catch (err: any) {
    const updated = await prisma.reportDelivery.update({
      where: { id: delivery.id },
      data: { status: "FAILED", errorText: String(err?.message ?? err) },
    });
    return { sent: false, delivery: updated, error: String(err?.message ?? err) };
  }
}

/** Called every 20s by the interval timer set up in index.ts. Instead of
 * requiring an exact-minute string match (which a single slow tick could
 * cause to be missed for the entire day), this fires any enabled schedule
 * whose sendTime has arrived or already passed today and hasn't sent yet —
 * the ReportDelivery (scheduleId, reportDate) unique constraint is what
 * actually prevents duplicate sends, so it's safe to re-check a schedule
 * that's already gone out; it's a fast no-op skip. */
export async function checkAndRunSchedules() {
  const now = dayjs().tz(APP_TZ);
  const weekday = now.day(); // 0=Sunday..6=Saturday
  const hhmm = now.format("HH:mm");

  const candidates = await prisma.reportSchedule.findMany({
    where: { enabled: true, weekdays: { has: weekday } },
  });
  // Zero-padded "HH:mm" strings compare correctly as plain strings.
  const due = candidates.filter((s) => s.sendTime <= hhmm);

  console.log(
    `[scheduler] tick ${now.format("YYYY-MM-DD HH:mm:ss")} (${APP_TZ}, weekday=${weekday}) — ${candidates.length} enabled for today, ${due.length} due`
  );

  for (const schedule of due) {
    try {
      const result = await runScheduleNow(schedule);
      if (!result.skipped) console.log(`[scheduler] ran "${schedule.name}" (${schedule.id}):`, result);
    } catch (err) {
      console.error(`[scheduler] failed running schedule "${schedule.name}" (${schedule.id}):`, err);
    }
  }
}

export function startScheduler() {
  // Pin the process's own timezone too, not just dayjs's per-call .tz() —
  // some minimal Docker base images default to UTC at the OS/ICU level,
  // which can make "18:00" mean something different than intended if only
  // dayjs is timezone-aware and the underlying Intl data isn't.
  process.env.TZ = APP_TZ;

  const CHECK_INTERVAL_MS = 20_000;
  console.log(`[scheduler] started, timezone=${APP_TZ}, checking every ${CHECK_INTERVAL_MS / 1000}s`);
  checkAndRunSchedules();
  setInterval(checkAndRunSchedules, CHECK_INTERVAL_MS);
}
