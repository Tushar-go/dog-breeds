import {
  deriveSizeBucket,
  fetchAllBreedsPaginated,
  fetchWithRetry,
  normalizeBreedRecord,
} from '../src/api/dogApi';
import { filterAndGroupBreeds } from '../src/store/filterBreeds';
import { Breed } from '../src/types/breed';

describe('Tripare Dog Breed Explorer — Unit Tests', () => {
  test('1. Size band derivation maps weight ranges accurately', () => {
    expect(deriveSizeBucket(5)).toBe('Small');
    expect(deriveSizeBucket(18)).toBe('Medium');
    expect(deriveSizeBucket(32)).toBe('Large');
    expect(deriveSizeBucket(65)).toBe('Giant');
  });

  test('2. Real Dog API v2 JSON:API schema normalization (no fake fallbacks)', () => {
    const groupMap = new Map([['grp-working', 'Working Group']]);
    const realApiRecord = {
      id: 'da3946bb-9281-4ee3-b39a-f4434a433628',
      type: 'breed',
      attributes: {
        name: 'Caucasian Shepherd Dog',
        description: 'Serious guardian breed.',
        life: { min: 10, max: 12 },
        male_weight: { min: 50, max: 70 },
        female_weight: { min: 45, max: 60 },
        male_height: { min: 67, max: 75 },
        female_height: { min: 64, max: 70 },
        hypoallergenic: false,
        other_names: ['Caucasian Ovcharka', 'Nagazi'],
        recognized_by: ['AKC', 'FCI', 'UKC'],
        origin: {
          country: 'Georgia',
          region: 'Caucasus Mountains',
          era: 'antiquity',
        },
        coat: {
          type: 'double',
          length: 'long',
          colors: ['gray', 'fawn'],
        },
        traits: {
          energy: 3,
          barking: 3,
          drooling: 2,
          grooming: 4,
          shedding: 4,
          trainability: 3,
          good_with_dogs: 2,
          exercise_minutes: 60,
          apartment_friendly: 1,
          good_with_children: 3,
          good_with_strangers: 1,
          temperament: ['fearless', 'self-confident', 'territorial'],
        },
        images: [
          {
            url: 'https://images.dogapi.dog/caucasian-shepherd-dog.jpg',
            thumb: 'https://images.dogapi.dog/caucasian-shepherd-dog-thumb.webp',
            medium: 'https://images.dogapi.dog/caucasian-shepherd-dog-medium.webp',
            large: 'https://images.dogapi.dog/caucasian-shepherd-dog-large.webp',
            attribution: {
              author: 'Magdalena Niemiec',
              license: 'CC BY-SA 3.0',
              license_url: 'https://creativecommons.org/licenses/by-sa/3.0/',
              source: 'wikimedia_commons',
              source_url: 'https://commons.wikimedia.org/wiki/File:Test.jpg',
            },
          },
        ],
      },
      relationships: {
        group: { data: { id: 'grp-working', type: 'group' } },
      },
    };

    const parsed = normalizeBreedRecord(realApiRecord, groupMap);
    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe('Caucasian Shepherd Dog');
    expect(parsed?.groupName).toBe('Working Group');
    expect(parsed?.sizeBucket).toBe('Giant');
    expect(parsed?.coatLength).toBe('long');
    expect(parsed?.temperamentTags).toContain('fearless');
    expect(parsed?.kennelClubs).toEqual(['AKC', 'FCI', 'UKC']);
    expect(parsed?.images[0]?.author).toBe('Magdalena Niemiec');
    expect(parsed?.images[0]?.thumbUrl).toContain('-thumb.webp');
  });

  test('3. Exponential backoff retries transient failures and resolves', async () => {
    let calls = 0;
    const mockFetch = jest.fn(async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error('Network timeout');
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ data: [{ id: 'ok' }] }),
      } as unknown as Response;
    });

    const data = await fetchWithRetry('https://dogapi.dog/api/v2/groups', 3, 10, mockFetch);
    expect(calls).toBe(3);
    expect(data).toEqual({ data: [{ id: 'ok' }] });
  });

  test('4. Paginated 6-page fetcher merges records and flags partial failures', async () => {
    const groupMap = new Map([['g1', 'Toy Group']]);
    const mockFetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('page[number]=3')) {
        return { ok: false, status: 500, statusText: 'Server Error' } as Response;
      }
      const pageMatch = url.match(/page\[number\]=(\d+)/);
      const pageNum = pageMatch ? pageMatch[1] : '1';
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            {
              id: `breed-page-${pageNum}`,
              attributes: {
                name: `Breed ${pageNum}`,
                male_weight: { min: 4, max: 7 },
                coat: { type: 'smooth', length: 'short' },
                traits: { energy: 4, temperament: ['alert'] },
              },
              relationships: { group: { data: { id: 'g1' } } },
            },
          ],
        }),
      } as unknown as Response;
    });

    const { breeds, partialFailure } = await fetchAllBreedsPaginated(groupMap, mockFetch);
    expect(partialFailure).toBe(true);
    expect(breeds.length).toBe(5); // 5 succeeded pages out of 6
  });

  test('5. Multi-select filter narrows breeds by alias, coat, hypoallergenic & trait score', () => {
    const b1: Breed = {
      id: '1',
      name: 'Standard Schnauzer',
      otherNames: ['Mittelschnauzer'],
      description: 'Alert guardian',
      groupId: 'g1',
      groupName: 'Working Group',
      lifeSpan: { min: 13, max: 16 },
      maleWeight: { min: 14, max: 20 },
      femaleWeight: { min: 14, max: 18 },
      maleHeight: { min: 45, max: 50 },
      femaleHeight: { min: 42, max: 47 },
      sizeBucket: 'Medium',
      coatType: 'wire',
      coatLength: 'wire',
      coatColors: ['salt and pepper'],
      hypoallergenic: true,
      origin: { country: 'Germany', region: 'Bavaria', era: '15th century' },
      kennelClubs: ['AKC', 'FCI'],
      temperamentTags: ['intelligent'],
      traits: {
        energy: 4,
        barking: 3,
        drooling: 1,
        grooming: 4,
        shedding: 1,
        trainability: 5,
        good_with_dogs: 4,
        exercise_minutes: 60,
        apartment_friendly: 4,
        good_with_children: 5,
        good_with_strangers: 4,
      },
      images: [],
    };

    const result = filterAndGroupBreeds(
      { '1': b1 },
      ['1'],
      {
        searchQuery: 'mittel',
        groups: ['Working'],
        sizes: ['Medium'],
        coats: ['wire'],
        hypoallergenicOnly: true,
        minChildFriendly: 4,
        minDogFriendly: 4,
        minStrangerFriendly: 4,
      }
    );

    expect(result.length).toBe(2); // 1 header + 1 matching row
  });
});
