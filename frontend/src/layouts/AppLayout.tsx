import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Download,
  Upload,
  Truck,
  BarChart3,
  Mail,
  Package,
  Users,
  Shield,
  Settings as SettingsIcon,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const NAV_ITEMS: {
  to: string;
  label: string;
  menu: string;
  icon: LucideIcon;
}[] = [
  { to: "/", label: "Dashboard", menu: "dashboard", icon: LayoutDashboard },
  { to: "/inbound", label: "Inbond", menu: "inbound", icon: Download },
  { to: "/outbound", label: "Exbond", menu: "outbound", icon: Upload },
  { to: "/gate-pass", label: "Gate Pass", menu: "gatepass", icon: Truck },
  { to: "/reports", label: "Reports", menu: "reports", icon: BarChart3 },
  { to: "/schedule", label: "Auto Reports", menu: "schedules", icon: Mail },
  { to: "/masters", label: "Masters", menu: "masters", icon: Package },
  { to: "/users", label: "Users", menu: "users", icon: Users },
  { to: "/roles", label: "Roles", menu: "roles", icon: Shield },
  { to: "/settings", label: "Settings", menu: "settings", icon: SettingsIcon },
];

export default function AppLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    api
      .get("/admin/settings")
      .then(({ data }) => setSettings(data))
      .catch(() => {});
  }, []);

  const visibleItems = NAV_ITEMS.filter(
    (item) => can(item.menu, "view") || item.menu === "dashboard",
  );

  const sidebarContent = (
    <>
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {settings?.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt=""
              className="h-8 w-8 object-contain rounded bg-white/10 shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded bg-brand-600 shrink-0" />
          )}
          <span className="text-lg font-semibold truncate">
            {settings?.name || "Yard Management"}
          </span>
        </div>
        <button
          className="md:hidden text-slate-400 shrink-0"
          onClick={() => setMobileOpen(false)}
        >
          ✕
        </button>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-slate-800 text-sm">
        <div className="font-medium">{user?.name}</div>
        <div className="text-slate-400">{user?.roleName}</div>
        <button
          className="mt-3 flex items-center gap-1.5 text-brand-500 hover:underline"
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
        >
          <LogOut size={14} />
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden md:flex w-64 bg-slate-900 text-slate-100 flex-col no-print">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden no-print">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 text-slate-100 flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 text-white no-print">
          <button onClick={() => setMobileOpen(true)}>☰ Menu</button>
          <span className="font-semibold">
            {settings?.name || "Yard Management"}
          </span>
        </div>
        <div className="max-w-7xl mx-auto p-4 sm:p-6 print:p-0 print:max-w-none">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
