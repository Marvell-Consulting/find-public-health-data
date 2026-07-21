import type { HTMLAttributes, ReactNode } from 'react';

type GridWidth = 'one-third' | 'two-thirds' | 'one-half' | 'full';

function classNames(...names: string[]) {
  return names.filter(Boolean).join(' ');
}

interface GridColumnProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  width: GridWidth;
}

export function GridColumn({ children, className = '', width, ...props }: GridColumnProps) {
  return (
    <div {...props} className={classNames(`govuk-grid-column-${width}`, className)}>
      {children}
    </div>
  );
}

export function GridRow({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={classNames('govuk-grid-row', className)}>
      {children}
    </div>
  );
}

interface SectionBreakProps extends HTMLAttributes<HTMLHRElement> {
  size: 'm' | 'l' | 'xl';
  visible?: boolean;
}

export function SectionBreak({
  className = '',
  size,
  visible = false,
  ...props
}: SectionBreakProps) {
  return (
    <hr
      {...props}
      className={classNames(
        'govuk-section-break',
        `govuk-section-break--${size}`,
        visible ? 'govuk-section-break--visible' : '',
        className,
      )}
    />
  );
}
