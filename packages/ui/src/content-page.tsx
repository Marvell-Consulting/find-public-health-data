import type { ReactNode } from 'react';

interface PageIntroProps {
  children?: ReactNode;
  /** Step the heading down on pages whose content sits in a narrower column. */
  size?: 'l' | 'xl';
  title: string;
}

export function PageIntro({ children, size = 'xl', title }: PageIntroProps) {
  return (
    <section className={size === 'xl' ? 'page-intro' : undefined}>
      <h1 className={`govuk-heading-${size}`}>{title}</h1>
      {children}
    </section>
  );
}

export function NotFoundPage() {
  return (
    <PageIntro title="Page not found">
      <p className="govuk-body">The page you requested does not exist.</p>
    </PageIntro>
  );
}
