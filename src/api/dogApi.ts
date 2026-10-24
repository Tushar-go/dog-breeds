import { Breed, BreedGroup, BreedImage, CoatLength, RangeMetric, SizeBucket, TraitScores } from '../types/breed';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://dogapi.dog/api/v2';

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function getNumber(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : null;
}

function getString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function getStringArray(val: unknown): string[] {
  return Array.isArray(val)
    ? val.filter((item): item is string => typeof item === 'string')
    : [];
}

class HttpError extends Error {
  constructor(readonly status: number, statusText: string) {
    super(`HTTP ${status}: ${statusText}`);
  }
}

export async function fetchWithRetry(
  url: string,
  retries = 3,
  baseDelayMs = 500,
  customFetch: typeof fetch = fetch
): Promise<unknown> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await customFetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new HttpError(response.status, response.statusText);
      const json: unknown = await response.json();
      return json;
    } catch (error) {
      const permanentClientError = error instanceof HttpError &&
        error.status >= 400 && error.status < 500 &&
        error.status !== 408 && error.status !== 429;
      if (attempt === retries || permanentClientError) throw error;
    } finally {
      clearTimeout(timeout);
    }
    const delay = baseDelayMs * Math.pow(2, attempt) * (0.5 + Math.random());
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
  throw new Error('Exhausted retries');
}

export function deriveSizeBucket(maxWeightKg: number | null): SizeBucket | null {
  if (maxWeightKg === null || !Number.isFinite(maxWeightKg) || maxWeightKg <= 0) return null;
  if (maxWeightKg < 10) return 'Small';
  if (maxWeightKg < 25) return 'Medium';
  if (maxWeightKg < 45) return 'Large';
  return 'Giant';
}

function parseCoatLength(value: unknown): CoatLength | null {
  const length = getString(value).trim().toLowerCase();
  return length === 'short' || length === 'medium' || length === 'long' || length === 'wire'
    ? length : null;
}

function parseRange(raw: unknown): RangeMetric | null {
  if (!isRecord(raw)) return null;
  const min = getNumber(raw.min);
  const max = getNumber(raw.max);
  if ((min === null && max === null) || (min !== null && max !== null && min > max)) return null;
  return { min, max };
}

export const TRAIT_KEYS: ReadonlyArray<keyof TraitScores> = [
  'energy', 'barking', 'drooling', 'grooming', 'shedding', 'trainability',
  'good_with_dogs', 'exercise_minutes', 'apartment_friendly',
  'good_with_children', 'good_with_strangers',
];

function parseTraits(raw: Record<string, unknown>): TraitScores {
  const score = (key: keyof TraitScores): number | null => {
    const value = getNumber(raw[key]);
    if (value === null) return null;
    return key === 'exercise_minutes' || (value >= 1 && value <= 5) ? value : null;
  };
  return {
    energy: score('energy'), barking: score('barking'), drooling: score('drooling'),
    grooming: score('grooming'), shedding: score('shedding'), trainability: score('trainability'),
    good_with_dogs: score('good_with_dogs'), exercise_minutes: score('exercise_minutes'),
    apartment_friendly: score('apartment_friendly'), good_with_children: score('good_with_children'),
    good_with_strangers: score('good_with_strangers'),
  };
}

function parseImages(rawImages: unknown, breedId: string): BreedImage[] {
  if (!Array.isArray(rawImages)) return [];
  return rawImages.slice(0, 9).map((item, idx) => {
    const rec = isRecord(item) ? item : {};
    const attr = isRecord(rec.attribution) ? rec.attribution : {};
    return {
      id: getString(rec.id) || `${breedId}-img-${idx}`,
      url: getString(rec.url),
      // Do not disguise original/high-resolution URLs as thumbnails.
      thumbUrl: getString(rec.thumb),
      mediumUrl: getString(rec.medium),
      largeUrl: getString(rec.large),
      author: getString(attr.author),
      license: getString(attr.license),
      licenseUrl: getString(attr.license_url),
      source: getString(attr.source),
      sourceUrl: getString(attr.source_url),
    };
  }).filter((img) => Boolean(img.thumbUrl || img.mediumUrl || img.largeUrl || img.url));
}

export function normalizeBreedRecord(item: unknown, groupMap: Map<string, string>): Breed | null {
  if (!isRecord(item)) return null;
  const id = getString(item.id);
  const attrs = isRecord(item.attributes) ? item.attributes : {};
  const name = getString(attrs.name);
  if (!id.trim() || !name.trim()) return null;

  const relationships = isRecord(item.relationships) ? item.relationships : {};
  const groupRel = isRecord(relationships.group) ? relationships.group : {};
  const groupData = isRecord(groupRel.data) ? groupRel.data : {};
  const groupId = getString(groupData.id);
  const maleWeight = parseRange(attrs.male_weight);
  const femaleWeight = parseRange(attrs.female_weight);
  const origin = isRecord(attrs.origin) ? attrs.origin : {};
  const coat = isRecord(attrs.coat) ? attrs.coat : {};
  const traits = isRecord(attrs.traits) ? attrs.traits : {};
  const referenceWeight = maleWeight?.max ?? femaleWeight?.max ?? null;

  return {
    id, name,
    otherNames: getStringArray(attrs.other_names),
    description: getString(attrs.description),
    groupId,
    groupName: groupMap.get(groupId) ?? null,
    lifeSpan: parseRange(attrs.life),
    maleWeight, femaleWeight,
    maleHeight: parseRange(attrs.male_height),
    femaleHeight: parseRange(attrs.female_height),
    sizeBucket: deriveSizeBucket(referenceWeight),
    coatType: getString(coat.type).trim().toLowerCase() || null,
    coatLength: parseCoatLength(coat.length),
    coatColors: getStringArray(coat.colors),
    hypoallergenic: typeof attrs.hypoallergenic === 'boolean' ? attrs.hypoallergenic : null,
    origin: { era: getString(origin.era), region: getString(origin.region), country: getString(origin.country) },
    kennelClubs: getStringArray(attrs.recognized_by),
    temperamentTags: getStringArray(traits.temperament),
    traits: parseTraits(traits),
    images: parseImages(attrs.images, id),
  };
}

