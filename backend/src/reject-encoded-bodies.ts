import type { NextFunction, Request, Response } from 'express';

/**
 * Rejects request bodies sent with a Content-Encoding other than identity.
 *
 * body-parser 2 (Express 5) decompresses gzip, deflate and br bodies before
 * parsing them, which exposes the runtime's decoders to anyone on the internet
 * (see CVE-2026-111497, a Brotli decoder out-of-bounds write fixed in Node
 * 22.23.4). None of our clients compress request bodies, so we refuse them with
 * 415 before any parser runs. Register it before the body parsers.
 */
export function rejectEncodedBodies(req: Request, res: Response, next: NextFunction): void {
  const encoding = req.headers['content-encoding'];
  if (encoding === undefined || /^\s*identity\s*$/i.test(encoding)) {
    next();
    return;
  }

  res.setHeader('Accept-Encoding', 'identity');
  res.status(415).json({ statusCode: 415, message: 'Compressed request bodies are not supported' });
}
