import { defineConfig } from 'vite';

// Minimal config: the project root is the project dir. Phase 1 is served
// as plain static files (index.html + src/*); Vite is here for the dev
// server / future build pipeline as modules get wired in.
export default defineConfig({
  root: '.',
});
