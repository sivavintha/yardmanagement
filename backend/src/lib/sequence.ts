import { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient;

const FORMATS: Record<string, { prefix: string; pad: number }> = {
  inbound: { prefix: "IB", pad: 6 },
  outbound: { prefix: "EX", pad: 6 },
  gatepass: { prefix: "", pad: 6 }, // plain zero-padded, matches the legacy "GP SI No" style
  importer: { prefix: "IMP", pad: 4 },
  cha: { prefix: "CHA", pad: 4 },
  bay: { prefix: "BAY", pad: 4 },
  crane: { prefix: "CRN", pad: 4 },
};

type SequenceKey = keyof typeof FORMATS;

function format(key: SequenceKey, value: number): string {
  const f = FORMATS[key];
  return `${f.prefix}${String(value).padStart(f.pad, "0")}`;
}

/**
 * Atomically returns the next formatted number for `key` (e.g. "inbound" ->
 * "TY000012"). Must be called inside the same $transaction that creates the
 * record being numbered — it row-locks the Sequence row via a raw UPDATE ...
 * RETURNING, so two concurrent submissions can never be handed the same
 * number, and a failed/rolled-back creation doesn't burn a number either
 * (the increment rolls back with everything else in the transaction).
 */
export async function nextNumber(tx: Tx, key: keyof typeof FORMATS): Promise<string> {
  const f = FORMATS[key];
  if (!f) throw new Error(`Unknown sequence key: ${key}`);

  await tx.sequence.upsert({
    where: { key },
    update: {},
    create: { key, currentValue: 0 },
  });

  const rows = await tx.$queryRaw<{ currentValue: number }[]>`
    UPDATE "Sequence" SET "currentValue" = "currentValue" + 1
    WHERE key = ${key}
    RETURNING "currentValue"`;

  return format(key, rows[0].currentValue);
}

/**
 * Read-only preview of what the NEXT number will look like, for showing on
 * the entry screen before the record is saved. Does not increment or lock
 * anything, so it's just a best-effort preview — if two users have the form
 * open at once, whoever saves first gets this exact number and the other
 * gets the one after. Labelled "provisional" in the UI for that reason.
 */
export async function peekNextNumber(prisma: PrismaClient, key: keyof typeof FORMATS): Promise<string> {
  const f = FORMATS[key];
  if (!f) throw new Error(`Unknown sequence key: ${key}`);
  const row = await prisma.sequence.findUnique({ where: { key } });
  return format(key, (row?.currentValue ?? 0) + 1);
}
