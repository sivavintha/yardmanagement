import { z } from "zod";

/**
 * A required text field that rejects "" and whitespace-only input (e.g. a
 * name of just spaces), and trims leading/trailing whitespace from
 * whatever's saved. Use this instead of z.string().min(1, ...) for any
 * user-typed "name"-shaped field across the app.
 */
export function requiredText(label: string, maxLength = 200) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength, `${label} is too long`);
}

/** Same as requiredText, but for optional fields — blank/whitespace-only
 * input is normalized to null rather than being rejected. */
export function optionalText(maxLength = 500) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
}
