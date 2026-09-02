import { useState } from 'react';
import { Icon } from './Icon';

/**
 * Pick a FontAwesome icon from a curated set, or type any exact name.
 * The text box holds the current value (so custom names still work); the
 * grid below is a quick-pick that also filters as you type.
 */
const CHOICES: string[] = [
  // Brands
  'github', 'gitlab', 'linkedin', 'x-twitter', 'youtube', 'twitch', 'discord',
  'instagram', 'facebook', 'mastodon', 'reddit', 'steam', 'spotify', 'tiktok',
  'medium', 'stack-overflow', 'docker', 'node-js', 'react', 'python', 'aws',
  // Solid
  'link', 'envelope', 'globe', 'house', 'server', 'cube', 'database', 'terminal',
  'code', 'code-branch', 'rss', 'feather', 'book', 'gamepad', 'heart', 'star',
  'folder', 'image', 'music', 'video', 'gauge', 'wrench', 'cloud', 'shield-halved',
  'network-wired', 'hard-drive', 'microchip', 'tower-broadcast', 'bolt', 'fire',
];

export function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [q, setQ] = useState('');
  const filtered = q ? CHOICES.filter((n) => n.includes(q.toLowerCase().trim())) : CHOICES;

  return (
    <div className="iconpicker">
      <div className="iconpicker__row">
        <span className="iconpicker__current">
          <Icon name={value || 'link'} />
        </span>
        <input
          className="input"
          value={value}
          placeholder="Icon name (or pick below)"
          onChange={(e) => {
            onChange(e.target.value);
            setQ(e.target.value);
          }}
        />
      </div>
      <div className="iconpicker__grid">
        {filtered.map((name) => (
          <button
            key={name}
            type="button"
            className={`iconpicker__item ${value === name ? 'iconpicker__item--sel' : ''}`}
            title={name}
            onClick={() => {
              onChange(name);
              setQ('');
            }}
          >
            <Icon name={name} />
          </button>
        ))}
        {filtered.length === 0 && <span className="admin-row__muted" style={{ padding: 8 }}>No matches — the typed name will still be used.</span>}
      </div>
    </div>
  );
}
