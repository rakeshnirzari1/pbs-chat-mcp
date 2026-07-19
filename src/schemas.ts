import { z } from "zod";

export const pbsApiToolSchema = z.object({
  endpoint: z.enum([
    "items",
    "prescribers",
    "item-overview",
    "schedules",
    "atc-codes",
    "organisations",
    "restrictions",
    "parameters",
    "criteria",
    "copayments",
    "fees",
    "markup-bands",
    "programs",
    "summary-of-changes"
  ]),
  method: z.enum(["GET", "POST"]).default("GET"),
  params: z.record(z.unknown()).optional(),
  subscriptionKey: z.string().optional(),
  timeout: z.number().default(30000)
});

export type PbsApiToolArgs = z.infer<typeof pbsApiToolSchema>;