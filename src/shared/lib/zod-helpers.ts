import { z } from "zod";

/**
 * An optional numeric form field. `z.coerce.number().optional()` alone is a
 * footgun: Number("") is 0, not NaN, so coercion happens BEFORE the
 * optional check ever sees an empty string as "absent" — a blank input
 * becomes a concrete 0 and then fails any .min() rather than passing as
 * unset. This treats "" (and null/undefined) as "not provided" first, then
 * hands a real value to the given number schema.
 */
export function optionalNumber(
  schema: z.ZodType<number, unknown>,
): z.ZodType<number | undefined> {
  return z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : val),
    schema.optional(),
  );
}
