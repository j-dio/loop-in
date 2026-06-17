/**
 * Node.js module hooks registration for vite-react-ssg + React Router v7 compatibility.
 *
 * vite-react-ssg@0.9.1-beta.1 imports `react-router-dom/server.js` which is not
 * exported by react-router-dom v7. This preload module registers a custom ESM
 * resolver that redirects `react-router-dom/server.js` → `react-router-dom`.
 *
 * Usage: node --import ./rrd-shim-loader.mjs <script>
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register(pathToFileURL('./rrd-shim-hooks.mjs').href);
