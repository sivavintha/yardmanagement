import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { api } from "../api/client";
import { Badge, Button, Card, ErrorBanner, Input, PageHeader } from "../components/ui";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";

export default function GatePassListPage() {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const { data } = await api.get("/gate-passes", { params: { page, pageSize, q: q || undefined } });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  return (
    <div>
      <PageHeader
        title="Gate Pass — Issued"
        actions={
          can("gatepass", "create") ? (
            <Link to="/gate-pass/new">
              <Button>+ New Gate Pass</Button>
            </Link>
          ) : null
        }
      />
      <ErrorBanner message={error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
        className="mb-4 flex gap-2 max-w-sm"
      >
        <Input placeholder="Search gate pass no., truck, outbound no…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="secondary" type="submit">
          Search
        </Button>
      </form>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Gate Pass No.</th>
              <th className="px-4 py-3">Issued At</th>
              <th className="px-4 py-3">Exbond No(s).</th>
              <th className="px-4 py-3">Party Name(s)</th>
              <th className="px-4 py-3">Truck</th>
              <th className="px-4 py-3">Containers</th>
              <th className="px-4 py-3">Place</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((g) => (
              <tr key={g.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">
                  <Link to={`/gate-pass/${g.id}`} className="text-brand-600 hover:underline">
                    {g.gatePassNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">{dayjs(g.issuedAt).format("DD-MMM-YYYY HH:mm")}</td>
                <td className="px-4 py-3">{Array.from(new Set(g.lines?.map((l: any) => l.outbound?.outboundNumber))).join(", ")}</td>
                <td className="px-4 py-3">{Array.from(new Set(g.lines?.map((l: any) => l.outbound?.inbound?.importer?.name))).join(", ")}</td>
                <td className="px-4 py-3">{g.truckNumber}</td>
                <td className="px-4 py-3">{g.lines?.length}</td>
                <td className="px-4 py-3">{g.placeFrom} → {g.placeTo}</td>
                <td className="px-4 py-3">
                  <Badge tone={g.status === "ACTIVE" ? "green" : "red"}>{g.status}</Badge>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No gate passes issued yet.
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
    </div>
  );
}
