import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Button, Card, ErrorBanner, Field, Input, PageHeader, Select } from "../components/ui";
import SearchableSelect from "../components/SearchableSelect";

interface TruckLine {
  truckNumber: string;
  issuedPackages: string;
  exBeNumber: string;
  exBeDate: string;
  craneId: string;
}

const emptyLine = (): TruckLine => ({
  truckNumber: "",
  issuedPackages: "",
  exBeNumber: "",
  exBeDate: "",
  craneId: "",
});

export default function OutboundFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [cranes, setCranes] = useState<any[]>([]);
  const [nextNumber, setNextNumber] = useState<string | null>(null);

  const [outboundNumber, setOutboundNumber] = useState(""); // only populated in edit mode
  const [outboundDate, setOutboundDate] = useState(new Date().toISOString().slice(0, 10));
  const [referenceNumber, setReferenceNumber] = useState("");
  const [inboundId, setInboundId] = useState("");
  const [inboundContainerId, setInboundContainerId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<TruckLine[]>([emptyLine()]);
  const [originalTotal, setOriginalTotal] = useState(0); // fixed at load time, used for the balance display below
  const [locked, setLocked] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    (async () => {
      const [{ data: inboundData }, { data: craneData }] = await Promise.all([
        api.get("/inbounds", { params: { status: "ACTIVE" } }),
        api.get("/masters/cranes"),
      ]);
      setInbounds(inboundData);
      setCranes(craneData.filter((c: any) => c.active));
      if (!isEdit) {
        api.get("/sequence/peek/outbound").then(({ data }) => setNextNumber(data.next)).catch(() => {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await api.get(`/outbounds/${id}`);
        setOutboundNumber(data.outboundNumber);
        setOutboundDate(data.outboundDate.slice(0, 10));
        setReferenceNumber(data.referenceNumber ?? "");
        setInboundId(data.inboundId);
        setInboundContainerId(data.inboundContainerId);
        setRemarks(data.remarks ?? "");
        setLines(
          data.lines.map((l: any) => ({
            truckNumber: l.truckNumber,
            issuedPackages: String(l.issuedPackages),
            exBeNumber: l.exBeNumber ?? "",
            exBeDate: l.exBeDate ? l.exBeDate.slice(0, 10) : "",
            craneId: l.craneId ?? "",
          }))
        );
        setOriginalTotal(data.lines.reduce((s: number, l: any) => s + l.issuedPackages, 0));
        setLocked(data.lines.some((l: any) => l.gatePassId));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoaded(true);
      }
    })();
  }, [id]);

  const selectedInbound = inbounds.find((i) => i.id === inboundId);
  // In edit mode the container list needs to include the already-selected
  // container even though it may show 0 remaining (its balance already
  // accounts for this outbound's own lines).
  const availableContainers = (selectedInbound?.containers ?? []).filter(
    (c: any) => c.remainingPackages > 0 || c.id === inboundContainerId
  );
  const selectedContainer = availableContainers.find((c: any) => c.id === inboundContainerId);
  // Fixed for the life of this edit — the container's total capacity, not
  // affected by whatever the user is currently typing into the lines below.
  const containerCapacity = selectedContainer
    ? isEdit
      ? selectedContainer.remainingPackages + originalTotal
      : selectedContainer.remainingPackages
    : 0;

  useEffect(() => {
    if (!isEdit) setInboundContainerId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboundId]);

  function updateLine(idx: number, patch: Partial<TruckLine>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine()]);
  }

  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }

  const totalIssued = lines.reduce((s, l) => s + (parseInt(l.issuedPackages) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!inboundContainerId) {
      setError("Select a container to issue.");
      return;
    }
    if (lines.some((l) => !l.truckNumber || !l.issuedPackages || parseInt(l.issuedPackages) <= 0)) {
      setError("Every truck line needs a truck number and a positive quantity.");
      return;
    }
    if (lines.some((l) => !l.exBeNumber || !l.exBeDate)) {
      setError("Every truck line needs an Ex-BE No and Ex-BE Date.");
      return;
    }

    const payload = {
      outboundDate,
      referenceNumber: referenceNumber || null,
      inboundId,
      inboundContainerId,
      remarks: remarks || null,
      lines: lines.map((l) => ({
        truckNumber: l.truckNumber,
        issuedPackages: parseInt(l.issuedPackages) || 0,
        exBeNumber: l.exBeNumber || null,
        exBeDate: l.exBeDate || null,
        craneId: l.craneId || null,
      })),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/outbounds/${id}`, payload);
      } else {
        await api.post("/outbounds", payload);
      }
      navigate("/outbound");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p className="text-slate-400 text-sm">Loading…</p>;

  return (
    <div>
      <PageHeader title={isEdit ? `Edit Exbond ${outboundNumber}` : "New Exbond Entry"} />
      <ErrorBanner message={error} />
      {!isEdit && (
        <p className="text-xs text-slate-400 mb-4">
          Exbond No. (provisional): <span className="font-mono">{nextNumber ?? "…"}</span> — assigned for real when you save.
        </p>
      )}
      {locked && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2">
          One or more truck-lines on this entry are already on a gate pass — this Exbond entry can no longer be edited.
        </div>
      )}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Delivery Date *">
              <Input type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} disabled={locked} required />
            </Field>
            <Field label="Reference Number">
              <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} disabled={locked} />
            </Field>
            <Field label="Inbound *">
              <SearchableSelect
                value={inboundId}
                onChange={setInboundId}
                required
                disabled={locked || isEdit}
                placeholder="Select inbond entry"
                options={inbounds.map((i) => ({
                  value: i.id,
                  label: `${i.inboundNumber} — ${i.importer.name}`,
                  sublabel: i.category?.name,
                }))}
              />
            </Field>
          </div>

          {selectedInbound && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 rounded-md p-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Importer</div>
                <div>{selectedInbound.importer.name}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">CHA</div>
                <div>{selectedInbound.cha?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">In BE No / Date</div>
                <div>
                  {selectedInbound.beNumber ?? "—"}
                  {selectedInbound.beDate ? ` / ${new Date(selectedInbound.beDate).toLocaleDateString("en-IN")}` : ""}
                </div>
              </div>
            </div>
          )}

          {selectedInbound && (
            <Field label="Container *">
              <SearchableSelect
                value={inboundContainerId}
                onChange={setInboundContainerId}
                required
                clearable={false}
                disabled={locked || isEdit}
                placeholder="Select the container to issue from"
                options={availableContainers.map((c: any) => ({
                  value: c.id,
                  label: `${c.containerNumber} — Balance ${c.remainingPackages}`,
                }))}
              />
            </Field>
          )}
          {isEdit && !locked && (
            <p className="text-xs text-slate-400 -mt-4">Changing the container isn't supported once saved — void and re-create instead.</p>
          )}

          {selectedContainer && (
            <div className="text-sm text-slate-600 bg-slate-50 rounded-md p-3 space-y-1">
              <div>
                Container capacity: <span className="font-semibold">{containerCapacity}</span>
              </div>
              <div>
                Remaining if you save now:{" "}
                <span className={`font-semibold ${totalIssued > containerCapacity ? "text-red-600" : ""}`}>
                  {containerCapacity - totalIssued}
                </span>
              </div>
            </div>
          )}

          {selectedContainer && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  Truck lines (split this container's logs across trucks) — total {totalIssued} of {containerCapacity}
                </h2>
                {!locked && (
                  <Button type="button" variant="secondary" onClick={addLine}>
                    + Add Truck
                  </Button>
                )}
              </div>
              <div className="border border-slate-200 rounded-md overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Truck No. *</th>
                      <th className="px-3 py-2 text-left">No. of Logs *</th>
                      <th className="px-3 py-2 text-left">Ex-BE No. *</th>
                      <th className="px-3 py-2 text-left">Ex-BE Date *</th>
                      <th className="px-3 py-2 text-left">Crane</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <Input
                            value={line.truckNumber}
                            onChange={(e) => updateLine(idx, { truckNumber: e.target.value.toUpperCase() })}
                            disabled={locked}
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min={1}
                            value={line.issuedPackages}
                            onChange={(e) => updateLine(idx, { issuedPackages: e.target.value })}
                            disabled={locked}
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={line.exBeNumber} onChange={(e) => updateLine(idx, { exBeNumber: e.target.value })} disabled={locked} required />
                        </td>
                        <td className="px-3 py-2">
                          <Input type="date" value={line.exBeDate} onChange={(e) => updateLine(idx, { exBeDate: e.target.value })} disabled={locked} required />
                        </td>
                        <td className="px-3 py-2">
                          <Select value={line.craneId} onChange={(e) => updateLine(idx, { craneId: e.target.value })} disabled={locked}>
                            <option value="">None</option>
                            {cranes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!locked && lines.length > 1 && (
                            <button type="button" className="text-red-600 text-xs" onClick={() => removeLine(idx)}>
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Field label="Remarks">
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={locked} />
          </Field>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving || !selectedContainer || locked}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Exbond Entry"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/outbound")}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
