import { Request, Response, NextFunction } from 'express';

/**
 * Represents the authentication context extracted from Kong headers
 * Follows immutability principles with optional fields
 */
export interface AuthContext {
  readonly storeId: string;
  readonly userEmail?: string;
  readonly externalUserId?: string;
  readonly agencyId?: string;
  readonly organizationKey?: string;
}


/**
 * Authentication Context Extraction Error
 * Provides detailed, context-specific error information
 */
export class AuthContextExtractionError extends Error {
  constructor(message: string, public readonly context: Partial<Record<keyof AuthContext, string>> = {}) {
    super(message);
    this.name = 'AuthContextExtractionError';
  }
}

/**
 * Extracts authentication context from Kong headers
 *
 * @param req Express Request object
 * @returns Validated AuthContext
 * @throws {AuthContextExtractionError} When required headers are missing or invalid
 */
export function extractAuthContext(req: Request): AuthContext {
  const headers = req.headers;

  // Extract store ID (mandatory field)
  const storeId = headers['x-introspection-store-id'];

  // First check for missing store ID
  if (!storeId ||
      (typeof storeId !== 'string') ||
      storeId.trim() === '' ||
      !/^[a-zA-Z0-9\-_]+$/.test(storeId)) {
    const error = new AuthContextExtractionError('Invalid store identity');
    error.name = 'InvalidStoreIdentityError';
    throw error;
  }

  // Safely extract optional headers
  const safeExtract = (headerKey: string): string | undefined => {
    const value = headers[headerKey];
    return value && typeof value === 'string' ? value : undefined;
  };

  return {
    storeId: storeId as string,
    userEmail: safeExtract('x-introspection-user-email'),
    externalUserId: safeExtract('x-introspection-external-user-id'),
    agencyId: safeExtract('x-introspection-agency-id'),
    organizationKey: safeExtract('x-introspection-organization-key')
  };
}

/**
 * Express middleware to attach auth context to request
 *
 * @returns Middleware function that adds authContext to request
 */
export function kongAuthMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authContext = extractAuthContext(req);
      (req as unknown as { authContext: AuthContext }).authContext = authContext;
      next();
    } catch (error) {
      if (error instanceof AuthContextExtractionError) {
        // Log the detailed error for server-side tracking
        console.error('Kong Auth Context Extraction Failed', error);

        // Customize error message based on error type
        const errorMessages: {[key: string]: string} = {
          'MissingStoreIdentityError': 'Missing store identity',
          'InvalidStoreIdentityError': 'Invalid store identity format',
          'default': 'Invalid authentication context'
        };

        res.status(401).json({
          error: 'Unauthorized',
          message: errorMessages[error.name] || errorMessages['default']
        });
      } else {
        // Unexpected errors
        next(error);
      }
    }
  };
}