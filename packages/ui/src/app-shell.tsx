import type { ReactNode } from 'react';

interface AppShellProps {
  audience: 'Public' | 'Internal';
  children: ReactNode;
  navigation: ReactNode;
}

export function AppShell({ audience, children, navigation }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <span className="audience-label">{audience}</span>
          <h1>Find Public Health Data</h1>
        </div>
        {navigation}
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
