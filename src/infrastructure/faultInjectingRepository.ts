import type { TechPackRepository } from '@/application/repository';

export interface FaultSettings {
  /** Added to every operation, so loading states can be seen. */
  delayMs: number;
  failReads: boolean;
  failWrites: boolean;
  /**
   * reject: the submission fails and nothing is written.
   * lost_response: the submission is written, then the caller sees a failure.
   */
  submission: 'normal' | 'reject' | 'lost_response';
}

export const NO_FAULTS: FaultSettings = { delayMs: 0, failReads: false, failWrites: false, submission: 'normal' };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wraps any repository and misbehaves on demand. Loading and failure states on screen are therefore
 * the real ones, reached through real rejected promises, with nothing mocked into the components.
 */
export function withFaults(inner: TechPackRepository, getSettings: () => FaultSettings): TechPackRepository {
  async function read<T>(operation: () => Promise<T>): Promise<T> {
    const settings = getSettings();
    await wait(settings.delayMs);
    if (settings.failReads) throw new Error('Injected read failure');
    return operation();
  }

  async function write<T>(operation: () => Promise<T>): Promise<T> {
    const settings = getSettings();
    await wait(settings.delayMs);
    if (settings.failWrites) throw new Error('Injected write failure');
    return operation();
  }

  return {
    stashUnsaved: (change) => inner.stashUnsaved(change),
    loadCatalogue: () => read(() => inner.loadCatalogue()),
    createPack: (build) => write(() => inner.createPack(build)),
    getPack: (id) => read(() => inner.getPack(id)),
    listPacks: () => read(() => inner.listPacks()),
    updatePack: (pack) => write(() => inner.updatePack(pack)),
    saveAsset: (image) => write(() => inner.saveAsset(image)),
    getAsset: (id) => read(() => inner.getAsset(id)),
    loadQuoteDraft: () => read(() => inner.loadQuoteDraft()),
    saveQuoteDraft: (draft) => write(() => inner.saveQuoteDraft(draft)),
    clearQuoteDraft: () => write(() => inner.clearQuoteDraft()),
    getRequest: (id) => read(() => inner.getRequest(id)),
    findRequestBySubmissionId: (id) => read(() => inner.findRequestBySubmissionId(id)),
    listRequests: () => read(() => inner.listRequests()),
    commitQuoteRequest: async (submissionId, build) => {
      const settings = getSettings();
      await wait(settings.delayMs);
      if (settings.submission === 'reject') throw new Error('Injected submission failure');
      const request = await inner.commitQuoteRequest(submissionId, build);
      if (settings.submission === 'lost_response') throw new Error('Injected lost response');
      return request;
    },
  };
}
