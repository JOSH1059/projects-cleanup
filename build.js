require('esbuild').buildSync({
  entryPoints: ['index.js'],
  bundle: true,
  platform: 'node',
  outfile: 'bundle.js',
  banner: { js: '#!/usr/bin/env node' }
});
