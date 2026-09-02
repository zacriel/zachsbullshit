import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { HubModule, ModuleContext } from '../../types';
import { createLogger } from '../../logger';

const log = createLogger('contact');

/**
 * Contact module — a public submission form + admin inbox. Messages are
 * stored in SQLite. Submission is rate-limited to deter spam.
 */

interface MessageRow {
  id: number;
  name: string;
  email: string;
  message: string;
  read: number;
  created_at: string;
}

const submitSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  message: z.string().min(1).max(4000),
  // Honeypot — must stay empty. Bots fill everything.
  website: z.string().max(0).optional(),
});

function migrate({ db }: ModuleContext): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      message    TEXT NOT NULL,
      read       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function serialize(row: MessageRow) {
  return { ...row, read: !!row.read };
}

function register({ db, requireAuth }: ModuleContext): Router {
  const router = Router();

  const submitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many messages — please try again later.' },
  });

  // Public submit.
  router.post('/', submitLimiter, (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid submission', details: parsed.error.flatten() });
      return;
    }
    const { website, name, email, message } = parsed.data;
    if (website) {
      // Honeypot tripped — pretend success, store nothing.
      res.status(202).json({ ok: true });
      return;
    }
    db.prepare('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)').run(
      name,
      email,
      message,
    );
    log.info(`New contact message from ${email}`);
    res.status(201).json({ ok: true });
  });

  // Admin inbox.
  router.get('/', requireAuth, (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM contact_messages ORDER BY created_at DESC, id DESC')
      .all() as MessageRow[];
    res.json({ messages: rows.map(serialize), unread: rows.filter((r) => !r.read).length });
  });

  router.patch('/:id/read', requireAuth, (req, res) => {
    const info = db
      .prepare('UPDATE contact_messages SET read = 1 WHERE id = ?')
      .run(Number(req.params.id));
    if (info.changes === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    res.json({ ok: true });
  });

  router.delete('/:id', requireAuth, (req, res) => {
    const info = db.prepare('DELETE FROM contact_messages WHERE id = ?').run(Number(req.params.id));
    if (info.changes === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}

const contactModule: HubModule = {
  id: 'contact',
  name: 'Contact',
  icon: 'envelope',
  public: true,
  isEnabled: (c) => c.modules.contact,
  migrate,
  register,
};

export default contactModule;
