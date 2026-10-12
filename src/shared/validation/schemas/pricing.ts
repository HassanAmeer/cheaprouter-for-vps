import { z } from "zod";
import "@/shared/constants/routingStrategies";
import "@/shared/constants/batchEndpoints";
import "@/shared/constants/bodySize";
import "@/shared/constants/comboConfigMode";
import "@/shared/constants/providers";
import "@/shared/constants/sidebarVisibility";
import "@/shared/constants/upstreamHeaders";
import "@/shared/utils/runtimeTimeouts";

export const pricingFieldsSchema = z
  .object({
    input: z.number().min(0).optional(),
    output: z.number().min(0).optional(),
    cached: z.number().min(0).optional(),
    reasoning: z.number().min(0).optional(),
    cache_creation: z.number().min(0).optional(),
    // Written by pricingSync alongside the token fields and echoed back by the
    // dashboard's GET → PATCH round-trip; strict() would otherwise reject the
    // API's own output with an unrecognized-keys 400 (#12494).
    mode: z.string().min(1).optional(),
    input_cost_per_second: z.number().min(0).optional(),
    output_cost_per_second: z.number().min(0).optional(),
    input_cost_per_image: z.number().min(0).optional(),
    output_cost_per_image: z.number().min(0).optional(),
    input_cost_per_pixel: z.number().min(0).optional(),
    output_cost_per_pixel: z.number().min(0).optional(),
    input_cost_per_character: z.number().min(0).optional(),
    output_cost_per_character: z.number().min(0).optional(),
    input_cost_per_video_per_second: z.number().min(0).optional(),
    output_cost_per_video_per_second: z.number().min(0).optional(),
    search_unit_cost: z.number().min(0).optional(),
    ocr_cost_per_page: z.number().min(0).optional(),
  })
  .strict();

export const updatePricingSchema = z.record(
  z.string().trim().min(1),
  z.record(z.string().trim().min(1), pricingFieldsSchema)
);

export const pricingSyncSourceSchema = z.enum(["litellm"]);

export const pricingSyncRequestSchema = z
  .object({
    sources: z.array(pricingSyncSourceSchema).min(1).optional(),
    dryRun: z.boolean().optional(),
  })
  .strict();
