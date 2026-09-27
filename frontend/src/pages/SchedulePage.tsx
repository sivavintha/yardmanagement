import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { api } from "../api/client";
import { Badge, Button, Card, ErrorBanner, Field, Input, PageHeader } from "../components/ui";
import SearchableSelect from "../components/SearchableSelect";
import Pagination from "../components/Pagination";

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const emptyForm = () => ({
  name: "",
  enabled: true,
  recipients: "",
  ccRecipients: "",
  subjectTemplate: "Yard Daily Report — {date}",
  bodyTemplate: "Please find attached the daily yard report for {date}.",
  attachmentType: "EXCEL",
  reportType: "STOCK_SUMMARY",
  weekdays: [1, 2, 3, 4, 5, 6] as number[],
  sendTime: "18:00",
  categoryFilter: "",
  importerFilter: "",
});

function TemplatesTab() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [categories, setCategories] = useState<any[]>([]);
  const [importers, setImporters] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  async function loadList() {
    const { data } = await api.get("/report-schedule");
    setSchedules(data);
  }

  useEffect(() => {
    loadList();
    api.get("/masters/stock-categories").then(({ data }) => setCategories(data.filter((c: any) => c.active)));
    api.get("/masters/importers").then(({ data }) => setImporters(data.filter((i: any) => i.active)));
  }, []);

  function loadIntoForm(schedule: any) {
    setSelectedId(schedule.id);
    setForm({
      name: schedule.name,
      enabled: schedule.enabled,
      recipients: schedule.recipients.join(", "),
      ccRecipients: (schedule.ccRecipients || []).join(", "),
      subjectTemplate: schedule.subjectTemplate,
      bodyTemplate: schedule.bodyTemplate,
      attachmentType: schedule.attachmentType,
      reportType: schedule.reportType,
      weekdays: schedule.weekdays,
      sendTime: schedule.sendTime,
      categoryFilter: schedule.categoryFilter ?? "",
      importerFilter: schedule.importerFilter ?? "",
    });
    setTestMsg(null);
    loadDeliveries(schedule.id);
  }

  function startNew() {
    setSelectedId(null);
    setForm(emptyForm());
    setDeliveries([]);
    setTestMsg(null);
  }

  async function loadDeliveries(id: string) {
    const { data } = await api.get(`/report-schedule/${id}/deliveries`);
    setDeliveries(data);
  }

  function toggleWeekday(v: number) {
    setForm((f) => ({ ...f, weekdays: f.weekdays.includes(v) ? f.weekdays.filter((x) => x !== v) : [...f.weekdays, v] }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        enabled: form.enabled,
        recipients: form.recipients.split(",").map((s) => s.trim()).filter(Boolean),
        ccRecipients: form.ccRecipients.split(",").map((s) => s.trim()).filter(Boolean),
        subjectTemplate: form.subjectTemplate,
        bodyTemplate: form.bodyTemplate,
        attachmentType: form.attachmentType,
        reportType: form.reportType,
        weekdays: form.weekdays,
        sendTime: form.sendTime,
        categoryFilter: form.categoryFilter || null,
        importerFilter: form.importerFilter || null,
      };
      if (selectedId) {
        await api.put(`/report-schedule/${selectedId}`, payload);
      } else {
        const { data } = await api.post("/report-schedule", payload);
        setSelectedId(data.id);
      }
      await loadList();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(schedule: any) {
    try {
      await api.post(`/report-schedule/${schedule.id}/toggle`);
      loadList();
      if (selectedId === schedule.id) loadIntoForm({ ...schedule, enabled: !schedule.enabled });
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(schedule: any) {
    if (!confirm(`Delete the "${schedule.name}" template? This can't be undone.`)) return;
    try {
      await api.delete(`/report-schedule/${schedule.id}`);
      if (selectedId === schedule.id) startNew();
      loadList();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleTestSend() {
    if (!selectedId) return;
    setTestMsg(null);
    try {
      const { data } = await api.post(`/report-schedule/${selectedId}/test`, {});
      setTestMsg(data.sent ? "Test email sent." : `Failed: ${data.error}`);
      loadDeliveries(selectedId);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader title="Templates" actions={<Button onClick={startNew}>+ New Template</Button>} />
      <ErrorBanner message={error} />

      <div className="flex flex-wrap gap-2 mb-4">
        {schedules.map((s) => (
          <button
            key={s.id}
            onClick={() => loadIntoForm(s)}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-2 ${
              selectedId === s.id ? "bg-brand-600 text-white" : "bg-white border border-slate-300"
            }`}
          >
            {s.name}
            <Badge tone={s.enabled ? "green" : "slate"}>{s.enabled ? "Active" : "Paused"}</Badge>
          </button>
        ))}
        {schedules.length === 0 && <p className="text-sm text-slate-400">No templates yet — create one below.</p>}
      </div>

      <Card className="p-6 max-w-3xl">
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Template name * (e.g. which customer this is for)">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </Field>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
              Enabled
            </label>
            {selectedId && (
              <button
                type="button"
                className="text-xs text-brand-600 hover:underline"
                onClick={() => handleToggle(schedules.find((s) => s.id === selectedId))}
              >
                {form.enabled ? "Pause" : "Resume"} this template
              </button>
            )}
          </div>

          <Field label="Recipients (comma separated)">
            <Input value={form.recipients} onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))} placeholder="user@client.com" />
          </Field>
          <Field label="CC (comma separated)">
            <Input value={form.ccRecipients} onChange={(e) => setForm((f) => ({ ...f, ccRecipients: e.target.value }))} />
          </Field>
          <Field label="Subject template">
            <Input value={form.subjectTemplate} onChange={(e) => setForm((f) => ({ ...f, subjectTemplate: e.target.value }))} />
          </Field>
          <Field label="Body template">
            <textarea
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              rows={3}
              value={form.bodyTemplate}
              onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Report Type">
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={form.reportType}
                onChange={(e) => setForm((f) => ({ ...f, reportType: e.target.value }))}
              >
                <option value="STOCK_SUMMARY">Stock Summary</option>
                <option value="OUTBOUND_DETAIL">Outbound Detail</option>
                <option value="CONSOLIDATED">Consolidated</option>
                <option value="BOTH">Both</option>
              </select>
            </Field>
            <Field label="Attachment Type">
              <select
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={form.attachmentType}
                onChange={(e) => setForm((f) => ({ ...f, attachmentType: e.target.value }))}
              >
                <option value="EXCEL">Excel</option>
                <option value="PDF">PDF</option>
                <option value="BOTH">Both</option>
              </select>
            </Field>
            <Field label="Send Time (Asia/Kolkata)">
              <Input type="time" value={form.sendTime} onChange={(e) => setForm((f) => ({ ...f, sendTime: e.target.value }))} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Party / Importer filter">
              <SearchableSelect
                value={form.importerFilter}
                onChange={(v) => setForm((f) => ({ ...f, importerFilter: v }))}
                placeholder="All importers"
                options={importers.map((i) => ({ value: i.id, label: i.name }))}
              />
            </Field>
            <Field label="Category filter">
              <SearchableSelect
                value={form.categoryFilter}
                onChange={(v) => setForm((f) => ({ ...f, categoryFilter: v }))}
                placeholder="All categories"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-600 mb-1">Weekdays</div>
            <div className="flex gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  type="button"
                  key={d.value}
                  onClick={() => toggleWeekday(d.value)}
                  className={`px-3 py-1.5 text-xs rounded-md border ${
                    form.weekdays.includes(d.value) ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-300"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : selectedId ? "Save Template" : "Create Template"}
            </Button>
            {selectedId && (
              <>
                <Button type="button" variant="secondary" onClick={handleTestSend}>
                  Send Now / Test
                </Button>
                <Button type="button" variant="danger" onClick={() => handleDelete(schedules.find((s) => s.id === selectedId))}>
                  Delete
                </Button>
              </>
            )}
          </div>
          {testMsg && <div className="text-sm text-slate-600">{testMsg}</div>}
        </form>
      </Card>

      {selectedId && (
        <>
          <h2 className="text-sm font-semibold text-slate-700 mt-8 mb-3">Recent Deliveries for this Template</h2>
          <Card className="overflow-x-auto max-w-3xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Recipients</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{dayjs.utc(d.reportDate).format("DD-MMM-YYYY")}</td>
                    <td className="px-4 py-3">{d.status}</td>
                    <td className="px-4 py-3">{d.recipients.join(", ")}</td>
                    <td className="px-4 py-3 text-red-600">{d.errorText}</td>
                  </tr>
                ))}
                {deliveries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                      No deliveries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function SentMailTab() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const { data } = await api.get("/report-schedule/deliveries/all", { params: { page, pageSize } });
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

  async function handleRetry(id: string) {
    try {
      await api.post(`/report-schedule/deliveries/${id}/retry`);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader title="Sent Mail" />
      <ErrorBanner message={error} />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Report Date</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Recipients</th>
              <th className="px-4 py-3">Attachments</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sent At</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{dayjs.utc(d.reportDate).format("DD-MMM-YYYY")}</td>
                <td className="px-4 py-3">{d.schedule?.name ?? "—"}</td>
                <td className="px-4 py-3">{d.reportType}</td>
                <td className="px-4 py-3">{d.recipients.join(", ")}</td>
                <td className="px-4 py-3">{d.attachmentNames.join(", ") || "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={d.status === "SENT" ? "green" : "red"}>{d.status}</Badge>
                </td>
                <td className="px-4 py-3">{dayjs(d.sentAt).format("DD-MMM-YYYY HH:mm")}</td>
                <td className="px-4 py-3 text-right">
                  {d.status === "FAILED" && (
                    <button className="text-brand-600 text-xs hover:underline" onClick={() => handleRetry(d.id)}>
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No mail sent yet.
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

export default function SchedulePage() {
  const [tab, setTab] = useState<"templates" | "sent">("templates");

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          className={`px-3 py-1.5 text-sm rounded-md ${tab === "templates" ? "bg-brand-600 text-white" : "bg-white border border-slate-300"}`}
          onClick={() => setTab("templates")}
        >
          Templates
        </button>
        <button
          className={`px-3 py-1.5 text-sm rounded-md ${tab === "sent" ? "bg-brand-600 text-white" : "bg-white border border-slate-300"}`}
          onClick={() => setTab("sent")}
        >
          Sent Mail
        </button>
      </div>
      {tab === "templates" ? <TemplatesTab /> : <SentMailTab />}
    </div>
  );
}
