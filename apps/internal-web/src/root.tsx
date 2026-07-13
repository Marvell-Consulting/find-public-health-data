import '@fphd/ui/styles.scss';

import { AppDocument, AppShell, createDocumentMeta } from '@fphd/ui';
import { Outlet } from 'react-router';

const navigation = [
  { href: '/', text: 'Home' },
  { href: '/releases', text: 'Releases' },
  { href: '/manage', text: 'Manage data' },
];

export const Layout = AppDocument;
export const meta = createDocumentMeta();

export default function InternalApp() {
  return (
    <AppShell audience="Internal" navigation={navigation}>
      <Outlet />
    </AppShell>
  );
}
