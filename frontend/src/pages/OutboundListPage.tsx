import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { api } from "../api/client";
import { Badge, Button, Card, ErrorBanner, Input, PageHeader } from "../components/ui";
import Pagination from "../components/Pagination";
import SortHeader from "../components/SortHeader";
import SearchableSelect from "../components/SearchableSelect";
import LoadingTruck from "../components/LoadingTruck";
import { useAuth } from "../context/AuthContext";

interface Filters {
  q: string;
  importerId: string;
  categoryId: string;
  from: string;
  to: string;
}

function FilterBar({ filters, setFilters, importers, categories, onApply }: any) {
  return (
    <div className="mb-4 grid grid-cols-1 sm:grid-cols-5 gap-3">
      <Input placeholder="Search exbond/inbond no…" value={filters.q} onChange={(e) => setFilters((f: Filters) => ({ ...f, q: e.target.value }))} />
      <SearchableSelect
        placeholder="All importers"
        value={filters.importerId}
        onChange={(v) => setFilters((f: Filters) => ({ ...f, importerId: v }))}
        options={importers.map((i: any) => ({ value: i.id, label: i.name }))}
      />
      <SearchableSelect
        placeholder="All categories"
        value={filters.categoryId}
        onChange={(v) => setFilters((f: Filters) => ({ ...f, categoryId: v }))}
        options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
      />
      <Input type="date" value={filters.from} onChange={(e) => setFilters((f: Filters) => ({ ...f, from: e.target.value }))} />
      <div className="flex gap-2">
        <Input type="date" value={filters.to} onChange={(e) => setFilters((f: Filters) => ({ ...f, to: e.target.value }))} />
        <Button variant="secondary" onClick={onApply}>
          Go
        </Button>
      </div>
    </div>
  );
}

function SummaryTab({ filters }: { filters: Filters }) {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data } = await api.get("/outbounds", {
        params: {
          page,
          pageSize,
          sortBy,
          sortDir,
          q: filters.q || undefined,
          importerId: filters.importerId || undefined,
          categoryId: filters.categoryId || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortBy, sortDir, filters]);

  function handleSort(field: string) {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  return (
    <>
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingTruck label="Fetching exbond summary…" />
      ) : (
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <SortHeader label="Exbond No." field="outboundNumber" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Delivery Date" field="outboundDate" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">Inbond No.</th>
              <th className="px-4 py-3">Importer</th>
              <th className="px-4 py-3">Container</th>
              <th className="px-4 py-3">Trucks</th>
              <th className="px-4 py-3">Total Issued</th>
              <th className="px-4 py-3">Gate Pass Status</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{o.outboundNumber}</td>
                <td className="px-4 py-3">{dayjs(o.outboundDate).format("DD-MMM-YYYY")}</td>
                <td className="px-4 py-3">{o.inbound?.inboundNumber}</td>
                <td className="px-4 py-3">{o.inbound?.importer?.name}</td>
                <td className="px-4 py-3">{o.inboundContainer?.containerNumber}</td>
                <td className="px-4 py-3">{o.truckCount}</td>
                <td className="px-4 py-3">{o.totalIssuedPackages}</td>
                <td className="px-4 py-3">
                  {o.fullyGatePassed ? (
                    <Badge tone="green">Gate passed</Badge>
                  ) : o.lines?.some((l: any) => l.gatePassId) ? (
                    <Badge tone="amber">Partially passed</Badge>
                  ) : (
                    <Badge tone="slate">Pending</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={o.status === "ACTIVE" ? "green" : "red"}>{o.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {can("outbound", "edit") && o.status === "ACTIVE" && !o.lines?.some((l: any) => l.gatePassId) && (
                    <Link to={`/outbound/${o.id}`} className="text-brand-600 text-xs hover:underline">
                      Edit
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  No exbond records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </Card>
      )}
    </>
  );
}

function DetailTab({ filters }: { filters: Filters }) {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { data } = await api.get("/outbounds/detail", {
        params: {
          page,
          pageSize,
          sortBy,
          sortDir,
          q: filters.q || undefined,
          importerId: filters.importerId || undefined,
          categoryId: filters.categoryId || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        },
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortBy, sortDir, filters]);

  function handleSort(field: string) {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  return (
    <>
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingTruck label="Fetching exbond detail…" />
      ) : (
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Exbond No.</th>
              <th className="px-4 py-3">Inbond No.</th>
              <th className="px-4 py-3">Importer</th>
              <th className="px-4 py-3">Container</th>
              <SortHeader label="Truck" field="truckNumber" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">Ex-BE No.</th>
              <th className="px-4 py-3">Ex-BE Date</th>
              <th className="px-4 py-3">Crane</th>
              <SortHeader label="Issued" field="issuedPackages" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">Gate Pass</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{l.outbound?.outboundNumber}</td>
                <td className="px-4 py-3">{l.outbound?.inbound?.inboundNumber}</td>
                <td className="px-4 py-3">{l.outbound?.inbound?.importer?.name}</td>
                <td className="px-4 py-3">{l.outbound?.inboundContainer?.containerNumber}</td>
                <td className="px-4 py-3">{l.truckNumber}</td>
                <td className="px-4 py-3">{l.exBeNumber ?? "—"}</td>
                <td className="px-4 py-3">{l.exBeDate ? dayjs(l.exBeDate).format("DD-MMM-YYYY") : "—"}</td>
                <td className="px-4 py-3">{l.crane?.name ?? "—"}</td>
                <td className="px-4 py-3">{l.issuedPackages}</td>
                <td className="px-4 py-3">
                  {l.gatePass ? (
                    <Link to={`/gate-pass/${l.gatePass.id}`} className="text-brand-600 hover:underline">
                      {l.gatePass.gatePassNumber}
                    </Link>
                  ) : (
                    <Badge tone="slate">Pending</Badge>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  No truck-line records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </Card>
      )}
    </>
  );
}

const emptyFilters = (): Filters => ({ q: "", importerId: "", categoryId: "", from: "", to: "" });

export default function OutboundListPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<"summary" | "detail">("summary");
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters());
  const [importers, setImporters] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    api.get("/masters/importers").then(({ data }) => setImporters(data.filter((i: any) => i.active)));
    api.get("/masters/stock-categories").then(({ data }) => setCategories(data.filter((c: any) => c.active)));
  }, []);

  return (
    <div>
      <PageHeader
        title="Exbond"
        actions={
          can("outbound", "create") ? (
            <Link to="/outbound/new">
              <Button>+ New Exbond Entry</Button>
            </Link>
          ) : null
        }
      />
      <div className="flex gap-2 mb-4">
        <button
          className={`px-3 py-1.5 text-sm rounded-md ${tab === "summary" ? "bg-brand-600 text-white" : "bg-white border border-slate-300"}`}
          onClick={() => setTab("summary")}
        >
          Summary
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded-md ${tab === "detail" ? "bg-brand-600 text-white" : "bg-white border border-slate-300"}`}
          onClick={() => setTab("detail")}
        >
          Detail (by truck)
        </button>
      </div>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        importers={importers}
        categories={categories}
        onApply={() => setAppliedFilters(filters)}
      />
      {tab === "summary" ? <SummaryTab filters={appliedFilters} /> : <DetailTab filters={appliedFilters} />}
    </div>
  );
}
