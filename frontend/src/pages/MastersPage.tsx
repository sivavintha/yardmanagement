import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { Badge, Button, Card, ErrorBanner, Input, PageHeader } from "../components/ui";
import Pagination from "../components/Pagination";
import { useAuth } from "../context/AuthContext";

// `code` is system-generated (shown, never entered) for these masters.
const TABS = [
  {
    key: "importers",
    label: "Importers",
    endpoint: "/masters/importers",
    codeField: "code",
    sequenceKey: "importer",
    fields: ["name", "address1", "address2", "city", "pincode", "phone", "email", "contactPerson"],
  },
  {
    key: "chas",
    label: "CHA",
    endpoint: "/masters/chas",
    codeField: "code",
    sequenceKey: "cha",
    fields: ["name", "address1", "address2", "city", "pincode", "phone", "email", "contactPerson"],
  },
  { key: "bays", label: "Bays", endpoint: "/masters/bays", codeField: "code", sequenceKey: "bay", fields: ["description"] },
  { key: "cranes", label: "Cranes", endpoint: "/masters/cranes", codeField: "code", sequenceKey: "crane", fields: ["name"] },
  { key: "stock-categories", label: "Stock Categories", endpoint: "/masters/stock-categories", fields: ["name"] },
  { key: "container-sizes", label: "Container Sizes", endpoint: "/masters/container-sizes", fields: ["name"] },
];

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  address1: "Address 1",
  address2: "Address 2",
  city: "City",
  pincode: "Pincode",
  phone: "Phone",
  email: "Email",
  contactPerson: "Contact Person",
  description: "Description",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function MastersPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.roleName === "Superadmin";
  const [tab, setTab] = useState(TABS[0]);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(pageArg = page, qArg = q) {
    try {
      const { data } = await api.get(tab.endpoint, { params: { page: pageArg, pageSize, q: qArg || undefined } });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setForm({});
    setEditingId(null);
    setError(null);
    setEmailError(null);
    setPage(1);
    setQ("");
    load(1, "");
    if (tab.sequenceKey) {
      api.get(`/sequence/peek/${tab.sequenceKey}`).then(({ data }) => setNextCode(data.next)).catch(() => setNextCode(null));
    } else {
      setNextCode(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    load(page, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, q);
  }

  function updateField(f: string, value: string) {
    if (f === "phone") {
      // Restrict to digits/+/-/spaces as the user types, rather than
      // rejecting the whole thing on submit.
      value = value.replace(/[^0-9+\-\s]/g, "");
    }
    setForm((s) => ({ ...s, [f]: value }));
    if (f === "email") setEmailError(null);
  }

  function handleEmailBlur() {
    if (form.email && !EMAIL_RE.test(form.email)) {
      setEmailError("Enter a valid email address.");
    } else {
      setEmailError(null);
    }
  }

  function startEdit(item: any) {
    setEditingId(item.id);
    const next: Record<string, string> = {};
    for (const f of tab.fields) next[f] = item[f] ?? "";
    setForm(next);
    setEmailError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({});
    setEmailError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.email && !EMAIL_RE.test(form.email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    try {
      if (editingId) {
        await api.put(`${tab.endpoint}/${editingId}`, form);
      } else {
        await api.post(tab.endpoint, form);
      }
      setForm({});
      setEditingId(null);
      load();
      if (tab.sequenceKey) {
        api.get(`/sequence/peek/${tab.sequenceKey}`).then(({ data }) => setNextCode(data.next)).catch(() => {});
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleActive(item: any) {
    try {
      await api.put(`${tab.endpoint}/${item.id}`, { active: !item.active });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(item: any) {
    if (!confirm("Delete this record permanently? This can't be undone.")) return;
    try {
      await api.delete(`${tab.endpoint}/${item.id}`);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader title="Masters" />
      <ErrorBanner message={error} />
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-md ${tab.key === t.key ? "bg-brand-600 text-white" : "bg-white border border-slate-300"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-4 mb-6">
        {editingId ? (
          <p className="text-xs text-brand-600 mb-3 font-medium">Editing record — Save to apply changes, or Cancel to discard.</p>
        ) : (
          tab.codeField && (
            <p className="text-xs text-slate-400 mb-3">
              Code (provisional): <span className="font-mono">{nextCode ?? "…"}</span> — assigned for real when you save.
            </p>
          )
        )}
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
          {tab.fields.map((f) => (
            <div key={f} className="w-48">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {FIELD_LABELS[f] ?? f}
                {f === "name" && " *"}
              </label>
              <Input
                value={form[f] ?? ""}
                onChange={(e) => updateField(f, e.target.value)}
                onBlur={f === "email" ? handleEmailBlur : undefined}
                required={f === "name"}
                type={f === "email" ? "email" : "text"}
              />
              {f === "email" && emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
            </div>
          ))}
          <Button type="submit">{editingId ? "Save Changes" : "Add"}</Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={cancelEdit}>
              Cancel
            </Button>
          )}
        </form>
      </Card>

      <form onSubmit={handleSearch} className="mb-4 flex gap-2 max-w-sm">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {tab.codeField && <th className="px-4 py-3">Code</th>}
              {tab.fields.map((f) => (
                <th key={f} className="px-4 py-3">
                  {FIELD_LABELS[f] ?? f}
                </th>
              ))}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                {tab.codeField && <td className="px-4 py-3 font-mono text-xs">{item.code}</td>}
                {tab.fields.map((f) => (
                  <td key={f} className="px-4 py-3">
                    {item[f] ?? "—"}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <Badge tone={item.active ? "green" : "red"}>{item.active ? "Active" : "Disabled"}</Badge>
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button className="text-slate-600 text-xs hover:underline" onClick={() => startEdit(item)}>
                    Edit
                  </button>
                  <button className="text-brand-600 text-xs hover:underline" onClick={() => toggleActive(item)}>
                    {item.active ? "Disable" : "Enable"}
                  </button>
                  {isSuperadmin && (
                    <button className="text-red-600 text-xs hover:underline" onClick={() => remove(item)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={tab.fields.length + (tab.codeField ? 3 : 2)} className="px-4 py-8 text-center text-slate-400">
                  No records yet.
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
      <p className="text-xs text-slate-400 mt-3">
        Deleting is restricted to superadmins, and only works on records that aren't referenced by any transaction yet
        — otherwise, disable it instead.
      </p>
    </div>
  );
}
