import { SetMetadata } from '@nestjs/common';

export const REQUIRES_VERIFIED_KEY = 'requiresVerified';

/**
 * Mark a controller or handler as requiring a verified email address.
 * The VerifiedEmailGuard reads this metadata and rejects requests whose
 * Clerk-synced user has no emailVerifiedAt timestamp.
 */
export const RequiresVerified = () => SetMetadata(REQUIRES_VERIFIED_KEY, true);
