import '@fphd/ui/styles.scss';

import { AppDocument, AppShell, formatDocumentTitle } from '@fphd/ui';
import { Outlet } from 'react-router';

const navigation = [
  { href: '/', text: 'Home' },
  { href: '/releases', text: 'Releases' },
  { href: '/sign-in', text: 'Sign in' },
];

export const Layout = AppDocument;
export const meta = () => [{ title: formatDocumentTitle() }];

export default function PublicApp() {
  return (
    <AppShell audience="Public" highlightCurrentNavigation={false} navigation={navigation}>
      <Outlet />
    </AppShell>
  );
}
