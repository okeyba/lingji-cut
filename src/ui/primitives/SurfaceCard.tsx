import type { HTMLAttributes } from 'react';
import styles from './SurfaceCard.module.css';

export type SurfaceCardVariant =
  | 'default'
  | 'subtle'
  | 'elevated'
  | 'brand'
  | 'warm'
  | 'danger';
export type SurfaceCardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceCardVariant;
  padding?: SurfaceCardPadding;
  interactive?: boolean;
}

export function SurfaceCard({
  children,
  className,
  interactive = false,
  padding = 'md',
  variant = 'default',
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={joinClassNames(
        styles.root,
        styles[`padding${capitalize(padding)}`],
        styles[`variant${capitalize(variant)}`],
        interactive ? styles.interactive : '',
        className,
      )}
      data-padding={padding}
      data-variant={variant}
      {...props}
    >
      {children}
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}
