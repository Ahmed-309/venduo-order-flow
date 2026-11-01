'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { WorkflowEnv } from '@/application/techPacks';
import { workflowEnv } from '@/infrastructure/container';

const ServicesContext = createContext<WorkflowEnv>(workflowEnv);

/** Screens get storage and clocks from here, which is the only route from a screen to infrastructure. */
export function ServicesProvider({ children }: { children: ReactNode }) {
  return <ServicesContext.Provider value={workflowEnv}>{children}</ServicesContext.Provider>;
}

export const useServices = (): WorkflowEnv => useContext(ServicesContext);
