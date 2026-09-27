import { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Prisma unique constraint violation
  if (typeof err === "object" && err && (err as any).code === "P2002") {
    const target = (err as any).meta?.target?.join?.(", ") ?? "field";
    return res.status(409).json({ error: `A record with this ${target} already exists.` });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}
