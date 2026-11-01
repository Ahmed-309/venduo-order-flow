import { findFabric, findTrim, type Catalogue, type Fabric, type HubId, type Placement, type Trim } from './catalogue/types';
import type { FabricSelection, TechPack, TrimSelection } from './techPack';

/** Fabrics the brand may pick: category-compatible and, once the hub is locked, offered there. */
export function availableFabrics(pack: TechPack, catalogue: Catalogue): Fabric[] {
  return catalogue.fabrics.filter(
    (fabric) =>
      fabric.categoryIds.includes(pack.categoryId) && (pack.hubId === null || fabric.offers[pack.hubId] !== undefined),
  );
}

/** Trims wait for a hub: without one there is no price or MOQ to show. */
export function availableTrims(pack: TechPack, catalogue: Catalogue): Trim[] {
  const hubId = pack.hubId;
  if (hubId === null) return [];
  return catalogue.trims.filter(
    (trim) => trim.categoryIds.includes(pack.categoryId) && trim.offers[hubId] !== undefined,
  );
}

export const canSelectTrims = (pack: TechPack): boolean => pack.hubId !== null;

/** Selected trims that the given hub cannot supply. */
export function findIncompatibleTrims(pack: TechPack, hubId: HubId, catalogue: Catalogue): TrimSelection[] {
  return pack.trims.filter((selection) => findTrim(catalogue, selection.trimId)?.offers[hubId] === undefined);
}

export function freePlacements(pack: TechPack, placements: Placement[]): Placement[] {
  const taken = new Set(pack.fabrics.map((fabric) => fabric.placement));
  return placements.filter((placement) => !taken.has(placement));
}

/**
 * Adds a fabric and, if it is the first, locks the hub. Trims the hub cannot supply are removed
 * here, so callers must offer findIncompatibleTrims() as a confirmation before calling this.
 */
export function addFabric(
  pack: TechPack,
  selection: FabricSelection,
  hubId: HubId,
  catalogue: Catalogue,
): TechPack {
  if (pack.hubId !== null && pack.hubId !== hubId) {
    throw new Error(`Pack is locked to ${pack.hubId}`);
  }
  if (findFabric(catalogue, selection.fabricId)?.offers[hubId] === undefined) {
    throw new Error(`${selection.fabricId} is not offered at ${hubId}`);
  }
  const incompatible = new Set(findIncompatibleTrims(pack, hubId, catalogue).map((trim) => trim.trimId));
  return {
    ...pack,
    hubId,
    fabrics: [...pack.fabrics, selection],
    trims: pack.trims.filter((trim) => !incompatible.has(trim.trimId)),
  };
}

/** Removing the last fabric unlocks the hub. Trims stay, provisionally, until the next hub is chosen. */
export function removeFabric(pack: TechPack, placement: Placement): TechPack {
  const fabrics = pack.fabrics.filter((fabric) => fabric.placement !== placement);
  return { ...pack, fabrics, hubId: fabrics.length === 0 ? null : pack.hubId };
}

export function addTrim(pack: TechPack, selection: TrimSelection): TechPack {
  if (pack.hubId === null) throw new Error('Trims need a hub');
  return { ...pack, trims: [...pack.trims.filter((trim) => trim.trimId !== selection.trimId), selection] };
}

export function removeTrim(pack: TechPack, trimId: string): TechPack {
  return { ...pack, trims: pack.trims.filter((trim) => trim.trimId !== trimId) };
}
