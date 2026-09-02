import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { resolveIcon } from '../icons';

interface IconProps {
  name: string | null | undefined;
  className?: string;
  fixedWidth?: boolean;
  spin?: boolean;
}

/** Renders any stored icon name via FontAwesome. */
export function Icon({ name, className, fixedWidth, spin }: IconProps) {
  return (
    <FontAwesomeIcon icon={resolveIcon(name)} className={className} fixedWidth={fixedWidth} spin={spin} />
  );
}