// Cached JSON is untrusted too: validate every field consumed by filtering/rendering.
export function isCachedBreed(value: unknown): value is Breed {
  if (!isRecord(value)) return false;
  const isStrings = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((item: unknown) => typeof item === 'string');
  const isNullableNumber = (v: unknown): boolean => v === null || getNumber(v) !== null;
  const isRange = (v: unknown): boolean => v === null || (isRecord(v) &&
    isNullableNumber(v.min) && isNullableNumber(v.max) &&
    (v.min === null || v.max === null || (typeof v.min === 'number' && typeof v.max === 'number' && v.min <= v.max)));
  const strings = ['id', 'name', 'description', 'groupId'];
  if (!strings.every((key) => typeof value[key] === 'string') ||
    !getString(value.id).trim() || !getString(value.name).trim()) return false;
  if (value.groupName !== null && typeof value.groupName !== 'string') return false;
  if (!['lifeSpan', 'maleWeight', 'femaleWeight', 'maleHeight', 'femaleHeight'].every((key) => isRange(value[key]))) return false;
  if (value.sizeBucket !== null && !['Small', 'Medium', 'Large', 'Giant'].includes(getString(value.sizeBucket))) return false;
  if (value.coatType !== null && typeof value.coatType !== 'string') return false;
  if (value.coatLength !== null && parseCoatLength(value.coatLength) !== value.coatLength) return false;
  if (value.hypoallergenic !== null && typeof value.hypoallergenic !== 'boolean') return false;
  if (!['otherNames', 'coatColors', 'kennelClubs', 'temperamentTags'].every((key) => isStrings(value[key]))) return false;
  const origin = value.origin;
  if (!isRecord(origin) || !['era', 'region', 'country'].every((key) => typeof origin[key] === 'string')) return false;
  const traits = value.traits;
  if (!isRecord(traits) || !TRAIT_KEYS.every((key) => traits[key] === null ||
    (getNumber(traits[key]) !== null && (key === 'exercise_minutes' ||
      (typeof traits[key] === 'number' && traits[key] >= 1 && traits[key] <= 5))))) return false;
  return Array.isArray(value.images) && value.images.every((img: unknown) =>
    isRecord(img) && ['id', 'url', 'thumbUrl', 'mediumUrl', 'largeUrl', 'author',
      'license', 'licenseUrl', 'source', 'sourceUrl'].every((key) => typeof img[key] === 'string'));
}

export async function fetchAllGroups(customFetch: typeof fetch = fetch): Promise<BreedGroup[]> {
  const json = await fetchWithRetry(`${BASE_URL}/groups?page[size]=100`, 3, 500, customFetch);
  if (!isRecord(json) || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error('Malformed groups response');
  }
  const groups: BreedGroup[] = [];
  for (const raw of json.data) {
    if (!isRecord(raw) || !isRecord(raw.attributes)) throw new Error('Malformed group');
    const id = getString(raw.id);
    const name = getString(raw.attributes.name);
    if (!id.trim() || !name.trim()) throw new Error('Malformed group');
    groups.push({ id, name });
  }
  return groups;
}

export async function fetchAllBreedsPaginated(
  groupMap: Map<string, string>,
  customFetch: typeof fetch = fetch
): Promise<{ breeds: Breed[]; partialFailure: boolean }> {
  const merged = new Map<string, Breed>();
  let partialFailure = false;
  const fetchPage = (page: number) => fetchWithRetry(
    `${BASE_URL}/breeds?page[number]=${page}&page[size]=48`, 3, 500, customFetch);
  const mergePage = (json: unknown): void => {
    if (!isRecord(json) || !Array.isArray(json.data)) {
      partialFailure = true;
      return;
    }
    for (const raw of json.data) {
      const breed = normalizeBreedRecord(raw, groupMap);
      if (breed) merged.set(breed.id, breed);
      else partialFailure = true;
    }
  };

  let first: unknown;
  try { first = await fetchPage(1); }
  catch { return { breeds: [], partialFailure: true }; }
  mergePage(first);
  const meta = isRecord(first) && isRecord(first.meta) ? first.meta : {};
  const pagination = isRecord(meta.pagination) ? meta.pagination : {};
  const last = pagination.last;
  if (typeof last !== 'number' || !Number.isSafeInteger(last) || last < 1) {
    // Without pagination metadata, completeness is unknown. Keep page 1 as partial.
    return { breeds: [...merged.values()], partialFailure: true };
  }

  for (let page = 2; page <= last; page += 2) {
    const pages = page < last ? [page, page + 1] : [page];
    const results = await Promise.allSettled(pages.map(fetchPage));
    for (const result of results) {
      if (result.status === 'fulfilled') mergePage(result.value);
      else partialFailure = true;
    }
  }
  if (typeof pagination.records === 'number' && merged.size !== pagination.records) partialFailure = true;
  return { breeds: [...merged.values()], partialFailure };
}

export async function fetchSingleBreed(
  id: string, groupMap: Map<string, string>, customFetch: typeof fetch = fetch
): Promise<Breed | null> {
  const json = await fetchWithRetry(`${BASE_URL}/breeds/${encodeURIComponent(id)}`, 3, 500, customFetch);
  return isRecord(json) ? normalizeBreedRecord(json.data, groupMap) : null;
}