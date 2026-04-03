import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './SelectionCard.module.css';

export type SelectionCardTone = 'neutral' | 'brand' | 'warm';

export interface SelectionCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  selected?: boolean;
  tone?: SelectionCardTone;
}

export function SelectionCard({
  children,
  className,
  description,
  meta,
  selected = false,
  title,
  tone = 'neutral',
  type = 'button',
  ...props
}: SelectionCardProps) {
  return (
    <button
      type={type}
      className={joinClassNames(
        styles.root,
        styles[`tone${capitalize(tone)}`],
        className,
      )}
      data-selected={selected}
      data-tone={tone}
      {...props}
    >
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        {meta ? <div className={styles.meta}>{meta}</div> : null}
      </div>
      {description ? <div className={styles.description}>{description}</div> : null}
      {children ? <div className={styles.content}>{children}</div> : null}
    </button>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}
