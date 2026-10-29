// Drops the optional TypeScript peer these runtime packages declare, so the web images ship none.
const withoutTypeScriptPeer = new Set(['@react-router/express', '@react-router/node']);

export const hooks = {
  readPackage(pkg) {
    if (!withoutTypeScriptPeer.has(pkg.name)) return pkg;
    const { typescript: _peer, ...peerDependencies } = pkg.peerDependencies ?? {};
    const { typescript: _meta, ...peerDependenciesMeta } = pkg.peerDependenciesMeta ?? {};
    return { ...pkg, peerDependencies, peerDependenciesMeta };
  },
};
