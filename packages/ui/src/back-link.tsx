import A from '@not-govuk/link';

export function BackLink({ children = 'Back', href }: { children?: string; href: string }) {
  return (
    <A className="govuk-back-link" href={href}>
      {children}
    </A>
  );
}
