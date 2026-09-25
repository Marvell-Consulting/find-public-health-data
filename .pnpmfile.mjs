// Nothing in these packages runs TypeScript, but its optional peer resolves against
// @fphd/web-server's devDependency and `pnpm deploy --prod` then ships ~24 MB of it in the web
// images. pnpm settings cannot unresolve a peer (an override of '-' leaves peers alone), so
// the hook drops it.
const withoutTypeScriptPeer = new Set(['@react-router/express', '@react-router/node']);

export const hooks = {
  readPackage(pkg) {
    if (!withoutTypeScriptPeer.has(pkg.name)) return pkg;
    const { typescript: _peer, ...peerDependencies } = pkg.peerDependencies ?? {};
    const { typescript: _meta, ...peerDependenciesMeta } = pkg.peerDependenciesMeta ?? {};
    return { ...pkg, peerDependencies, peerDependenciesMeta };
  },
};
