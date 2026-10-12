import { z } from "zod";
import "@/shared/constants/routingStrategies";
import "@/shared/constants/batchEndpoints";
import "@/shared/constants/bodySize";
import "@/shared/constants/comboConfigMode";
import "@/shared/constants/providers";
import "@/shared/constants/sidebarVisibility";
import "@/shared/constants/upstreamHeaders";
import "@/shared/utils/runtimeTimeouts";

export const cloudCredentialUpdateSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required"),
  credentials: z
    .object({
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresIn: z.coerce.number().positive().optional(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (
        value.accessToken === undefined &&
        value.refreshToken === undefined &&
        value.expiresIn === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one credential field must be provided",
          path: [],
        });
      }
    }),
});

export const cloudResolveAliasSchema = z.object({
  alias: z.string().trim().min(1, "Missing alias"),
});

export const cloudModelAliasUpdateSchema = z.object({
  model: z.string().trim().min(1, "Model and alias required"),
  alias: z.string().trim().min(1, "Model and alias required"),
});

export const cloudSyncActionSchema = z
  .object({
    action: z.enum(["enable", "sync", "disable"]),
    acknowledgeCredentialUpload: z.boolean().optional(),
  })
  .refine((value) => value.action !== "enable" || value.acknowledgeCredentialUpload === true, {
    message: "Enabling cloud sync requires acknowledgment that credentials will be uploaded",
  });
