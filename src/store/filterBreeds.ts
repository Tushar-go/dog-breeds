import { Breed, FilterState } from '../types/breed';

export type ListItem =
  | { type: 'header'; title: string }
  | { type: 'row'; breed: Breed };

export function filterAndGroupBreeds(
  breedsById: Record<string, Breed>, breedIds: string[], filters: FilterState
): ListItem[] {
  const q = filters.searchQuery.trim().toLowerCase();
  const grouped = new Map<string, Breed[]>();
  const meetsThreshold = (score: number | null, threshold: number) =>
    threshold <= 0 || (score !== null && score >= threshold);

  for (const id of breedIds) {
    const b = breedsById[id];
    if (!b) continue;
    if (q && !b.name.toLowerCase().includes(q) &&
      !b.otherNames.some((alias) => alias.toLowerCase().includes(q))) continue;
    if (filters.groups.length > 0 &&
      !filters.groups.some((group) => b.groupName?.toLowerCase() === group.toLowerCase())) continue;
    if (filters.sizes.length > 0 &&
      (b.sizeBucket === null || !filters.sizes.includes(b.sizeBucket))) continue;
    if (filters.coats.length > 0 && !filters.coats.some((coat) =>
      coat === b.coatLength || coat === b.coatType?.toLowerCase())) continue;
    if (filters.hypoallergenicOnly !== null && b.hypoallergenic !== filters.hypoallergenicOnly) continue;
    if (!meetsThreshold(b.traits.good_with_children, filters.minChildFriendly) ||
      !meetsThreshold(b.traits.good_with_dogs, filters.minDogFriendly) ||
      !meetsThreshold(b.traits.good_with_strangers, filters.minStrangerFriendly)) continue;

    const group = b.groupName ?? 'Unknown Group';
    const list = grouped.get(group) ?? [];
    list.push(b);
    grouped.set(group, list);
  }

  const flattened: ListItem[] = [];
  for (const group of [...grouped.keys()].sort()) {
    const items = grouped.get(group) ?? [];
    flattened.push({ type: 'header', title: `${group} (${items.length})` });
    for (const breed of items) flattened.push({ type: 'row', breed });
  }
  return flattened;
}