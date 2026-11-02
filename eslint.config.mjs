import next from 'eslint-config-next';
import nextTypescript from 'eslint-config-next/typescript';

const FRAMEWORK = ['react', 'react-dom', 'next', 'next/*'];
const BROWSER_GLOBALS = ['window', 'document', 'navigator', 'location', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch'];

/** Matches a layer however it is imported, by alias or by relative path. */
const inLayers = (...names) => names.flatMap((name) => [`**/${name}`, `**/${name}/*`]);

/** Bans imports that would break the one-way dependency direction. */
function layer(files, forbidden, message) {
  return {
    files,
    // Tests may wire layers together; production code may not.
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: forbidden, message }] }],
    },
  };
}

const config = [
  { ignores: ['.next/**', '.venv/**', 'node_modules/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
  ...next,
  ...nextTypescript,
  // Sketches are SVGs and uploads are blob URLs, neither of which next/image can optimise.
  { rules: { '@next/next/no-img-element': 'off' } },
  layer(
    ['src/domain/**'],
    [...FRAMEWORK, ...inLayers('application', 'infrastructure', 'features', 'app')],
    'Domain code is pure: no framework, storage or outer-layer imports.',
  ),
  layer(
    ['src/application/**'],
    [...FRAMEWORK, ...inLayers('infrastructure', 'features', 'app')],
    'Application workflows depend only on the domain and the repository contract.',
  ),
  layer(
    ['src/infrastructure/**'],
    [...FRAMEWORK, ...inLayers('features', 'app')],
    'Infrastructure implements the contract and knows nothing about screens.',
  ),
  {
    files: ['src/domain/**', 'src/application/**'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS.map((name) => ({ name, message: 'Domain and application code run without a browser.' })),
      ],
    },
  },
  {
    files: ['src/features/**', 'src/app/**'],
    ignores: ['src/features/shared/RepositoryProvider.tsx', 'src/features/demo/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: inLayers('infrastructure'),
              message: 'Screens reach storage through application workflows and useServices().',
            },
          ],
        },
      ],
    },
  },
];

export default config;
