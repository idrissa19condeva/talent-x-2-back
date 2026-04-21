import type { Request } from 'express';

export interface ClerkAuthContext {
  userId: string;
  sessionId: string | null;
  orgId: string | null;
  claims: Record<string, unknown>;
}

export type AuthenticatedRequest = Request & {
  auth?: ClerkAuthContext;
};
