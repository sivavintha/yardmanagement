import React, { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { Button, Card, ErrorBanner, Field, Input, PageHeader } from "../components/ui";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contacts, setContacts] = useState("");
  const [printFooter, setPrintFooter] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await api.get("/admin/settings");
    if (data) {
      setName(data.name ?? "");
      setAddress(data.address ?? "");
      setContacts(data.contacts ?? "");
      setPrintFooter(data.printFooter ?? "");
      setLogoUrl(data.logoUrl ?? null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      await api.put("/admin/settings", { name, address, contacts, printFooter });
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);
      const { data } = await api.post("/admin/settings/logo", formData);
      setLogoUrl(data.logoUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader title="Company Settings" />
      <ErrorBanner message={error} />
      <Card className="p-6 max-w-xl">
        <div className="mb-6">
          <div className="text-xs font-medium text-slate-600 mb-2">Company Logo</div>
          <div className="flex items-center gap-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Company logo" className="h-16 w-16 object-contain border border-slate-200 rounded-md bg-white" />
            ) : (
              <div className="h-16 w-16 flex items-center justify-center border border-dashed border-slate-300 rounded-md text-xs text-slate-400">
                No logo
              </div>
            )}
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} id="logo-upload" />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : "Upload logo"}
              </Button>
              <p className="text-xs text-slate-400 mt-1">
                PNG or JPG, up to 2MB. Recommended size ~300×300px, square, transparent background works best. Shown
                in the sidebar and on printed gate passes.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Company Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Address">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="Contacts">
            <Input value={contacts} onChange={(e) => setContacts(e.target.value)} />
          </Field>
          <Field label="Print Footer">
            <Input value={printFooter} onChange={(e) => setPrintFooter(e.target.value)} />
          </Field>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </Button>
          {saved && <span className="ml-3 text-sm text-green-600">Saved.</span>}
        </form>
      </Card>
    </div>
  );
}
