import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { Button, Card, ErrorBanner, Field, Input, PageHeader } from "../components/ui";
import SearchableSelect from "../components/SearchableSelect";

export default function GatePassFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [availableTrucks, setAvailableTrucks] = useState<string[]>([]);
  const [truckNumber, setTruckNumber] = useState(searchParams.get("truckNumber") ?? "");
  const [preview, setPreview] = useState<any[]>([]);
  const [placeFrom, setPlaceFrom] = useState("");
  const [placeTo, setPlaceTo] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/gate-passes/available-trucks");
      setAvailableTrucks(data);
    })();
  }, []);

  useEffect(() => {
    if (!truckNumber) {
      setPreview([]);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get(`/gate-passes/preview/${encodeURIComponent(truckNumber)}`);
        setPreview(data);
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, [truckNumber]);

  const totalPackages = preview.reduce((s, l) => s + l.issuedPackages, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { data } = await api.post("/gate-passes", {
        truckNumber,
        placeFrom,
        placeTo,
        referenceNumber: referenceNumber || null,
        deliveryDate,
      });
      navigate(`/gate-pass/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Gate Pass" />
      <ErrorBanner message={error} />
      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Truck No. *">
            {availableTrucks.length === 0 ? (
              <p className="text-sm text-slate-400">No trucks with pending, un-passed exbond lines right now.</p>
            ) : (
              <SearchableSelect
                value={truckNumber}
                onChange={setTruckNumber}
                required
                clearable={false}
                placeholder="Select truck"
                options={availableTrucks.map((t) => ({ value: t, label: t }))}
              />
            )}
          </Field>

          {truckNumber && preview.length > 0 && (
            <div className="bg-slate-50 rounded-md p-3 text-sm">
              <div className="text-xs text-slate-500 mb-2">
                Active exbond lines on this truck (pulled from {new Set(preview.map((l) => l.outbound.outboundNumber)).size} entr
                {new Set(preview.map((l) => l.outbound.outboundNumber)).size === 1 ? "y" : "ies"})
              </div>
              <table className="w-full text-xs">
                <thead className="text-slate-400 text-left">
                  <tr>
                    <th className="py-1">Exbond No.</th>
                    <th className="py-1">Container</th>
                    <th className="py-1">Importer</th>
                    <th className="py-1">Ex-BE No.</th>
                    <th className="py-1">Logs</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((l) => (
                    <tr key={l.id} className="border-t border-slate-200">
                      <td className="py-1">{l.outbound.outboundNumber}</td>
                      <td className="py-1">{l.inboundContainer.containerNumber}</td>
                      <td className="py-1">{l.outbound.inbound.importer.name}</td>
                      <td className="py-1">{l.exBeNumber ?? "—"}</td>
                      <td className="py-1">{l.issuedPackages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-right text-sm font-semibold mt-2">Total: {totalPackages} logs</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Delivery Date *">
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required />
            </Field>
            <Field label="Reference Number">
              <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
            </Field>
            <Field label="Place From *">
              <Input value={placeFrom} onChange={(e) => setPlaceFrom(e.target.value)} required />
            </Field>
            <Field label="Place To *">
              <Input value={placeTo} onChange={(e) => setPlaceTo(e.target.value)} required />
            </Field>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving || !truckNumber || preview.length === 0}>
              {saving ? "Saving…" : "Generate Gate Pass"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate("/gate-pass")}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
