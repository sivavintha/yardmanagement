import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { api } from "../api/client";
import { Badge, Button, Card, ErrorBanner, Input, PageHeader } from "../components/ui";
import SearchableSelect from "../components/SearchableSelect";
import Pagination from "../components/Pagination";
import SortHeader from "../components/SortHeader";
import LoadingTruck from "../components/LoadingTruck";
import { useAuth } from "../context/AuthContext";

export default function InboundListPage() {
  const { can } = useAuth();
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [q, setQ] = useState("");
  const [importerId, setImporterId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [importers, setImporters] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/masters/importers").then(({ data }) => setImporters(data.filter((i: any) => i.active)));
    api.get("/masters/stock-categories").then(({ data }) => setCategories(data.filter((c: any) => c.active)));
  }, []);

  async function load() {
    try {
      const { data } = await api.get("/inbounds", {
        params: { page, pageSize, sortBy, sortDir, q: q || undefined, importerId: importerId || undefined, categoryId: categoryId || undefined },
      });
      setInbounds(data.items);
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
  }, [page, pageSize, sortBy, sortDir, importerId, categoryId]);

  function handleSort(field: string) {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Inbond"
        actions={
          can("inbound", "create") ? (
            <Link to="/inbound/new">
              <Button>+ New Inbond Entry</Button>
            </Link>
          ) : null
        }
      />
      <ErrorBanner message={error} />

      <form onSubmit={handleSearch} className="mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Input placeholder="Search booking no., reference…" value={q} onChange={(e) => setQ(e.target.value)} />
        <SearchableSelect
          placeholder="All importers"
          value={importerId}
          onChange={(v) => {
            setImporterId(v);
            setPage(1);
          }}
          options={importers.map((i) => ({ value: i.id, label: i.name }))}
        />
        <SearchableSelect
          placeholder="All categories"
          value={categoryId}
          onChange={(v) => {
            setCategoryId(v);
            setPage(1);
          }}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {loading ? (
        <LoadingTruck label="Fetching inbond entries…" />
      ) : (
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <SortHeader label="Inbound No." field="inboundNumber" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Date" field="inboundDate" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">Importer</th>
              <th className="px-4 py-3">CHA</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Containers</th>
              <SortHeader label="Total Pkgs" field="totalPackages" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {inbounds.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">
                  <Link to={`/inbound/${i.id}`} className="text-brand-600 hover:underline">
                    {i.inboundNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{dayjs(i.inboundDate).format("DD-MMM-YYYY")}</td>
                <td className="px-4 py-3">{i.importer?.name}</td>
                <td className="px-4 py-3">{i.cha?.name ?? "—"}</td>
                <td className="px-4 py-3">{i.category?.name}</td>
                <td className="px-4 py-3">{i.containers?.length}</td>
                <td className="px-4 py-3">{i.totalPackages}</td>
                <td className="px-4 py-3">
                  <Badge tone={i.status === "ACTIVE" ? "green" : "red"}>{i.status}</Badge>
                </td>
              </tr>
            ))}
            {inbounds.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No inbound records yet.
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
    </div>
  );
}
