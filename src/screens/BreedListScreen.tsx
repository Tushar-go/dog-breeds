import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import { BreedImageView } from '../components/BreedImageView';
import { useBreedStore } from '../store/useBreedStore';
import { filterAndGroupBreeds, ListItem } from '../store/filterBreeds';
import { Breed, CoatLength, RootStackParamList, SizeBucket } from '../types/breed';

type Props = NativeStackScreenProps<RootStackParamList, 'BreedList'>;

const ALL_SIZES: SizeBucket[] = ['Small', 'Medium', 'Large', 'Giant'];
const ALL_COATS: CoatLength[] = ['short', 'medium', 'long', 'wire'];

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return 'Not synced yet';
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return 'Last synced just now';
  if (diffMinutes < 60) return `Last synced ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `Last synced ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
}

const BreedRow = React.memo(
  ({
    breed,
    isDark,
    onPress,
  }: {
    breed: Breed;
    isDark: boolean;
    onPress: (breed: Breed) => void;
  }) => {
    const thumb = breed.images[0]?.thumbUrl;
    const isOffline = useBreedStore((state) => state.isOffline);
    const lastSyncedAt = useBreedStore((state) => state.lastSyncedAt);
    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
        onPress={() => onPress(breed)}
        activeOpacity={0.75}
      >
        <BreedImageView
          key={breed.id + ':' + (thumb ?? '')}
          urls={thumb ? [thumb] : []}
          recyclingKey={breed.id}
          retryKey={breed.id + ':' + isOffline + ':' + lastSyncedAt}
          style={styles.thumb}
          isDark={isDark}
        />
        <View style={styles.cardBody}>
          <Text
            style={[styles.breedName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
            numberOfLines={1}
          >
            {breed.name}
          </Text>
          <Text
            style={[styles.metaText, { color: isDark ? '#94A3B8' : '#64748B' }]}
            numberOfLines={1}
          >
            {breed.sizeBucket ?? 'Unknown'} | Coat: {breed.coatLength ?? breed.coatType ?? 'Unknown'} | {breed.lifeSpan?.min ?? 'N/A'}-
            {breed.lifeSpan?.max ?? 'N/A'} yrs
          </Text>
          <View style={styles.badgeRow}>
            {breed.temperamentTags.slice(0, 3).map((tag, index) => (
              <View
                key={tag + index}
                style={[
                  styles.tagBadge,
                  { backgroundColor: isDark ? '#312E81' : '#E0E7FF' },
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    { color: isDark ? '#C7D2FE' : '#3730A3' },
                  ]}
                >
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    );
  }
);

export const BreedListScreen: React.FC<Props> = ({ navigation }) => {
  const isDark = useColorScheme() === 'dark';

  const {
    breedsById,
    breedIds,
    groups,
    lastSyncedAt,
    isSyncing,
    isOffline,
    syncError,
    filters,
    syncWithRemote,
    setSearchQuery,
    toggleGroupFilter,
    toggleSizeFilter,
    toggleCoatFilter,
    setHypoallergenicFilter,
    setTraitThreshold,
    resetFilters,
  } = useBreedStore();

  const [, setFreshnessTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFreshnessTick((tick) => tick + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const [rawSearch, setRawSearch] = useState(filters.searchQuery);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(rawSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [rawSearch, setSearchQuery]);

  const listData = useMemo(
    () => filterAndGroupBreeds(breedsById, breedIds, filters),
    [breedsById, breedIds, filters]
  );

  const handlePressBreed = useCallback(
    (breed: Breed) => {
      navigation.navigate('BreedDetail', {
        breedId: breed.id,
        breedName: breed.name,
      });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: isDark ? '#93C5FD' : '#334155' },
              ]}
            >
              {item.title}
            </Text>
          </View>
        );
      }
      return (
        <BreedRow
          breed={item.breed}
          isDark={isDark}
          onPress={handlePressBreed}
        />
      );
    },
    [isDark, handlePressBreed]
  );

  const bannerBg = isOffline
    ? isDark
      ? '#78350F'
      : '#FEF3C7'
    : syncError
    ? isDark
      ? '#7F1D1D'
      : '#FEE2E2'
    : isDark
    ? '#1E3A8A'
    : '#DBEAFE';

  const bannerTextColor = isDark ? '#F8FAFC' : '#0F172A';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' },
      ]}
    >
      {/* <View style={[styles.syncBanner, { backgroundColor: bannerBg }]}>
        <Text style={[styles.bannerText, { color: bannerTextColor }]}>
          {isOffline ? 'OFFLINE • ' : ''}
          {formatRelativeTime(lastSyncedAt)} • {breedIds.length} Breeds
          {syncError ? ` • ${syncError}` : ''}
        </Text>
      </View> */}

      <View style={styles.searchBarRow}>
        <TextInput
          value={rawSearch}
          onChangeText={setRawSearch}
          placeholder="Search breeds or other names..."
          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
          style={[
            styles.searchInput,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              color: isDark ? '#F8FAFC' : '#0F172A',
              borderColor: isDark ? '#334155' : '#CBD5E1',
            },
          ]}
        />
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => setFilterModalVisible(true)}
        >
          <Text style={styles.filterBtnText}>Filters</Text>
        </TouchableOpacity>
      </View>

      <FlashList
        data={listData}
        renderItem={renderItem}
        getItemType={(item) => item.type}
        keyExtractor={(item, idx) =>
          item.type === 'header' ? `hdr-${item.title}-${idx}` : item.breed.id
        }
        ListEmptyComponent={
          <Text style={{ padding: 24, color: bannerTextColor }}>
            {isSyncing ? 'Loading breeds...' : breedIds.length > 0
              ? 'No breeds match these filters.'
              : isOffline ? 'No cached breeds. Connect to download the catalog.' : 'No breeds available. Pull down to retry.'}
          </Text>
        }
        refreshing={isSyncing}
        onRefresh={syncWithRemote}
      />

      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' },
            ]}
          >
            <ScrollView>
              <Text
                style={[
                  styles.modalHeading,
                  { color: isDark ? '#F8FAFC' : '#0F172A' },
                ]}
              >
                Filter Breeds
              </Text>

              <Text
                style={[
                  styles.filterLabel,
                  { color: isDark ? '#CBD5E1' : '#475569' },
                ]}
              >
                Breed Group
              </Text>
              <View style={styles.chipWrap}>
                {groups.map((group) => {
                  const grp = group.name;
                  const active = filters.groups.includes(grp);
                  return (
                    <TouchableOpacity
                      key={group.id}
                      onPress={() => toggleGroupFilter(grp)}
                      style={[
                        styles.chip,
                        { borderColor: isDark ? '#475569' : '#CBD5E1' },
                        active && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isDark ? '#E2E8F0' : '#334155' },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {grp}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text
                style={[
                  styles.filterLabel,
                  { color: isDark ? '#CBD5E1' : '#475569' },
                ]}
              >
                Size Band
              </Text>
              <View style={styles.chipWrap}>
                {ALL_SIZES.map((sz) => {
                  const active = filters.sizes.includes(sz);
                  return (
                    <TouchableOpacity
                      key={sz}
                      onPress={() => toggleSizeFilter(sz)}
                      style={[
                        styles.chip,
                        { borderColor: isDark ? '#475569' : '#CBD5E1' },
                        active && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isDark ? '#E2E8F0' : '#334155' },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {sz}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text
                style={[
                  styles.filterLabel,
                  { color: isDark ? '#CBD5E1' : '#475569' },
                ]}
              >
                Coat Type / Length
              </Text>
              <View style={styles.chipWrap}>
                {ALL_COATS.map((coat) => {
                  const active = filters.coats.includes(coat);
                  return (
                    <TouchableOpacity
                      key={coat}
                      onPress={() => toggleCoatFilter(coat)}
                      style={[
                        styles.chip,
                        { borderColor: isDark ? '#475569' : '#CBD5E1' },
                        active && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isDark ? '#E2E8F0' : '#334155' },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {coat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text
                style={[
                  styles.filterLabel,
                  { color: isDark ? '#CBD5E1' : '#475569' },
                ]}
              >
                Hypoallergenic
              </Text>
              <View style={styles.chipWrap}>
                {[
                  { label: 'Any', val: null },
                  { label: 'Yes', val: true },
                  { label: 'No', val: false },
                ].map((opt) => {
                  const active = filters.hypoallergenicOnly === opt.val;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      onPress={() => setHypoallergenicFilter(opt.val)}
                      style={[
                        styles.chip,
                        { borderColor: isDark ? '#475569' : '#CBD5E1' },
                        active && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isDark ? '#E2E8F0' : '#334155' },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text
                style={[
                  styles.filterLabel,
                  { color: isDark ? '#CBD5E1' : '#475569' },
                ]}
              >
                Trait Threshold (Score ≥ 4 / 5)
              </Text>
              <View style={styles.chipWrap}>
                {[
                  { key: 'minChildFriendly' as const, label: 'Good w/ Children ≥ 4' },
                  { key: 'minDogFriendly' as const, label: 'Good w/ Dogs ≥ 4' },
                  {
                    key: 'minStrangerFriendly' as const,
                    label: 'Good w/ Strangers ≥ 4',
                  },
                ].map((t) => {
                  const active = filters[t.key] >= 4;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() =>
                        setTraitThreshold(t.key, active ? 0 : 4)
                      }
                      style={[
                        styles.chip,
                        { borderColor: isDark ? '#475569' : '#CBD5E1' },
                        active && styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: isDark ? '#E2E8F0' : '#334155' },
                          active && styles.chipTextActive,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View
              style={[
                styles.modalFooter,
                { borderTopColor: isDark ? '#334155' : '#E2E8F0' },
              ]}
            >
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => {
                  setRawSearch('');
                  resetFilters();
                }}
              >
                <Text style={styles.resetBtnText}>Reset All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  syncBanner: { paddingVertical: 8, paddingHorizontal: 14 },
  bannerText: { fontSize: 12, fontWeight: '600' },
  searchBarRow: { flexDirection: 'row', padding: 12, gap: 8 },
  searchInput: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  filterBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  filterBtnText: { color: '#FFFFFF', fontWeight: '600' },
  sectionHeader: { paddingHorizontal: 14, paddingVertical: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  cardBody: { flex: 1, marginLeft: 12 },
  breedName: { fontSize: 16, fontWeight: '700' },
  metaText: { fontSize: 12, marginVertical: 3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: { fontSize: 10, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '85%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  modalHeading: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  chipText: { fontSize: 12 },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  resetBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  resetBtnText: { color: '#EF4444', fontWeight: '600' },
  applyBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  applyBtnText: { color: '#FFFFFF', fontWeight: '600' },
});
