/**
 * Optional seed script: populates sample links, projects, and an about
 * record. Safe to run repeatedly — it only inserts when a table is empty.
 * Usage: npm run seed
 */
import { getDb, migrateCore, seedAdmin } from '../db';
import { registerModules } from '../modules/registry';
import { config } from '../config';
import { createRequireAuth } from '../auth/auth';
import { createLogger } from '../logger';

const log = createLogger('seed');

function main(): void {
  const db = getDb();
  migrateCore(db);
  seedAdmin(db);
  // Run module migrations so tables exist.
  registerModules({ db, config, requireAuth: createRequireAuth() });

  const linkCount = (db.prepare('SELECT COUNT(*) AS n FROM links').get() as { n: number }).n;
  if (linkCount === 0) {
    const insert = db.prepare(
      'INSERT INTO links (label, url, icon, description, category, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const rows: [string, string, string, string, string, number][] = [
      ['GitHub', 'https://github.com', 'github', 'Code & open source', 'Social', 0],
      ['LinkedIn', 'https://linkedin.com', 'linkedin', 'Professional profile', 'Social', 1],
      ['X / Twitter', 'https://x.com', 'x-twitter', 'Thoughts & updates', 'Social', 2],
      ['Email', 'mailto:hello@banditchippers.com', 'envelope', 'Get in touch', 'Contact', 3],
      ['Blog', 'https://banditchippers.com/blog', 'feather', 'Writing & notes', 'Content', 4],
    ];
    const tx = db.transaction(() => rows.forEach((r) => insert.run(...r)));
    tx();
    log.info(`Seeded ${rows.length} links`);
  }

  const projectCount = (db.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }).n;
  if (projectCount === 0) {
    const insert = db.prepare(
      'INSERT INTO projects (title, description, url, repo_url, tags, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const rows: [string, string, string, string, string, string, number][] = [
      [
        'Bandit Chippers',
        'The flagship project — a modular platform built end to end.',
        'https://banditchippers.com',
        'https://github.com',
        JSON.stringify(['TypeScript', 'React', 'Node']),
        'tree',
        0,
      ],
      [
        'This Hub',
        'The charcoal-and-purple navigational hub you are looking at.',
        '',
        'https://github.com',
        JSON.stringify(['React', 'Express', 'SQLite']),
        'compass',
        1,
      ],
    ];
    const tx = db.transaction(() => rows.forEach((r) => insert.run(...r)));
    tx();
    log.info(`Seeded ${rows.length} projects`);
  }

  const about = db.prepare('SELECT name FROM about WHERE id = 1').get() as { name: string } | undefined;
  if (about && !about.name) {
    db.prepare(
      `UPDATE about SET name = ?, headline = ?, bio = ?, socials = ?, skills = ? WHERE id = 1`,
    ).run(
      'Zac Stambaugh',
      'Builder · Tinkerer · Bandit Chipper',
      'Welcome to my corner of the internet. This hub links out to everything I make and maintain.',
      JSON.stringify([
        { label: 'GitHub', url: 'https://github.com', icon: 'github' },
        { label: 'Email', url: 'mailto:hello@banditchippers.com', icon: 'envelope' },
      ]),
      JSON.stringify(['TypeScript', 'React', 'Node.js', 'SQLite', 'Railway', 'Cloudflare']),
    );
    log.info('Seeded about record');
  }

  log.info('Seed complete');
  process.exit(0);
}

main();
