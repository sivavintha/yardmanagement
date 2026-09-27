import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { Button, Card, ErrorBanner, Field, Input, PageHeader } from "../components/ui";

const MENUS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "inbound", label: "Inbond" },
  { key: "outbound", label: "Exbond" },
  { key: "gatepass", label: "Gate Pass" },
  { key: "reports", label: "Reports" },
  { key: "schedules", label: "Auto Reports" },
  { key: "masters", label: "Masters" },
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles" },
  { key: "settings", label: "Settings" },
];

// "void" was removed from the UI everywhere (per earlier feedback — no void
// buttons on Inbond/Exbond lists), so it's dropped from the permission grid
// too. The API still technically supports the permission key for any custom
// integrations, but there's nothing in the app left to gate with it.
const ACTIONS = ["view", "create", "edit", "print", "export"] as const;

const ACTION_HELP: Record<string, string> = {
  view: "See this section and its records at all.",
  create: "Add new records.",
  edit: "Change existing records.",
  print: "Print records that support it (e.g. Gate Pass).",
  export: "Download or email records as Excel/PDF (e.g. Reports, Masters lists).",
};

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [newRoleName, setNewRoleName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const { data } = await api.get("/admin/roles");
    setRoles(data);
    if (!selectedId && data[0]) setSelectedId(data[0].id);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const role = roles.find((r) => r.id === selectedId);
    if (role) setPermissions(role.permissions ?? {});
  }, [selectedId, roles]);

  function toggle(menu: string, action: string) {
    setPermissions((p) => ({
      ...p,
      [menu]: { ...p[menu], [action]: !p[menu]?.[action] },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await api.put(`/admin/roles/${selectedId}`, { permissions });
      setSaved(true);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRole(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { data } = await api.post("/admin/roles", { name: newRoleName, permissions: {} });
      setNewRoleName("");
      await load();
      setSelectedId(data.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const selectedRole = roles.find((r) => r.id === selectedId);

  return (
    <div>
      <PageHeader title="Roles & Permissions" />
      <ErrorBanner message={error} />

      <div className="flex flex-wrap gap-2 mb-4">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedId(r.id)}
            className={`px-3 py-1.5 text-sm rounded-md ${selectedId === r.id ? "bg-brand-600 text-white" : "bg-white border border-slate-300"}`}
          >
            {r.name}
          </button>
        ))}
      </div>

      <Card className="p-4 mb-6">
        <form onSubmit={handleCreateRole} className="flex gap-3 items-end max-w-md">
          <div className="flex-1">
            <Field label="New role name">
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. Yard Supervisor" />
            </Field>
          </div>
          <Button type="submit" variant="secondary" disabled={!newRoleName}>
            Create Role
          </Button>
        </form>
      </Card>

      {selectedRole && (
        <Card className="overflow-x-auto">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="font-semibold text-slate-700">{selectedRole.name}</div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Permissions"}
            </Button>
          </div>
          {saved && <div className="px-4 py-2 text-sm text-green-600">Saved.</div>}
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Menu</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="px-4 py-3 capitalize text-center" title={ACTION_HELP[a]}>
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MENUS.map((m) => (
                <tr key={m.key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{m.label}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(permissions[m.key]?.[a])}
                        onChange={() => toggle(m.key, a)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <div className="text-xs text-slate-400 mt-3 space-y-1">
        {ACTIONS.map((a) => (
          <div key={a}>
            <span className="font-medium capitalize text-slate-500">{a}</span> — {ACTION_HELP[a]}
          </div>
        ))}
      </div>
    </div>
  );
}
