import next from 'eslint-config-next';
import nextTypescript from 'eslint-config-next/typescript';

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
    ['react', 'react-dom', 'next', 'next/*', '@/application/*', '@/infrastructure/*', '@/features/*', '@/app/*'],
    'Domain code is pure: no framework, storage or outer-layer imports.',
  ),
  layer(
    ['src/application/**'],
    ['react', 'react-dom', 'next', 'next/*', '@/infrastructure/*', '@/features/*', '@/app/*'],
    'Application workflows depend only on the domain and the repository contract.',
  ),
  layer(
    ['src/infrastructure/**'],
    ['react', 'react-dom', 'next', 'next/*', '@/features/*', '@/app/*'],
    'Infrastructure implements the contract and knows nothing about screens.',
  ),
  {
    files: ['src/features/**', 'src/app/**'],
    ignores: ['src/features/shared/RepositoryProvider.tsx', 'src/features/demo/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/infrastructure/*'],
              message: 'Screens reach storage through application workflows and useServices().',
            },
          ],
        },
      ],
    },
  },
];

export default config;
