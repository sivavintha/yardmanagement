import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { api } from "../api/client";
import { Card, PageHeader } from "../components/ui";
import LoadingTruck from "../components/LoadingTruck";

const PIE_COLORS = ["#2563eb", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4"];

interface Summary {
  activeStockPackages: number;
  todayInboundCount: number;
  todayInboundPackages: number;
  todayOutboundCount: number;
  todayOutboundPackages: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<string>("Not configured");
  const [trend, setTrend] = useState<{ day: string; inbound: number; outbound: number }[]>([]);
  const [byCategory, setByCategory] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [inboundsRes, outboundLinesRes, deliveriesRes, stockRes] = await Promise.all([
        api.get("/inbounds"),
        api.get("/outbounds/detail"),
        api.get("/report-schedule/deliveries/all").catch(() => ({ data: [] })),
        api.get("/reports/stock-summary").catch(() => ({ data: [] })),
      ]);

      const today = dayjs().format("YYYY-MM-DD");
      const inbounds = inboundsRes.data as any[];
      const outboundLines = (outboundLinesRes.data.items ?? outboundLinesRes.data) as any[];

      const activeStockPackages = inbounds
        .filter((i) => i.status === "ACTIVE")
        .flatMap((i) => i.containers)
        .reduce((sum: number, c: any) => sum + c.remainingPackages, 0);

      const todayInbounds = inbounds.filter((i) => dayjs(i.inboundDate).format("YYYY-MM-DD") === today);
      const todayOutboundLines = outboundLines.filter(
        (l) => dayjs(l.outbound?.outboundDate).format("YYYY-MM-DD") === today
      );

      setSummary({
        activeStockPackages,
        todayInboundCount: todayInbounds.length,
        todayInboundPackages: todayInbounds.reduce((s: number, i: any) => s + i.totalPackages, 0),
        todayOutboundCount: new Set(todayOutboundLines.map((l) => l.outbound?.id)).size,
        todayOutboundPackages: todayOutboundLines.reduce((s: number, l: any) => s + l.issuedPackages, 0),
      });

      // Last 7 days trend
      const days = Array.from({ length: 7 }).map((_, idx) => dayjs().subtract(6 - idx, "day"));
      setTrend(
        days.map((d) => {
          const key = d.format("YYYY-MM-DD");
          const inboundPkgs = inbounds
            .filter((i) => dayjs(i.inboundDate).format("YYYY-MM-DD") === key)
            .reduce((s: number, i: any) => s + i.totalPackages, 0);
          const outboundPkgs = outboundLines
            .filter((l) => dayjs(l.outbound?.outboundDate).format("YYYY-MM-DD") === key)
            .reduce((s: number, l: any) => s + l.issuedPackages, 0);
          return { day: d.format("DD MMM"), inbound: inboundPkgs, outbound: outboundPkgs };
        })
      );

      // Active balance by category
      const stock = stockRes.data as any[];
      const grouped: Record<string, number> = {};
      for (const row of stock) {
        grouped[row.category] = (grouped[row.category] ?? 0) + row.balance;
      }
      setByCategory(Object.entries(grouped).map(([name, value]) => ({ name, value })));

      const deliveries = (deliveriesRes.data.items ?? deliveriesRes.data) as any[];
      const todaysDelivery = deliveries.find((d) => dayjs.utc(d.reportDate).format("YYYY-MM-DD") === today);
      setScheduleStatus(todaysDelivery ? (todaysDelivery.status === "SENT" ? "Sent today" : "Failed today") : "Not sent yet today");
    })();
  }, []);

  const cards = [
    { label: "Active Stock (packages)", value: summary?.activeStockPackages },
    { label: "Today's Inbound (count)", value: summary?.todayInboundCount },
    { label: "Today's Inbound (packages)", value: summary?.todayInboundPackages },
    { label: "Today's Outbound (count)", value: summary?.todayOutboundCount },
    { label: "Today's Outbound (packages)", value: summary?.todayOutboundPackages },
    { label: "Daily Report Status", value: scheduleStatus },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" />
      {!summary ? (
        <LoadingTruck label="Crunching today's numbers…" />
      ) : (
        <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className="text-2xl font-semibold text-slate-800 mt-2">{c.value ?? "…"}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="text-sm font-semibold text-slate-700 mb-3">Inbound vs Outbound (last 7 days, packages)</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="inbound" name="Inbound" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outbound" name="Outbound" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold text-slate-700 mb-3">Active Stock Balance by Category</div>
          {byCategory.length === 0 ? (
            <p className="text-sm text-slate-400">No active stock yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={100} label>
                  {byCategory.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
