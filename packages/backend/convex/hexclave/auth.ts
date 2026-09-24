import { z } from "zod";

import type { MutationCtx, QueryCtx } from "../_generated/server";
import { fail } from "../model/errors";

type AuthCtx = Pick<MutationCtx | QueryCtx, "auth">;

const hexclaveUserSchema = z.object({
  email: z.string().nullable(),
  id: z.string().min(1),
  isAnonymous: z.boolean(),
  isRestricted: z.boolean(),
  name: z.string().nullable(),
  role: z.literal("authenticated"),
});

export type HexclaveUser = z.infer<typeof hexclaveUserSchema>;

async function getCurrentHexclaveUser(ctx: AuthCtx): Promise<HexclaveUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const parsedUser = hexclaveUserSchema.safeParse({
    email: identity.email ?? null,
    id: identity.subject,
    isAnonymous: identity.is_anonymous,
    isRestricted: identity.is_restricted,
    name: identity.name ?? null,
    role: identity.role,
  });
  return parsedUser.success ? parsedUser.data : null;
}

/** The one way Convex functions read the caller, so none can skip the restricted-account rule. */
export async function requireCurrentHexclaveUser(ctx: AuthCtx): Promise<HexclaveUser> {
  const user = await getCurrentHexclaveUser(ctx);
  if (!user) fail("UNAUTHENTICATED", "Sign in or play as a guest to continue.");

  // Guests (anonymous users) can play. Hexclave always flags them restricted, so only non-guest
  // restricted accounts (e.g. an unverified email) are turned away.
  if (user.isRestricted && !user.isAnonymous) {
    fail("ACCOUNT_RESTRICTED", "Finish setting up your account to play.");
  }

  return user;
}
