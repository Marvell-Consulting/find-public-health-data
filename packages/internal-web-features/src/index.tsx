import type { RouteObject } from 'react-router';

export function ManageDataPage() {
  return (
    <section className="page-intro">
      <h2>Manage public health data</h2>
      <p>
        This route exists only in the internal application. Publishing and administration features
        will be composed here.
      </p>
      <div className="surface-card">Internal feature packages are ready to be added.</div>
    </section>
  );
}

export const internalFeatureRoutes = [
  { path: 'manage', Component: ManageDataPage },
] satisfies RouteObject[];
