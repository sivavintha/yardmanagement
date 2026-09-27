import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Button, Card, ErrorBanner, Field, Input, PageHeader, Select } from "../components/ui";
import SearchableSelect from "../components/SearchableSelect";

interface ContainerRow {
  containerNumber: string;
  containerSizeId: string;
  bayId: string;
  craneId: string;
  weight: string;
  dutyPaid: boolean;
  receivedPackages: string;
  remarks: string;
}

const emptyRow = (): ContainerRow => ({
  containerNumber: "",
  containerSizeId: "",
  bayId: "",
  craneId: "",
  weight: "",
  dutyPaid: false,
  receivedPackages: "",
  remarks: "",
});

export default function InboundFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [importers, setImporters] = useState<any[]>([]);
  const [chas, setChas] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [bays, setBays] = useState<any[]>([]);
  const [cranes, setCranes] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);

  const [inboundNumber, setInboundNumber] = useState(""); // display only once saved; server-generated
  const [nextNumber, setNextNumber] = useState<string | null>(null);
  const [inboundDate, setInboundDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [importerId, setImporterId] = useState("");
  const [chaId, setChaId] = useState("");
  const [beNumber, setBeNumber] = useState("");
  const [beDate, setBeDate] = useState("");
  const [goodsDescription, setGoodsDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [rows, setRows] = useState<ContainerRow[]>([emptyRow()]);
  const [locked, setLocked] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [i, cha, c, b, cr, s] = await Promise.all([
        api.get("/masters/importers"),
        api.get("/masters/chas"),
        api.get("/masters/stock-categories"),
        api.get("/masters/bays"),
        api.get("/masters/cranes"),
        api.get("/masters/container-sizes"),
      ]);
      setImporters(i.data.filter((x: any) => x.active));
      setChas(cha.data.filter((x: any) => x.active));
      setCategories(c.data.filter((x: any) => x.active));
      setBays(b.data.filter((x: any) => x.active));
      setCranes(cr.data.filter((x: any) => x.active));
      setSizes(s.data.filter((x: any) => x.active));
      if (!isEdit) {
        api.get("/sequence/peek/inbound").then(({ data }) => setNextNumber(data.next)).catch(() => {});
      }
    })();
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await api.get(`/inbounds/${id}`);
      setInboundNumber(data.inboundNumber);
      setInboundDate(data.inboundDate.slice(0, 10));
      setReferenceNumber(data.referenceNumber ?? "");
      setImporterId(data.importerId);
      setChaId(data.chaId ?? "");
      setBeNumber(data.beNumber ?? "");
      setBeDate(data.beDate ? data.beDate.slice(0, 10) : "");
      setGoodsDescription(data.goodsDescription ?? "");
      setCategoryId(data.categoryId);
      setRows(
        data.containers.map((c: any) => ({
          containerNumber: c.containerNumber,
          containerSizeId: c.containerSizeId,
          bayId: c.bayId ?? "",
          craneId: c.craneId ?? "",
          weight: c.weight != null ? String(c.weight) : "",
          dutyPaid: c.dutyPaid ?? false,
          receivedPackages: String(c.receivedPackages),
          remarks: c.remarks ?? "",
        }))
      );
      setLocked((data.outbounds ?? []).some((o: any) => o.status === "ACTIVE"));
    })();
  }, [id]);

  function updateRow(idx: number, patch: Partial<ContainerRow>) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((r) => [...r, emptyRow()]);
  }

  function removeRow(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }

  const totalPackages = rows.reduce((s, r) => s + (parseInt(r.receivedPackages) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: any = {
        inboundDate,
        referenceNumber: referenceNumber || null,
        importerId,
        chaId: chaId || null,
        beNumber: beNumber || null,
        beDate: beDate || null,
        goodsDescription: goodsDescription || null,
        categoryId,
      };
      if (!locked) {
        payload.containers = rows.map((r) => ({
          containerNumber: r.containerNumber.toUpperCase(),
          containerSizeId: r.containerSizeId,
          bayId: r.bayId || null,
          craneId: r.craneId || null,
          weight: r.weight ? parseFloat(r.weight) : null,
          dutyPaid: r.dutyPaid,
          receivedPackages: parseInt(r.receivedPackages) || 0,
          remarks: r.remarks || null,
        }));
      }

      if (isEdit) {
        await api.put(`/inbounds/${id}`, payload);
      } else {
        await api.post("/inbounds", payload);
      }
      navigate("/inbound");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title={isEdit ? `Edit Inbond ${inboundNumber}` : "New Inbond Entry"} />
      <ErrorBanner message={error} />
      {!isEdit && (
        <p className="text-xs text-slate-400 mb-4">
          Booking No. (provisional): <span className="font-mono">{nextNumber ?? "…"}</span> — assigned for real when you save.
        </p>
      )}
      {locked && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2">
          Outbounds already exist against this inbound. Stock-affecting fields and containers are locked; only
          reference, CHA, In BE, and cargo details can be edited.
        </div>
      )}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Arrival Date *">
              <Input type="date" value={inboundDate} onChange={(e) => setInboundDate(e.target.value)} disabled={locked} required />
            </Field>
            <Field label="Reference Number">
              <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
            </Field>
            <Field label="Importer *">
              <SearchableSelect
                value={importerId}
                onChange={setImporterId}
                disabled={locked}
                required
                placeholder="Select importer"
                options={importers.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))}
              />
            </Field>
            <Field label="CHA">
              <SearchableSelect
                value={chaId}
                onChange={setChaId}
                placeholder="Select CHA (optional)"
                options={chas.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
              />
            </Field>
            <Field label="In BE No *">
              <Input value={beNumber} onChange={(e) => setBeNumber(e.target.value)} required />
            </Field>
            <Field label="In BE Date *">
              <Input type="date" value={beDate} onChange={(e) => setBeDate(e.target.value)} required />
            </Field>
            <Field label="Category *">
              <SearchableSelect
                value={categoryId}
                onChange={setCategoryId}
                disabled={locked}
                required
                clearable={false}
                placeholder="Select category"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-2">
              <Field label="Cargo">
                <Input value={goodsDescription} onChange={(e) => setGoodsDescription(e.target.value)} />
              </Field>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700">Containers *</h2>
              {!locked && (
                <Button type="button" variant="secondary" onClick={addRow}>
                  + Add Container
                </Button>
              )}
            </div>
            <div className="border border-slate-200 rounded-md overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Container No. *</th>
                    <th className="px-3 py-2 text-left">Size *</th>
                    <th className="px-3 py-2 text-left">Bay *</th>
                    <th className="px-3 py-2 text-left">Crane</th>
                    <th className="px-3 py-2 text-left">Weight</th>
                    <th className="px-3 py-2 text-left">Duty Paid</th>
                    <th className="px-3 py-2 text-left">No. of Logs *</th>
                    <th className="px-3 py-2 text-left">Remarks</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <Input
                          value={row.containerNumber}
                          onChange={(e) => updateRow(idx, { containerNumber: e.target.value.toUpperCase() })}
                          disabled={locked}
                          placeholder="ABCD1234567"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={row.containerSizeId}
                          onChange={(e) => updateRow(idx, { containerSizeId: e.target.value })}
                          disabled={locked}
                          required
                        >
                          <option value="">Select</option>
                          {sizes.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select value={row.bayId} onChange={(e) => updateRow(idx, { bayId: e.target.value })} disabled={locked} required>
                          <option value="">Select bay</option>
                          {bays.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.code}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select value={row.craneId} onChange={(e) => updateRow(idx, { craneId: e.target.value })} disabled={locked}>
                          <option value="">None</option>
                          {cranes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={row.weight}
                          onChange={(e) => updateRow(idx, { weight: e.target.value })}
                          disabled={locked}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.dutyPaid}
                          onChange={(e) => updateRow(idx, { dutyPaid: e.target.checked })}
                          disabled={locked}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={row.receivedPackages}
                          onChange={(e) => updateRow(idx, { receivedPackages: e.target.value })}
                          disabled={locked}
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={row.remarks} onChange={(e) => updateRow(idx, { remarks: e.target.value })} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!locked && rows.length > 1 && (
                          <button type="button" className="text-red-600 text-xs" onClick={() => removeRow(idx)}>
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-right text-sm text-slate-600 mt-2">
              Total logs: <span className="font-semibold">{totalPackages}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Inbond"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/inbound")}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
