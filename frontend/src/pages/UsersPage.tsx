import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { Badge, Button, Card, ErrorBanner, Field, Input, PageHeader, Select } from "../components/ui";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [{ data: u }, { data: r }] = await Promise.all([api.get("/admin/users"), api.get("/admin/roles")]);
      setUsers(u);
      setRoles(r);
      if (!roleId && r[0]) setRoleId(r[0].id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/users", { name, email, password, roleId });
      setName("");
      setEmail("");
      setPassword("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleActive(u: any) {
    try {
      await api.put(`/admin/users/${u.id}`, { active: !u.active });
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <PageHeader title="Users & Roles" />
      <ErrorBanner message={error} />

      <Card className="p-4 mb-6">
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Temp Password">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </Field>
          <Field label="Role">
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-4">
            <Button type="submit">Add User</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.role?.name}</td>
                <td className="px-4 py-3">
                  <Badge tone={u.active ? "green" : "red"}>{u.active ? "Active" : "Disabled"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-brand-600 text-xs hover:underline" onClick={() => toggleActive(u)}>
                    {u.active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-slate-400 mt-3">
        Manage menu-level permissions (view/create/edit/void/print/export per role) on the{" "}
        <a href="/roles" className="text-brand-600 hover:underline">
          Roles
        </a>{" "}
        screen.
      </p>
    </div>
  );
}
