export type MenuAction = "view" | "create" | "edit" | "void" | "print" | "export";

export const MENUS = [
  "dashboard",
  "inbound",
  "outbound",
  "gatepass",
  "reports",
  "schedules",
  "users",
  "roles",
  "masters",
  "settings",
] as const;

export type MenuKey = (typeof MENUS)[number];

export type Permissions = Record<MenuKey, Partial<Record<MenuAction, boolean>>>;

const allTrue: Partial<Record<MenuAction, boolean>> = {
  view: true,
  create: true,
  edit: true,
  void: true,
  print: true,
  export: true,
};

export const SUPERADMIN_PERMISSIONS: Permissions = MENUS.reduce((acc, m) => {
  acc[m] = { ...allTrue };
  return acc;
}, {} as Permissions);

export const YARD_USER_PERMISSIONS: Permissions = {
  dashboard: { view: true },
  inbound: { view: true, create: true, edit: true, void: true, print: true, export: true },
  outbound: { view: true, create: true, edit: true, void: true, print: true, export: true },
  gatepass: { view: true, create: true, print: true },
  reports: { view: true, export: true },
  schedules: {},
  users: {},
  roles: {},
  masters: { view: true },
  settings: {},
};

export const VIEWER_PERMISSIONS: Permissions = {
  dashboard: { view: true },
  inbound: { view: true, export: true },
  outbound: { view: true, export: true },
  gatepass: { view: true, print: true },
  reports: { view: true, export: true },
  schedules: {},
  users: {},
  roles: {},
  masters: {},
  settings: {},
};

export function can(permissions: Permissions, menu: MenuKey, action: MenuAction): boolean {
  return Boolean(permissions?.[menu]?.[action]);
}
