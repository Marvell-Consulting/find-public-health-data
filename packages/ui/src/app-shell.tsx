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
  children: ReactNode;
  navigation: AppNavigationItem[];
}

export function AppShell({ audience, children, navigation }: AppShellProps) {
  const isInternal = audience === 'Internal';

  return (
    <GovUKPage
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
      rebrand
      serviceHref="/"
      serviceName={serviceName}
    >
      {children}
    </GovUKPage>
  );
}
