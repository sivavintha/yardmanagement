import "express-async-errors";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import authRoutes from "./routes/auth";
import inboundRoutes from "./routes/inbound";
import outboundRoutes from "./routes/outbound";
import gatepassRoutes from "./routes/gatepass";
import reportRoutes from "./routes/reports";
import scheduleRoutes from "./routes/schedules";
import mastersRoutes from "./routes/masters";
import adminRoutes from "./routes/admin";
import sequenceRoutes from "./routes/sequence";

import { errorHandler } from "./middleware/errorHandler";
import { startScheduler } from "./jobs/scheduler";
import { ensureBootstrapData } from "./bootstrap";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Uploaded company logo etc. Served directly; Nginx also proxies /uploads
// through to this service (see nginx/nginx.conf).
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/inbounds", inboundRoutes);
app.use("/api/outbounds", outboundRoutes);
app.use("/api/gate-passes", gatepassRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/report-schedule", scheduleRoutes);
app.use("/api/masters", mastersRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/sequence", sequenceRoutes);

app.use(errorHandler);

const PORT = Number(process.env.PORT || 4000);

async function main() {
  await ensureBootstrapData();
  app.listen(PORT, () => {
    console.log(`Yard Management API listening on :${PORT}`);
  });
  startScheduler();
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
