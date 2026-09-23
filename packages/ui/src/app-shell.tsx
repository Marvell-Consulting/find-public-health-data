import A from '@not-govuk/link';
import { GovUKPage } from '@not-govuk/page';
import type { ReactNode } from 'react';

export const serviceName = 'Find public health data';

const footerLinks = [
  { text: 'Help', href: '/help' },
  { text: 'Privacy', href: '/privacy' },
  { text: 'Cookies', href: '/cookies' },
  { text: 'Accessibility statement', href: '/accessibility' },
  { text: 'Contact', href: '/contact' },
  { text: 'Terms and conditions', href: '/terms' },
  { text: 'Rhestr o Wasanaethau Cymraeg', href: '/welsh-services' },
  {
    text: 'Government Digital Service',
    href: 'https://www.gov.uk/government/organisations/government-digital-service',
  },
];

export interface AppNavigationItem {
  href: string;
  text: string;
}

interface AppShellProps {
  audience: 'Public' | 'Internal';
  /** Where the back link above the main content goes, as GOV.UK places it. */
  backHref?: string | undefined;
  children: ReactNode;
  navigation: AppNavigationItem[];
  /** Where the service name in the header links to. */
  serviceHref?: string | undefined;
}

export function AppShell({
  audience,
  backHref,
  children,
  navigation,
  serviceHref = '/',
}: AppShellProps) {
  const isInternal = audience === 'Internal';

  return (
    <GovUKPage
      // NotGovUK's Page names the back link "Back"; it takes no link text yet.
      {...(backHref === undefined ? {} : { backHref })}
      meta={footerLinks}
      navigation={navigation}
      phase={isInternal ? 'Internal' : 'Alpha'}
      phaseBannerContent={
        isInternal ? (
          'This service is for authorised staff managing public health data.'
        ) : (
          <>
            This is a new service – your <A href="/feedback">feedback</A> will help us to improve
            it.
          </>
        )
      }
      serviceHref={serviceHref}
      serviceName={serviceName}
    >
      {children}
    </GovUKPage>
  );
}
