import { findCategory, findTrim, type Catalogue, type ReadinessRule, type Severity } from './catalogue/types';
import { areMeasurementsValid } from './grading';
import { SECTION_IDS, type SectionId, type TechPack } from './techPack';

export type SectionState = 'complete' | 'incomplete' | 'optional';

export interface ReadinessMessage {
  section: SectionId;
  severity: Severity;
  text: string;
}

export interface SectionReadiness {
  id: SectionId;
  state: SectionState;
  messages: ReadinessMessage[];
}

export interface Readiness {
  sections: SectionReadiness[];
  blockers: ReadinessMessage[];
  warnings: ReadinessMessage[];
  /** Share of the sections that block the quote which are done, from 0 to 1. */
  progress: number;
  canRequestQuote: boolean;
}

const RULE_SECTIONS: Record<ReadinessRule['kind'], SectionId> = {
  field: 'details',
  mockups: 'mockups',
  measurements: 'measurements',
  fabric_placement: 'fabrics',
  trim_kind: 'trims',
  any_trim: 'trims',
};

function isRuleSatisfied(rule: ReadinessRule, pack: TechPack, catalogue: Catalogue): boolean {
  switch (rule.kind) {
    case 'field':
      return pack[rule.field].trim().length > 0;
    case 'mockups':
      return Boolean(pack.mockups.front && pack.mockups.back);
    case 'measurements':
      return areMeasurementsValid(pack.measurements, findCategory(catalogue, pack.categoryId));
    case 'fabric_placement':
      return pack.fabrics.some((fabric) => fabric.placement === rule.placement);
    case 'trim_kind':
      return pack.trims.some((trim) => findTrim(catalogue, trim.trimId)?.kind === rule.trimKind);
    case 'any_trim':
      return pack.trims.length > 0;
  }
}

function hasContent(section: SectionId, pack: TechPack): boolean {
  switch (section) {
    case 'details':
      return pack.name.length > 0 || pack.description.length > 0;
    case 'mockups':
      return true;
    case 'measurements':
      return pack.measurements !== null;
    case 'fabrics':
      return pack.fabrics.length > 0;
    case 'trims':
      return pack.trims.length > 0;
  }
}

/** Runs the category's rule descriptors. A new garment type needs catalogue data, not code here. */
export function evaluateReadiness(pack: TechPack, catalogue: Catalogue): Readiness {
  const rules = findCategory(catalogue, pack.categoryId).rules;

  const sections = SECTION_IDS.map((id): SectionReadiness => {
    const sectionRules = rules.filter((rule) => RULE_SECTIONS[rule.kind] === id);
    const messages = sectionRules
      .filter((rule) => !isRuleSatisfied(rule, pack, catalogue))
      .map((rule): ReadinessMessage => ({ section: id, severity: rule.severity, text: rule.message }));
    const isRequired = sectionRules.some((rule) => rule.severity === 'block');
    const isBlocked = messages.some((message) => message.severity === 'block');

    let state: SectionState;
    if (isBlocked) state = 'incomplete';
    else if (isRequired || hasContent(id, pack)) state = 'complete';
    else state = 'optional';

    return { id, state, messages };
  });

  const messages = sections.flatMap((section) => section.messages);
  const blockers = messages.filter((message) => message.severity === 'block');
  const requiredSections = sections.filter((section) =>
    rules.some((rule) => RULE_SECTIONS[rule.kind] === section.id && rule.severity === 'block'),
  );
  const doneSections = requiredSections.filter((section) => section.state === 'complete');

  return {
    sections,
    blockers,
    warnings: messages.filter((message) => message.severity === 'warn'),
    progress: requiredSections.length === 0 ? 1 : doneSections.length / requiredSections.length,
    canRequestQuote: blockers.length === 0,
  };
}
