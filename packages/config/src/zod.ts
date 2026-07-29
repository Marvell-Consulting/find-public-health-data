// The shared zod instance on its own subpath, so a package that is not a Node runtime can
// import it without pulling in env.ts and its NodeJS.ProcessEnv reference.
export { z } from 'zod';
