import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface SectionProps {
  id: string;
  title: string;
  icon: string;
  children: ReactNode;
}

/** A titled content section with an icon and a fading rule. */
export function Section({ id, title, icon, children }: SectionProps) {
  return (
    <section className="section" id={id}>
      <div className="section__head">
        <span className="section__icon">
          <Icon name={icon} fixedWidth />
        </span>
        <h2 className="section__title">{title}</h2>
        <span className="section__rule" />
      </div>
      {children}
    </section>
  );
}
