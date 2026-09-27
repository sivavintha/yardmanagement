import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { api } from "../api/client";
import { Button, Card, ErrorBanner, Field, PageHeader } from "../components/ui";
import SearchableSelect from "../components/SearchableSelect";
import Pagination from "../components/Pagination";
import LoadingTruck from "../components/LoadingTruck";

type Tab = "stock-summary" | "inbound" | "outbound-detail" | "gate-pass" | "consolidated";

const TABS: { key: Tab; label: string }[] = [
  { key: "stock-summary", label: "Stock Summary" },
  { key: "inbound", label: "Inbond" },
  { key: "outbound-detail", label: "Exbond" },
  { key: "gate-pass", label: "Gate Pass" },
  { key: "consolidated", label: "Consolidated" },
];

const COLUMNS: Record<Exclude<Tab, "consolidated">, string[]> = {
  "stock-summary": [
    "Inbound No.",
    "Arrival Date",
    "In BE No.",
    "In BE Date",
    "Importer",
    "CHA",
    "Category",
    "Container",
    "Size",
    "Bay",
    "Crane",
    "Weight",
    "Duty Paid",
    "Received",
    "Issued",
    "Balance",
    "Created Date",
    "Created By",
  ],
  inbound: [
    "Inbound No.",
    "Arrival Date",
    "Reference No.",
    "Importer",
    "CHA",
    "Category",
    "In BE No.",
    "In BE Date",
    "Cargo",
    "Container",
    "Size",
    "Bay",
    "Crane",
    "Duty Paid",
    "Received",
    "Balance",
    "Created Date",
    "Created By",
  ],
  "outbound-detail": [
    "Outbound No.",
    "Inbound No.",
    "Importer",
    "Container",
    "Truck",
    "Ex-BE No.",
    "Ex-BE Date",
    "Crane",
    "Issued",
    "Created Date",
    "Created By",
  ],
  "gate-pass": [
    "Gate Pass No.",
    "Delivery Date",
    "Truck",
    "Place From",
    "Place To",
    "Reference No.",
    "Exbond No.",
    "Importer",
    "CHA",
    "Category",
    "Container",
    "Size",
    "In BE No.",
    "Ex-BE No.",
    "Issued",
    "Created Date",
    "Created By",
  ],
};

const fmtDate = (v: any) => (v ? dayjs(v).format("DD-MMM-YYYY") : "");

function pickRow(tab: Exclude<Tab, "consolidated">, r: any): (string | number)[] {
  if (tab === "stock-summary")
    return [
      r.inboundNumber,
      fmtDate(r.arrivalDate),
      r.inBeNumber,
      fmtDate(r.inBeDate),
      r.importer,
      r.cha,
      r.category,
      r.containerNumber,
      r.containerSize,
      r.bay,
      r.crane,
      r.weight,
      r.dutyPaid,
      r.received,
      r.issued,
      r.balance,
      fmtDate(r.createdAt),
      r.createdBy,
    ];
  if (tab === "inbound")
    return [
      r.inboundNumber,
      fmtDate(r.arrivalDate),
      r.referenceNumber,
      r.importer,
      r.cha,
      r.category,
      r.inBeNumber,
      fmtDate(r.inBeDate),
      r.cargo,
      r.containerNumber,
      r.containerSize,
      r.bay,
      r.crane,
      r.dutyPaid,
      r.received,
      r.balance,
      fmtDate(r.createdAt),
      r.createdBy,
    ];
  if (tab === "gate-pass")
    return [
      r.gatePassNumber,
      fmtDate(r.deliveryDate),
      r.truckNumber,
      r.placeFrom,
      r.placeTo,
      r.referenceNumber,
      r.outboundNumber,
      r.importer,
      r.cha,
      r.category,
      r.containerNumber,
      r.containerSize,
      r.inBeNumber,
      r.exBeNumber,
      r.issuedPackages,
      fmtDate(r.createdAt),
      r.createdBy,
    ];
  return [
    r.outboundNumber,
    r.inboundNumber,
    r.importer,
    r.containerNumber,
    r.truckNumber,
    r.exBeNumber,
    fmtDate(r.exBeDate),
    r.crane,
    r.issuedPackages,
    fmtDate(r.createdAt),
    r.createdBy,
  ];
}

