import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      // The suite must not depend on a third party being reachable. Weather is optional by
      // design — with it off, runs forge plain swords, which is exactly the fallback path.
      HITRACE_DISABLE_WEATHER: '1',
    },
  },
});
