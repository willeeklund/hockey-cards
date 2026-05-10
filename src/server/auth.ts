import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

/**
 * HTTP Basic auth middleware. Enabled only when BOTH `BASIC_AUTH_USER` and
 * `BASIC_AUTH_PASSWORD` are set in the environment — otherwise this is a
 * no-op pass-through (used in local dev).
 */
export function basicAuth() {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  if (!user || !pass) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const expected = Buffer.from(`${user}:${pass}`);

  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Basic ')) {
      const provided = Buffer.from(header.slice('Basic '.length), 'base64');
      if (
        provided.length === expected.length &&
        timingSafeEqual(provided, expected)
      ) {
        return next();
      }
    }
    res.setHeader('WWW-Authenticate', 'Basic realm="cards"');
    res.status(401).send('Authentication required');
  };
}