function ConsolidatedView({ groups }: { groups: any[] }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const pageGroups = groups.slice((page - 1) * pageSize, page * pageSize);

  if (groups.length === 0) {
    return (
      <Card className="p-8 text-center text-slate-400 text-sm">No data.</Card>
    );
  }

  return (
    <div className="space-y-4">
      {pageGroups.map((g) => (
        <Card key={g.inboundId} className="overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border-b border-slate-200">
            <div>
              <span className="text-slate-400">Inbound No.: </span>
              <span className="font-semibold">{g.inboundNumber}</span>
            </div>
            <div>
              <span className="text-slate-400">Date: </span>
              {dayjs(g.inboundDate).format("DD-MMM-YYYY")}
            </div>
            <div>
              <span className="text-slate-400">Ref: </span>
              {g.referenceNumber || "—"}
            </div>
            <div>
              <span className="text-slate-400">Importer: </span>
              {g.importer}
            </div>
            <div>
              <span className="text-slate-400">CHA: </span>
              {g.cha || "—"}
            </div>
            <div>
              <span className="text-slate-400">In BE No/Date: </span>
              {g.beNumber || "—"}
              {g.beDate ? ` / ${dayjs(g.beDate).format("DD-MMM-YYYY")}` : ""}
            </div>
            <div>
              <span className="text-slate-400">Category: </span>
              {g.category}
            </div>
            <div>
              <span className="text-slate-400">Created: </span>
              {dayjs(g.createdAt).format("DD-MMM-YYYY")} by {g.createdBy || "—"}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white text-left text-xs uppercase text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-4 py-2">Container</th>
                <th className="px-4 py-2">Size</th>
                <th className="px-4 py-2">Bay</th>
                <th className="px-4 py-2">Received</th>
                <th className="px-4 py-2">Out Date</th>
                <th className="px-4 py-2">Ex-BE No.</th>
                <th className="px-4 py-2">Ex-BE Date</th>
                <th className="px-4 py-2">Truck</th>
                <th className="px-4 py-2">Issued</th>
                <th className="px-4 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {g.containers.map((c: any, ci: number) =>
                c.exBondLines.length === 0 ? (
                  <tr key={ci} className="border-t border-slate-50">
                    <td className="px-4 py-2 font-medium">{c.containerNumber}</td>
                    <td className="px-4 py-2">{c.containerSize}</td>
                    <td className="px-4 py-2">{c.bay || "—"}</td>
                    <td className="px-4 py-2">{c.receivedQty}</td>
                    <td className="px-4 py-2 text-slate-300" colSpan={5}>
                      not yet issued
                    </td>
                    <td className="px-4 py-2">{c.balanceQty}</td>
                  </tr>
                ) : (
                  c.exBondLines.map((line: any, li: number) => (
                    <tr key={`${ci}-${li}`} className="border-t border-slate-50">
                      {li === 0 && (
                        <>
                          <td className="px-4 py-2 font-medium" rowSpan={c.exBondLines.length}>
                            {c.containerNumber}
                          </td>
                          <td className="px-4 py-2" rowSpan={c.exBondLines.length}>
                            {c.containerSize}
                          </td>
                          <td className="px-4 py-2" rowSpan={c.exBondLines.length}>
                            {c.bay || "—"}
                          </td>
                          <td className="px-4 py-2" rowSpan={c.exBondLines.length}>
                            {c.receivedQty}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-2">{dayjs(line.outDate).format("DD-MMM-YYYY")}</td>
                      <td className="px-4 py-2">{line.exBeNumber || "—"}</td>
                      <td className="px-4 py-2">{line.exBeDate ? dayjs(line.exBeDate).format("DD-MMM-YYYY") : "—"}</td>
                      <td className="px-4 py-2">{line.truckNumber}</td>
                      <td className="px-4 py-2">{line.issuedQty}</td>
                      {li === 0 && (
                        <td className="px-4 py-2" rowSpan={c.exBondLines.length}>
                          {c.balanceQty}
                        </td>
                      )}
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </Card>
      ))}
      <Card>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={groups.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("stock-summary");
  const [importers, setImporters] = useState<any[]>([]);
  const [chas, setChas] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [importerId, setImporterId] = useState("");
  const [chaId, setChaId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/masters/importers").then(({ data }) => setImporters(data.filter((i: any) => i.active)));
    api.get("/masters/chas").then(({ data }) => setChas(data.filter((c: any) => c.active)));
    api.get("/masters/stock-categories").then(({ data }) => setCategories(data.filter((c: any) => c.active)));
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    setPage(1);
    const params = {
      importerId: importerId || undefined,
      chaId: chaId || undefined,
      categoryId: categoryId || undefined,
      from: from || undefined,
      to: to || undefined,
    };
    try {
      if (tab === "consolidated") {
        const { data } = await api.get("/reports/consolidated/grouped", { params });
        setGroups(data);
      } else {
        const { data } = await api.get(`/reports/${tab}`, { params });
        setRows(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function download(format: "excel" | "pdf") {
    try {
      const res = await api.post(
        "/reports/generate",
        { type: tab, format, importerId: importerId || undefined, chaId: chaId || undefined, categoryId: categoryId || undefined, from: from || undefined, to: to || undefined },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tab}.${format === "excel" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const [pageSize, setPageSize] = useState(25);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader
        title="Reports"
        actions={
          <>
            <Button variant="secondary" onClick={() => download("excel")}>
              Export Excel
            </Button>
            <Button variant="secondary" onClick={() => download("pdf")}>
              Export PDF
            </Button>
          </>
        }
      />
      <ErrorBanner message={error} />

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-1.5 text-sm rounded-md ${tab === t.key ? "bg-brand-600 text-white" : "bg-white border border-slate-300"}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <Field label="Importer">
            <SearchableSelect value={importerId} onChange={setImporterId} placeholder="All importers" options={importers.map((i) => ({ value: i.id, label: i.name }))} />
          </Field>
          <Field label="CHA">
            <SearchableSelect value={chaId} onChange={setChaId} placeholder="All CHA" options={chas.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="Category">
            <SearchableSelect value={categoryId} onChange={setCategoryId} placeholder="All categories" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="From">
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button variant="secondary" onClick={load}>
            Apply Filters
          </Button>
        </div>
      </Card>

      {loading ? (
        <LoadingTruck label="Building your report…" />
      ) : tab === "consolidated" ? (
        <ConsolidatedView groups={groups} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {COLUMNS[tab].map((c) => (
                  <th key={c} className="px-4 py-3">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  {pickRow(tab, r).map((v, i) => (
                    <td key={i} className="px-4 py-3">
                      {String(v ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS[tab].length} className="px-4 py-8 text-center text-slate-400">
                    No data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={rows.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </Card>
      )}
    </div>
  );
}
