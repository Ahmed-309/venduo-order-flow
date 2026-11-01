import { findCategory, findFabric, findTrim, hubName, type Catalogue } from './catalogue/types';
import type { TechPack } from './techPack';

export type MoqDriverKind = 'category' | 'hub' | 'fabric' | 'trim' | 'custom_colour';

export interface MoqDriver {
  kind: MoqDriverKind;
  label: string;
  value: number;
}

export interface EffectiveMoq {
  value: number;
  /** Every source tied at the maximum. */
  drivers: MoqDriver[];
  /** "MOQ 300 because of your custom colour." */
  reason: string;
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** The maximum of the garment, hub, chosen material and custom-colour minimums. */
export function effectiveMoq(pack: TechPack, catalogue: Catalogue): EffectiveMoq {
  const category = findCategory(catalogue, pack.categoryId);
  const hub = catalogue.hubs.find((candidate) => candidate.id === pack.hubId);
  const sources: MoqDriver[] = [
    { kind: 'category', label: `the ${category.name.toLowerCase()} minimum`, value: category.moq },
  ];

  if (hub) {
    sources.push({ kind: 'hub', label: `the ${hubName(catalogue, hub.id)} hub minimum`, value: hub.moq });
    for (const selection of pack.fabrics) {
      const fabric = findFabric(catalogue, selection.fabricId);
      const offer = fabric?.offers[hub.id];
      if (fabric && offer) sources.push({ kind: 'fabric', label: fabric.name, value: offer.moq });
    }
  }

  for (const selection of pack.trims) {
    const trim = findTrim(catalogue, selection.trimId);
    if (!trim) continue;
    // Provisional trims have no hub yet, so they count at their lowest possible minimum.
    const offers = hub ? [trim.offers[hub.id]] : Object.values(trim.offers);
    const moqs = offers.flatMap((offer) => (offer ? [offer.moq] : []));
    if (moqs.length > 0) sources.push({ kind: 'trim', label: trim.name, value: Math.min(...moqs) });
  }

  if (pack.fabrics.some((fabric) => fabric.colour.kind === 'custom')) {
    sources.push({ kind: 'custom_colour', label: 'your custom colour', value: catalogue.pricing.customColour.moq });
  }

  const value = Math.max(...sources.map((source) => source.value));
  const drivers = sources.filter((source) => source.value === value);
  const labels = [...new Set(drivers.map((driver) => driver.label))];
  return { value, drivers, reason: `MOQ ${value} because of ${joinLabels(labels)}.` };
}
