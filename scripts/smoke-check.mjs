import fs from 'node:fs';

const required = [
  'package.json',
  'next.config.js',
  'app/page.tsx',
  'app/layout.tsx',
  'components/TafelApp.tsx',
  'components/TafelChart.tsx',
  'components/LocalSlopeChart.tsx',
  'lib/tafel.ts',
  'lib/csv.ts',
  'public/sample.csv'
];

const missing = required.filter((path) => !fs.existsSync(path));
if (missing.length > 0) {
  console.error('Missing files:', missing.join(', '));
  process.exit(1);
}

const nextConfig = fs.readFileSync('next.config.js', 'utf8');
if (!nextConfig.includes("output: 'export'")) {
  console.error("next.config.js must include output: 'export'");
  process.exit(1);
}

console.log('Smoke check passed.');
