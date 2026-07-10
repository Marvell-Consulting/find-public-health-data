import type { RouteObject } from 'react-router';

export function PublicHomePage() {
  return (
    <section className="page-intro">
      <h2>Find the public health data you need.</h2>
      <p>
        This is the public application boundary. Search and discovery features will be composed here
        from shared workspace packages.
      </p>
      <div className="surface-card">Public feature packages are ready to be added.</div>
    </section>
  );
}

export function AboutPage() {
  return (
    <section className="page-intro">
      <h2>About this service</h2>
      <p>Find Public Health Data makes public health datasets easier to discover and understand.</p>
    </section>
  );
}

export const publicFeatureRoutes = [
  { index: true, Component: PublicHomePage },
  { path: 'about', Component: AboutPage },
] satisfies RouteObject[];
