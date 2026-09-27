import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, notFound } from "../lib/errors";
import { requireAuth, requirePermission } from "../middleware/auth";
import { runScheduleNow } from "../jobs/scheduler";
import { requiredText } from "../lib/validation";

const router = Router();
router.use(requireAuth);

const scheduleSchema = z.object({
  name: requiredText("Template name"),
  enabled: z.boolean(),
  recipients: z.array(z.string().trim().email()).min(1),
  ccRecipients: z.array(z.string().trim().email()).optional(),
  subjectTemplate: requiredText("Subject", 300),
  bodyTemplate: requiredText("Body", 5000),
  attachmentType: z.enum(["EXCEL", "PDF", "BOTH"]),
  reportType: z.enum(["STOCK_SUMMARY", "OUTBOUND_DETAIL", "CONSOLIDATED", "BOTH"]),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "sendTime must be HH:mm"),
  categoryFilter: z.string().optional().nullable(),
  importerFilter: z.string().optional().nullable(),
});

// Multiple named, independently pausable templates — one per client/party
// if needed, each with its own recipients, schedule and filters.
router.get("/", requirePermission("schedules", "view"), async (_req, res) => {
  const schedules = await prisma.reportSchedule.findMany({ orderBy: { createdAt: "asc" } });
  res.json(schedules);
});

router.get("/:id", requirePermission("schedules", "view"), async (req, res) => {
  const schedule = await prisma.reportSchedule.findUnique({ where: { id: req.params.id } });
  if (!schedule) throw notFound("Schedule not found");
  res.json(schedule);
});

router.post("/", requirePermission("schedules", "edit"), async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const created = await prisma.reportSchedule.create({ data: parsed.data });
  res.status(201).json(created);
});

router.put("/:id", requirePermission("schedules", "edit"), async (req, res) => {
  const existing = await prisma.reportSchedule.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Schedule not found");
  const parsed = scheduleSchema.partial().safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join("; "));
  const saved = await prisma.reportSchedule.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(saved);
});

// "Pause/stop" is just toggling `enabled` — kept as a dedicated endpoint so
// the UI can do it with one click without resending the whole form.
router.post("/:id/toggle", requirePermission("schedules", "edit"), async (req, res) => {
  const existing = await prisma.reportSchedule.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Schedule not found");
  const saved = await prisma.reportSchedule.update({ where: { id: existing.id }, data: { enabled: !existing.enabled } });
  res.json(saved);
});

router.delete("/:id", requirePermission("schedules", "edit"), async (req, res) => {
  const existing = await prisma.reportSchedule.findUnique({ where: { id: req.params.id } });
  if (!existing) throw notFound("Schedule not found");
  await prisma.reportDelivery.deleteMany({ where: { scheduleId: existing.id } });
  await prisma.reportSchedule.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

router.post("/:id/test", requirePermission("schedules", "edit"), async (req, res) => {
  const schedule = await prisma.reportSchedule.findUnique({ where: { id: req.params.id } });
  if (!schedule) throw notFound("Schedule not found");
  const result = await runScheduleNow(schedule, { forceSend: true, testRecipients: req.body?.recipients });
  res.json(result);
});

router.get("/:id/deliveries", requirePermission("schedules", "view"), async (req, res) => {
  const deliveries = await prisma.reportDelivery.findMany({
    where: { scheduleId: req.params.id },
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  res.json(deliveries);
});

// Global "sent mail" listing across every template, for the Auto Reports
// > Sent Mail tab. Paginated since this can grow large over time.
router.get("/deliveries/all", requirePermission("schedules", "view"), async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? "25")) || 25));
  const [items, total] = await Promise.all([
    prisma.reportDelivery.findMany({
      include: { schedule: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.reportDelivery.count(),
  ]);
  res.json({ items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});

router.post("/deliveries/:id/retry", requirePermission("schedules", "edit"), async (req, res) => {
  const delivery = await prisma.reportDelivery.findUnique({ where: { id: req.params.id } });
  if (!delivery) throw notFound("Delivery not found");
  const schedule = await prisma.reportSchedule.findUnique({ where: { id: delivery.scheduleId } });
  if (!schedule) throw notFound("Schedule not found");
  const result = await runScheduleNow(schedule, { forceSend: true, reportDateOverride: delivery.reportDate });
  res.json(result);
});

export default router;
