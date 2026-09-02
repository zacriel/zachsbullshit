import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { Icon } from '../components/Icon';
import { Section } from '../components/Section';

type State = 'idle' | 'sending' | 'sent' | 'error';

/** Public contact form — posts to the contact module, with honeypot. */
export function ContactModule({ icon }: { icon: string }) {
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState({ name: '', email: '', message: '', website: '' });

  const update = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    setErrorMsg('');
    try {
      await api.post('/contact', form);
      setState('sent');
      setForm({ name: '', email: '', message: '', website: '' });
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  return (
    <Section id="contact" title="Get in touch" icon={icon}>
      <form className="contact" onSubmit={submit}>
        {state === 'sent' ? (
          <div className="center-state" style={{ minHeight: 'auto' }}>
            <Icon name="circle-check" className="section__icon" />
            <p>Thanks — your message is on its way.</p>
            <button type="button" className="btn btn--ghost" onClick={() => setState('idle')}>
              Send another
            </button>
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="c-name">Name</label>
              <input
                id="c-name"
                className="input"
                value={form.name}
                onChange={update('name')}
                required
                maxLength={120}
              />
            </div>
            <div className="field">
              <label htmlFor="c-email">Email</label>
              <input
                id="c-email"
                className="input"
                type="email"
                value={form.email}
                onChange={update('email')}
                required
                maxLength={200}
              />
            </div>
            <div className="field">
              <label htmlFor="c-msg">Message</label>
              <textarea
                id="c-msg"
                className="textarea"
                value={form.message}
                onChange={update('message')}
                required
                maxLength={4000}
              />
            </div>
            {/* Honeypot — hidden from humans */}
            <input
              className="honeypot"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={update('website')}
              aria-hidden="true"
            />
            {state === 'error' && <p style={{ color: 'var(--down)' }}>{errorMsg}</p>}
            <button className="btn btn--primary" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? (
                <>
                  <Icon name="spinner" spin /> Sending…
                </>
              ) : (
                <>
                  <Icon name="paper-plane" /> Send message
                </>
              )}
            </button>
          </>
        )}
      </form>
    </Section>
  );
}
