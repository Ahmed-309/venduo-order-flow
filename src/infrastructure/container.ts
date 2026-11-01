import type { WorkflowEnv } from '@/application/techPacks';
import { buildFixture, type FixtureName } from './demoFixtures';
import { NO_FAULTS, withFaults, type FaultSettings } from './faultInjectingRepository';
import { IndexedDbRepository } from './indexedDbRepository';

const DATABASE_NAME = 'venduo';
const FAULTS_KEY = 'venduo.faults';

export function readFaultSettings(): FaultSettings {
  const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(FAULTS_KEY);
  return stored ? { ...NO_FAULTS, ...(JSON.parse(stored) as Partial<FaultSettings>) } : NO_FAULTS;
}

export function writeFaultSettings(settings: FaultSettings): void {
  localStorage.setItem(FAULTS_KEY, JSON.stringify(settings));
}

const storage = new IndexedDbRepository(() => indexedDB, DATABASE_NAME);

/** The one place that chooses a storage implementation. Swap it here to replace IndexedDB. */
export const workflowEnv: WorkflowEnv = {
  repository: withFaults(storage, readFaultSettings),
  newId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};

/** Demo tooling writes directly to storage, so fixtures still load while faults are switched on. */
export function loadFixture(name: FixtureName): Promise<void> {
  return storage.replaceAll(buildFixture(name));
}

export type { FaultSettings, FixtureName };
