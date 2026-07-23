import { createSignInRoute } from '@fphd/public-web-features';
import { getSession } from '@fphd/web-server/session';

const signInRoute = createSignInRoute('public', getSession);

export const loader = signInRoute.loader;
export const meta = signInRoute.meta;
export default signInRoute.Component;
