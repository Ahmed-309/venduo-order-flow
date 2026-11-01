import { findCategory, type Catalogue } from '@/domain/catalogue/types';
import type { QuoteRequest } from '@/domain/quote';
import { createTechPack, type TechPack } from '@/domain/techPack';
import type { TechPackRepository } from './repository';

/** The outside world a workflow needs, passed in so tests can control it. */
export interface WorkflowEnv {
  repository: TechPackRepository;
  newId: () => string;
  now: () => string;
}

/** Picking a category persists a draft straight away and generates its reference. */
export function createDraft(env: WorkflowEnv, catalogue: Catalogue, categoryId: string): Promise<TechPack> {
  const category = findCategory(catalogue, categoryId);
  if (category.availability !== 'available') throw new Error(`${category.name} is not available yet.`);
  return env.repository.createPack((sequence) =>
    createTechPack({ id: env.newId(), sequence, category, now: env.now() }),
  );
}

export function saveTechPack(env: WorkflowEnv, pack: TechPack): Promise<void> {
  return env.repository.updatePack({ ...pack, updatedAt: env.now() });
}

export interface BuilderData {
  catalogue: Catalogue;
  pack: TechPack | null;
}

export async function loadBuilder(env: WorkflowEnv, packId: string): Promise<BuilderData> {
  const [catalogue, pack] = await Promise.all([env.repository.loadCatalogue(), env.repository.getPack(packId)]);
  return { catalogue, pack };
}

export interface OrdersData {
  catalogue: Catalogue;
  packs: TechPack[];
  requests: QuoteRequest[];
}

export async function loadOrders(env: WorkflowEnv): Promise<OrdersData> {
  const [catalogue, packs, requests] = await Promise.all([
    env.repository.loadCatalogue(),
    env.repository.listPacks(),
    env.repository.listRequests(),
  ]);
  return {
    catalogue,
    packs: [...packs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    requests: [...requests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
  };
}
