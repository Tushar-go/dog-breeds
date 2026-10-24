import { create } from 'zustand';
import { Breed, BreedGroup, CoatLength, FilterState, SizeBucket } from '../types/breed';
import { fetchAllBreedsPaginated, fetchAllGroups, fetchSingleBreed } from '../api/dogApi';
import { loadCachedCatalog, saveBreedsToDb, saveCatalogToDb } from '../db/database';
import { prefetchThumbnails } from '../utils/imageCache';

interface BreedStoreState {
  breedsById: Record<string, Breed>;
  breedIds: string[];
  groups: BreedGroup[];
  lastSyncedAt: number | null;
  lastSyncPartial: boolean;
  isHydrated: boolean;
  isSyncing: boolean;
  isOffline: boolean;
  syncError: string | null;
  filters: FilterState;
  hydrateFromCache: () => Promise<void>;
  syncWithRemote: () => Promise<void>;
  refreshSingleBreed: (id: string) => Promise<void>;
  setOfflineStatus: (offline: boolean) => void;
  setSearchQuery: (q: string) => void;
  toggleGroupFilter: (groupName: string) => void;
  toggleSizeFilter: (size: SizeBucket) => void;
  toggleCoatFilter: (coat: CoatLength) => void;
  setHypoallergenicFilter: (val: boolean | null) => void;
  setTraitThreshold: (trait: 'minChildFriendly' | 'minDogFriendly' | 'minStrangerFriendly', val: number) => void;
  resetFilters: () => void;
}

export const initialFilters: FilterState = {
  searchQuery: '', groups: [], sizes: [], coats: [], hypoallergenicOnly: null,
  minChildFriendly: 0, minDogFriendly: 0, minStrangerFriendly: 0,
};

let hydrationPromise: Promise<void> | null = null;

function buildGroupMap(groups: BreedGroup[], breeds: Record<string, Breed>): Map<string, string> {
  const map = new Map<string, string>();
  for (const breed of Object.values(breeds)) {
    if (breed.groupId && breed.groupName) map.set(breed.groupId, breed.groupName);
  }
  for (const group of groups) map.set(group.id, group.name);
  return map;
}

export const useBreedStore = create<BreedStoreState>((set, get) => ({
  breedsById: {}, breedIds: [], groups: [],
  lastSyncedAt: null, lastSyncPartial: false,
  isHydrated: false, isSyncing: false, isOffline: false, syncError: null,
  filters: initialFilters,

  hydrateFromCache: () => {
    if (hydrationPromise) return hydrationPromise;
    hydrationPromise = (async () => {
      try {
        const { breeds, groups, lastSyncedAt, lastSyncPartial } = await loadCachedCatalog();
        const byId: Record<string, Breed> = {};
        for (const breed of breeds) byId[breed.id] = breed;
        set({
          breedsById: byId, breedIds: Object.keys(byId), groups, lastSyncedAt,
          lastSyncPartial, isHydrated: true,
          syncError: lastSyncPartial ? 'Last sync was incomplete. Showing cached data.' : null,
        });
      } catch (error) {
        set({
          isHydrated: true,
          syncError: error instanceof Error ? error.message : 'Cache load failed',
        });
      }
    })();
    return hydrationPromise;
  },

  syncWithRemote: async () => {
    // NetInfo can fire before hydration finishes. Never race hydration against sync.
    await get().hydrateFromCache();
    if (get().isSyncing || get().isOffline) return;
    set({ isSyncing: true, syncError: null });
    try {
      let groupsFailed = false;
      let remoteGroups: BreedGroup[] = [];
      try { remoteGroups = await fetchAllGroups(); }
      catch { groupsFailed = true; }
      const groupMap = buildGroupMap(get().groups, get().breedsById);
      for (const group of remoteGroups) groupMap.set(group.id, group.name);
      const groups = [...groupMap].map(([id, name]) => ({ id, name }));
      const result = await fetchAllBreedsPaginated(groupMap);
      const partial = groupsFailed || result.partialFailure || result.breeds.length === 0;
      const completedAt = await saveCatalogToDb(result.breeds, groups, partial);
      const byId = { ...get().breedsById };
      for (const breed of result.breeds) byId[breed.id] = breed;
      const ids = Object.keys(byId).sort((a, b) => byId[a].name.localeCompare(byId[b].name));
      set({
        breedsById: byId, breedIds: ids, groups,
        lastSyncedAt: completedAt ?? get().lastSyncedAt,
        lastSyncPartial: partial, isSyncing: false,
        syncError: partial
          ? 'Sync incomplete: some groups or pages failed. Showing available data and cache.'
          : null,
      });
      // Do not delay rendering/sync completion for best-effort image downloads.
      if (result.breeds.length > 0) {
        void prefetchThumbnails(Object.values(byId), () => get().isOffline).catch(() => undefined);
      }
    } catch (error) {
      // Persist failure status without advancing the last complete-sync timestamp.
      await saveCatalogToDb([], [], true).catch(() => undefined);
      set({
        isSyncing: false, lastSyncPartial: true,
        syncError: error instanceof Error
          ? `Sync failed (${error.message}). Showing cached data.`
          : 'Sync failed. Showing cached data.',
      });
    }
  },

  refreshSingleBreed: async (id: string) => {
    if (get().isOffline) return;
    try {
      const updated = await fetchSingleBreed(id, buildGroupMap(get().groups, get().breedsById));
      if (updated && updated.id === id) {
        await saveBreedsToDb([updated]);
        set((state) => ({
          breedsById: { ...state.breedsById, [id]: updated },
          breedIds: state.breedIds.includes(id) ? state.breedIds : [...state.breedIds, id],
        }));
      }
    } catch {
      // Retain cached breed on detail refresh failure; catalog freshness is unchanged.
    }
  },

  setOfflineStatus: (offline) => set({ isOffline: offline }),

  setSearchQuery: (searchQuery) =>
    set((s) => ({ filters: { ...s.filters, searchQuery } })),

  toggleGroupFilter: (groupName) =>
    set((s) => {
      const exists = s.filters.groups.includes(groupName);
      const groups = exists
        ? s.filters.groups.filter((g) => g !== groupName)
        : [...s.filters.groups, groupName];
      return { filters: { ...s.filters, groups } };
    }),

  toggleSizeFilter: (size) =>
    set((s) => {
      const exists = s.filters.sizes.includes(size);
      const sizes = exists
        ? s.filters.sizes.filter((item) => item !== size)
        : [...s.filters.sizes, size];
      return { filters: { ...s.filters, sizes } };
    }),

  toggleCoatFilter: (coat) =>
    set((s) => {
      const exists = s.filters.coats.includes(coat);
      const coats = exists
        ? s.filters.coats.filter((c) => c !== coat)
        : [...s.filters.coats, coat];
      return { filters: { ...s.filters, coats } };
    }),

  setHypoallergenicFilter: (hypoallergenicOnly) =>
    set((s) => ({ filters: { ...s.filters, hypoallergenicOnly } })),

  setTraitThreshold: (trait, val) =>
    set((s) => ({ filters: { ...s.filters, [trait]: val } })),

  resetFilters: () => set({ filters: initialFilters }),
}));
