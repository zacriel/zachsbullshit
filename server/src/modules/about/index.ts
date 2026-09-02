import { Router } from 'express';
import { z } from 'zod';
import type { HubModule, ModuleContext } from '../../types';

/**
 * About module — a single bio record (id = 1). Public read; admin update.
 * `socials` and `skills` are stored as JSON strings.
 */

interface AboutRow {
  id: number;
  name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  socials: string;
  skills: string;
  updated_at: string;
}

const socialSchema = z.object({
  label: z.string().max(60),
  url: z.string().url().max(2048),
  icon: z.string().max(64).default('link'),
});

const updateSchema = z.object({
  name: z.string().min(1).max(120),
  headline: z.string().max(200).optional().nullable(),
  bio: z.string().max(4000).optional().nullable(),
  avatar_url: z.string().max(2048).optional().nullable().or(z.literal('')),
  socials: z.array(socialSchema).max(30).default([]),
  skills: z.array(z.string().max(60)).max(60).default([]),
});

function migrate({ db }: ModuleContext): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS about (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      name       TEXT NOT NULL DEFAULT '',
      headline   TEXT,
      bio        TEXT,
      avatar_url TEXT,
      socials    TEXT NOT NULL DEFAULT '[]',
      skills     TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const exists = db.prepare('SELECT 1 FROM about WHERE id = 1').get();
  if (!exists) {
    db.prepare("INSERT INTO about (id, name) VALUES (1, '')").run();
  }
}

function serialize(row: AboutRow) {
  const parse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return [];
    }
  };
  return { ...row, socials: parse(row.socials), skills: parse(row.skills) };
}

function register({ db, requireAuth }: ModuleContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const row = db.prepare('SELECT * FROM about WHERE id = 1').get() as AboutRow;
    res.json({ about: serialize(row) });
  });

  router.put('/', requireAuth, (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid about payload', details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    db.prepare(
      `UPDATE about SET
        name = @name, headline = @headline, bio = @bio, avatar_url = @avatar_url,
        socials = @socials, skills = @skills, updated_at = datetime('now')
       WHERE id = 1`,
    ).run({
      name: d.name,
      headline: d.headline ?? null,
      bio: d.bio ?? null,
      avatar_url: d.avatar_url || null,
      socials: JSON.stringify(d.socials),
      skills: JSON.stringify(d.skills),
    });
    const row = db.prepare('SELECT * FROM about WHERE id = 1').get() as AboutRow;
    res.json({ about: serialize(row) });
  });

  return router;
}

const aboutModule: HubModule = {
  id: 'about',
  name: 'About',
  icon: 'user',
  public: true,
  isEnabled: (c) => c.modules.about,
  migrate,
  register,
};

export default aboutModule;
