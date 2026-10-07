/**
 * Base ESLint flat config for MatchUp TypeScript projects.
 *
 * Apps should extend this in their own `eslint.config.js`. Example:
 *
 *   import base from '../../packages/shared-config/eslint.base.cjs';
 *   export default [...base];
 */
// Shared base is intentionally a stub. Real ESLint config is per-app so each
// app can pick its framework-specific plugins (react, react-hooks, etc.).
module.exports = [];