import type { VercelRequest, VercelResponse } from '@vercel/node';

// Zero-dependency diagnostic. If this works but other endpoints 500, the crash
// is in a shared import; if this also 500s, the function runtime/build is broken;
// if this 404s, deploys aren't updating from git.
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ pong: true, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown' });
}
