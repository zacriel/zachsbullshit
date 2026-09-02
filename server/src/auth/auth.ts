import { Router, type Request, type RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { config } from '../config';
import { createLogger } from '../logger';

const log = createLogger('auth');

interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
}

interface TokenPayload {
  sub: number;
  username: string;
}

/**
 * Express middleware that rejects requests without a valid admin JWT.
 * Accepts either an `Authorization: Bearer <token>` header or a `token`
 * cookie, so both header-based and cookie-based clients work.
 */
export function createRequireAuth(): RequestHandler {
  return (req, res, next) => {
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = bearer || (req.cookies?.token as string | undefined);
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    try {
      const payload = jwt.verify(token, config.auth.jwtSecret) as unknown as TokenPayload;
      (req as Request & { admin?: TokenPayload }).admin = payload;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/** Auth routes: POST /login, POST /logout, GET /me. Mounted at /api/auth. */
export function createAuthRouter(db: Database.Database, requireAuth: RequestHandler): Router {
  const router = Router();

  router.post('/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }
    const { username, password } = parsed.data;
    const admin = db
      .prepare('SELECT * FROM admins WHERE username = ?')
      .get(username) as AdminRow | undefined;

    // Constant-ish response regardless of whether the user exists.
    const ok = admin ? bcrypt.compareSync(password, admin.password_hash) : false;
    if (!admin || !ok) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { sub: admin.id, username: admin.username } satisfies TokenPayload,
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
    );
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd,
      maxAge: 12 * 60 * 60 * 1000,
    });
    log.info(`Admin "${admin.username}" logged in`);
    res.json({ token, user: { id: admin.id, username: admin.username } });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req, res) => {
    const admin = (req as Request & { admin?: TokenPayload }).admin;
    res.json({ user: admin });
  });

  return router;
}
