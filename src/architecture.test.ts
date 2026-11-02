import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

async function ruleIdsFor(filePath: string, code: string) {
  const [result] = await new ESLint().lintText(code, { filePath });
  return result.messages.map((message) => message.ruleId);
}

/** Proves the README's claim that breaking the layer direction fails lint. */
describe('layer boundaries', { timeout: 60_000 }, () => {
  it.each([
    ['src/domain/x.ts', "import 'react';"],
    ['src/domain/x.ts', "import '@/infrastructure/container';"],
    ['src/domain/x.ts', "import '../infrastructure/container';"],
    ['src/domain/catalogue/x.ts', "import '../../application/repository';"],
    ['src/application/x.ts', "import '../features/shared/Dialog';"],
    ['src/application/x.ts', "import '@/infrastructure/container';"],
    ['src/infrastructure/x.ts', "import '../features/shared/Dialog';"],
    ['src/features/orders/x.ts', "import '../../infrastructure/container';"],
    ['src/features/orders/x.ts', "import '@/infrastructure/container';"],
  ])('%s rejects %s', async (filePath, code) => {
    expect(await ruleIdsFor(filePath, code)).toContain('no-restricted-imports');
  });

  it.each([
    ['src/domain/x.ts', "import './money';"],
    ['src/application/x.ts', "import '@/domain/money';"],
    ['src/infrastructure/x.ts', "import '../application/repository';"],
    ['src/features/orders/x.ts', "import '../../application/techPacks';"],
  ])('%s allows %s', async (filePath, code) => {
    expect(await ruleIdsFor(filePath, code)).not.toContain('no-restricted-imports');
  });

  it.each([
    ['src/domain/x.ts', 'export const x = localStorage;'],
    ['src/domain/x.ts', 'export const x = window;'],
    ['src/application/x.ts', 'export const x = indexedDB;'],
  ])('%s rejects the browser global in %s', async (filePath, code) => {
    expect(await ruleIdsFor(filePath, code)).toContain('no-restricted-globals');
  });
});
