import { href, redirect } from 'react-router';

// The internal app has no landing page of its own: the dashboard is home.
export function loader() {
  return redirect(href('/dashboard'));
}
