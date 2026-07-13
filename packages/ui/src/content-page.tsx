import type { ReactNode } from 'react';

interface PageIntroProps {
  children?: ReactNode;
  title: string;
}

export function PageIntro({ children, title }: PageIntroProps) {
  return (
    <section className="page-intro">
      <h1 className="govuk-heading-xl">{title}</h1>
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
