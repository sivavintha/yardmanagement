import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { api } from "../api/client";
import { Button, Card, ErrorBanner, PageHeader } from "../components/ui";

export default function GatePassPage() {
  const { id } = useParams();
  const [gatePass, setGatePass] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [{ data: gp }, { data: s }] = await Promise.all([
          api.get(`/gate-passes/${id}`),
          api.get("/admin/settings").catch(() => ({ data: null })),
        ]);
        setGatePass(gp);
        setSettings(s);
      } catch (err: any) {
        setError(err.message);
      }
    })();
  }, [id]);

  async function handlePrint() {
    try {
      const { data } = await api.get(`/gate-passes/${id}/print`);
      setGatePass(data);
      setTimeout(() => window.print(), 100);
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (!id) {
    return (
      <div>
        <PageHeader title="Gate Pass" />
        <p className="text-slate-500">
          Issue a gate pass from the{" "}
          <Link to="/gate-pass/new" className="text-brand-600 hover:underline">
            new gate pass
          </Link>{" "}
          screen.
        </p>
      </div>
    );
  }

  if (!gatePass) return <ErrorBanner message={error} />;

  const totalPackages = gatePass.lines.reduce((s: number, l: any) => s + l.issuedPackages, 0);
  // A single gate pass can cover multiple Exbond entries/importers if the
  // same truck picked up several containers — show every distinct party.
  const parties = Array.from(
    new Map(gatePass.lines.map((l: any) => [l.outbound.inbound.importer.id, l.outbound.inbound.importer.name])).values()
  );

  return (
    <div>
      <div className="no-print">
        <PageHeader title="Gate Pass" actions={<Button onClick={handlePrint}>Print</Button>} />
      </div>
      <ErrorBanner message={error} />

      {/* print:min-h + print:flex-col + mt-auto on the signature block pins
          signatures to the bottom of the sheet without wrapping onto their
          own page. The height here is deliberately conservative (A4 is
          297mm, @page margin eats 28mm, leaving ~269mm) so it reliably fits
          on one sheet for the common case — a taller value here was
          overflowing by just enough to push the footer onto a second page.
          If there are enough containers that the table itself grows past
          this, the table's thead repeats on the next printed page (see
          index.css) rather than the layout breaking. */}
      <Card className="p-8 max-w-3xl mx-auto print:shadow-none print:border-2 print:border-slate-800 print:max-w-full print:p-6 print:min-h-0 print:[min-height:265mm] print:flex print:flex-col">
        {/* Letterhead: logo left, company name/address centered in the
            remaining width so it reads centered on the page, not just
            centered under the logo. */}
        <div className="flex items-center gap-5 border-b-2 border-slate-800 pb-4 mb-4">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Company logo" className="h-24 w-auto max-w-[300px] object-contain shrink-0" />
          ) : (
            <div className="h-24 w-32 shrink-0" />
          )}
          <div className="flex-1">
            <div className="text-xl font-bold">{settings?.name ?? "Yard Management"}</div>
            {settings?.address && <div className="text-sm text-slate-500">{settings.address}</div>}
            <div className="mt-2 text-base font-semibold tracking-widest">GATE PASS</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm mb-4">
          <div>
            <span className="text-slate-500 inline-block w-32">GP SI No.</span>: {gatePass.gatePassNumber}
          </div>
          <div>
            <span className="text-slate-500 inline-block w-32">GP Date</span>:{" "}
            {dayjs(gatePass.issuedAt).format("DD-MMM-YYYY HH:mm")}
          </div>
          <div>
            <span className="text-slate-500 inline-block w-32">Delivery Date</span>:{" "}
            {dayjs(gatePass.deliveryDate).format("DD-MMM-YYYY")}
          </div>
          <div>
            <span className="text-slate-500 inline-block w-32">Party Name</span>: {parties.join(", ")}
          </div>
          <div>
            <span className="text-slate-500 inline-block w-32">Reference</span>: {gatePass.referenceNumber ?? "—"}
          </div>
          <div>
            <span className="text-slate-500 inline-block w-32">Truck / Trailer No.</span>: {gatePass.truckNumber}
          </div>
          <div className="col-span-2">
            <span className="text-slate-500 inline-block w-32">From → To</span>: {gatePass.placeFrom} → {gatePass.placeTo}
          </div>
        </div>

        <table className="w-full text-sm border border-slate-300">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-600 bg-slate-50">
              <th className="py-2 px-2 border border-slate-300">Exbond No.</th>
              <th className="py-2 px-2 border border-slate-300">Container No.</th>
              <th className="py-2 px-2 border border-slate-300">In BE No/Date</th>
              <th className="py-2 px-2 border border-slate-300">Ex BE No/Date</th>
              <th className="py-2 px-2 border border-slate-300">Cargo</th>
              <th className="py-2 px-2 border border-slate-300">No. of Logs</th>
            </tr>
          </thead>
          <tbody>
            {gatePass.lines.map((l: any) => (
              <tr key={l.id}>
                <td className="py-1.5 px-2 border border-slate-300">{l.outbound.outboundNumber}</td>
                <td className="py-1.5 px-2 border border-slate-300">{l.inboundContainer.containerNumber}</td>
                <td className="py-1.5 px-2 border border-slate-300">
                  {l.outbound.inbound.beNumber ?? "—"}
                  {l.outbound.inbound.beDate ? ` / ${dayjs(l.outbound.inbound.beDate).format("DD-MMM-YYYY")}` : ""}
                </td>
                <td className="py-1.5 px-2 border border-slate-300">
                  {l.exBeNumber ?? "—"}
                  {l.exBeDate ? ` / ${dayjs(l.exBeDate).format("DD-MMM-YYYY")}` : ""}
                </td>
                <td className="py-1.5 px-2 border border-slate-300">{l.outbound.inbound.goodsDescription ?? "—"}</td>
                <td className="py-1.5 px-2 border border-slate-300">{l.issuedPackages}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold bg-slate-50">
              <td className="py-2 px-2 border border-slate-300" colSpan={5}>
                Total No. of Pcs
              </td>
              <td className="py-2 px-2 border border-slate-300">{totalPackages}</td>
            </tr>
          </tfoot>
        </table>

        {/* Spacer that only exists to push the signature block down on
            screen too, mirroring the print behaviour. */}
        <div className="flex-1" />

        <div className="print:mt-auto mt-10 pt-6">
          <div className="flex justify-between text-sm">
            <div className="text-center">
              <div className="border-t border-slate-400 w-48 pt-1">Signature of Yard In-charge</div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 w-48 pt-1">Name & Signature of Driver</div>
            </div>
          </div>
          {settings?.printFooter && (
            <div className="mt-6 text-xs text-center text-slate-400">{settings.printFooter}</div>
          )}
        </div>
      </Card>
    </div>
  );
}
