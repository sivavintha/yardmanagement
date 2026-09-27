import { Router } from "express";
import { prisma } from "../lib/prisma";
import { badRequest } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { peekNextNumber } from "../lib/sequence";

const router = Router();
router.use(requireAuth);

const VALID_KEYS = ["inbound", "outbound", "gatepass", "importer", "cha", "bay", "crane"] as const;

// Lets entry screens show "the next code will be IB000012" before saving.
router.get("/peek/:key", async (req, res) => {
  const key = req.params.key as (typeof VALID_KEYS)[number];
  if (!VALID_KEYS.includes(key)) throw badRequest("Unknown sequence key");
  const value = await peekNextNumber(prisma, key);
  res.json({ key, next: value });
});

export default router;
