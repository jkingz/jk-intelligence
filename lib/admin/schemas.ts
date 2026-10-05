import { z } from "zod";

import { MEMBER_ROLES } from "@/types/metrics";

const BARE_HOST =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const clientName = z.string().trim().min(1).max(120);

export const domainHost = z
  .string()
  .trim()
  .min(4)
  .max(253)
  // A trailing slash is a paste artifact, not a different domain: atlas.example/ and
  // atlas.example must land on the same clients_domain_key.
  .transform((value) => value.toLowerCase().replace(/\/+$/, ""))
  .refine(
    (value) => BARE_HOST.test(value),
    "Enter a bare domain, e.g. atlas.example",
  );

export const memberRole = z.enum(MEMBER_ROLES);

export const createClientBody = z.object({
  name: clientName,
  domain: domainHost,
});

export const updateClientBody = z
  .object({
    name: clientName.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.isActive !== undefined, {
    message: "Provide a name or an isActive value",
  });

export const attachMemberBody = z.object({
  role: memberRole,
  clientId: z.uuid().nullable().optional(),
});

export type CreateClientBody = z.infer<typeof createClientBody>;
export type UpdateClientBody = z.infer<typeof updateClientBody>;
export type AttachMemberBody = z.infer<typeof attachMemberBody>;
