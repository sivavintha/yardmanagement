import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, unauthorized } from "../lib/errors";
import { AuthedRequest, requireAuth } from "../middleware/auth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Email and password are required");

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { role: true },
  });
  if (!user || !user.active) throw unauthorized("Invalid credentials");

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) throw unauthorized("Invalid credentials");

  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "8h") as jwt.SignOptions["expiresIn"],
  });

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 8 * 60 * 60 * 1000,
  });


  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
  });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  res.json({ user: req.user });
});

router.post("/logout", async (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

export default router;
