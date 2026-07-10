import { AppShell } from '@fphd/ui';
import { NavLink, Outlet } from 'react-router';

export function PublicApp() {
  return (
    <AppShell
      audience="Public"
      navigation={
        <nav className="app-navigation" aria-label="Primary navigation">
          <NavLink to="/" end>
            Find data
          </NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      }
    >
      <Outlet />
    </AppShell>
  );
}

export function NotFoundPage() {
  return (
    <section className="page-intro">
      <h2>Page not found</h2>
      <p>The page you requested does not exist.</p>
    </section>
  );
}
