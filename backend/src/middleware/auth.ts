import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { forbidden, unauthorized } from "../lib/errors";
import { MenuAction, MenuKey, Permissions, can } from "../lib/permissions";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    roleId: string;
    roleName: string;
    permissions: Permissions;
  };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw unauthorized("Login required");

  let payload: { sub: string };
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET as string) as { sub: string };
  } catch {
    throw unauthorized("Session expired, please log in again");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  });
  if (!user || !user.active) throw unauthorized("Account not active");

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
    permissions: user.role.permissions as unknown as Permissions,
  };
  next();
}

export function requirePermission(menu: MenuKey, action: MenuAction) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!can(req.user.permissions, menu, action)) {
      throw forbidden(`You do not have '${action}' access to '${menu}'`);
    }
    next();
  };
}
