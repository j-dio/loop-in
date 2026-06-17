/**
 * ESM resolver hook: react-router-dom/server.js → react-router-dom
 *
 * React Router v7 does not export `./server.js` but vite-react-ssg@0.9.1-beta.1
 * imports it. The v7 main entry exports all the same symbols (StaticRouterProvider,
 * createStaticHandler, createStaticRouter), so we redirect to the main entry.
 */
export function resolve(specifier, context, nextResolve) {
  if (specifier === 'react-router-dom/server.js') {
    return nextResolve('react-router-dom', context);
  }
  return nextResolve(specifier, context);
}
