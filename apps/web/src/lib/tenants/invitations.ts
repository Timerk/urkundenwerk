import { z } from "zod";

export const invitationToken = z.string().regex(/^[0-9a-f]{64}$/);
export const memberRole = z.enum(["admin", "editor", "viewer"]);

export type FormResult = {
  error?:
    | "forbidden"
    | "invalid"
    | "quota"
    | "duplicate"
    | "lastAdmin"
    | "protectedAdmin"
    | "failed";
  success?: "revoked" | "removed" | "roleSaved";
  token?: string;
};
