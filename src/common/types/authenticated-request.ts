import type { Request } from 'express';

export interface ClerkAuthContext {
  userId: string;
  sessionId: string | null;
  orgId: string | null;
  claims: Record<string, unknown>;
}

export interface AuthenticatedRequest extends Request {
  auth?: ClerkAuthContext;
  id?: string; // request id from pino
}
