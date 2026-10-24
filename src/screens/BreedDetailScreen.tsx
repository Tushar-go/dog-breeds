import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions,
  NativeSyntheticEvent, NativeScrollEvent, useColorScheme, Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useBreedStore } from '../store/useBreedStore';
import { BreedImageView } from '../components/BreedImageView';
import { RootStackParamList, TraitScores, RangeMetric } from '../types/breed';

type Props = NativeStackScreenProps<RootStackParamList, 'BreedDetail'>;
type TabKey = 'Overview' | 'Traits' | 'Gallery';

const TRAIT_LABELS: Array<{ key: keyof TraitScores; label: string; max: number }> = [
  { key: 'energy', label: 'Energy Level', max: 5 },
  { key: 'barking', label: 'Barking Tendency', max: 5 },
  { key: 'drooling', label: 'Drooling Potential', max: 5 },
  { key: 'grooming', label: 'Grooming Needs', max: 5 },
  { key: 'shedding', label: 'Shedding Level', max: 5 },
  { key: 'trainability', label: 'Trainability', max: 5 },
  { key: 'good_with_dogs', label: 'Good with Dogs', max: 5 },
  { key: 'good_with_children', label: 'Good with Children', max: 5 },
  { key: 'good_with_strangers', label: 'Good with Strangers', max: 5 },
  { key: 'apartment_friendly', label: 'Apartment Friendly', max: 5 },
  { key: 'exercise_minutes', label: 'Daily Exercise (mins)', max: 120 },
];

function formatRange(range: RangeMetric | null, unit: string): string {
  if (!range || (range.min === null && range.max === null)) return 'N/A';
  return `${range.min ?? 'N/A'}-${range.max ?? 'N/A'} ${unit}`;
}

export const BreedDetailScreen: React.FC<Props> = ({ route }) => {
  const { breedId } = route.params;
  const { width } = useWindowDimensions();
  const isDark = useColorScheme() === 'dark';
  const breed = useBreedStore((state) => state.breedsById[breedId]);
  const refreshSingleBreed = useBreedStore((state) => state.refreshSingleBreed);
  const isOffline = useBreedStore((state) => state.isOffline);
  const lastSyncedAt = useBreedStore((state) => state.lastSyncedAt);
  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => { void refreshSingleBreed(breedId); }, [breedId, refreshSingleBreed]);

  const handleGalleryScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveSlideIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };
  const openLicense = async (url: string) => {
    setLinkError(null);
    try { await Linking.openURL(url); }
    catch { setLinkError('Could not open the license link.'); }
  };

  if (!breed) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' }]}>
        <Text style={{ color: isDark ? '#F8FAFC' : '#0F172A' }}>Breed not found in local cache.</Text>
      </View>
    );
  }

  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? '#CBD5E1' : '#334155';
  const borderCol = isDark ? '#334155' : '#E2E8F0';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0B1120' : '#F8FAFC' }]}>
      <View style={[styles.tabRow, { borderBottomColor: borderCol }]}>
        {(['Overview', 'Traits', 'Gallery'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => {
              if (tab === 'Gallery' && activeTab !== 'Gallery') setActiveSlideIndex(0);
              setActiveTab(tab);
            }}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
          >
            <Text style={[styles.tabText, { color: isDark ? '#94A3B8' : '#64748B' },
              activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'Overview' && (
        <ScrollView contentContainerStyle={styles.contentPad}>
          <Text style={[styles.desc, { color: textSecondary }]}>
            {breed.description || 'No description provided by API.'}
          </Text>
          <View style={[styles.infoBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={[styles.infoTitle, { color: textPrimary }]}>Breed Specifications</Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              Group: {breed.groupName ?? 'Unknown'} ({breed.sizeBucket ?? 'Unknown size'})
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              Life Span: {formatRange(breed.lifeSpan, 'years')}
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              Male Weight: {formatRange(breed.maleWeight, 'kg')} | Height: {formatRange(breed.maleHeight, 'cm')}
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              Female Weight: {formatRange(breed.femaleWeight, 'kg')} | Height: {formatRange(breed.femaleHeight, 'cm')}
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              Coat length: {breed.coatLength ?? 'Unknown'} | Type: {breed.coatType ?? 'Unknown'}
              {breed.coatColors.length > 0 ? ` | Colors: ${breed.coatColors.join(', ')}` : ''}
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              Hypoallergenic: {breed.hypoallergenic === null ? 'Unknown' : breed.hypoallergenic ? 'Yes' : 'No'}
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              Origin: {[breed.origin.country, breed.origin.region, breed.origin.era].filter(Boolean).join(' / ') || 'N/A'}
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              Other Names: {breed.otherNames.join(', ') || 'N/A'}
            </Text>
            <Text style={[styles.infoLine, { color: textSecondary }]}>
              Recognizing Kennel Clubs: {breed.kennelClubs.join(', ') || 'N/A'}
            </Text>
          </View>
        </ScrollView>
      )}

      {activeTab === 'Traits' && (
        <ScrollView contentContainerStyle={styles.contentPad}>
          <Text style={styles.sectionSub}>Temperament Tags</Text>
          <View style={styles.tagRow}>
            {breed.temperamentTags.length > 0 ? breed.temperamentTags.map((tag, index) => (
              <View key={`${tag}-${index}`} style={[styles.temperamentChip,
                { backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE' }]}>
                <Text style={[styles.temperamentText, { color: isDark ? '#BFDBFE' : '#1E40AF' }]}>{tag}</Text>
              </View>
            )) : <Text style={{ color: textSecondary }}>No temperament tags</Text>}
          </View>
          <Text style={styles.sectionSub}>Trait Scores</Text>
          {TRAIT_LABELS.map(({ key, label, max }) => {
            const value = breed.traits[key];
            const percent = value === null ? null : Math.max(0, Math.min(100, Math.round(value / max * 100)));
            return (
              <View key={key} style={styles.traitRow}>
                <View style={styles.traitHeader}>
                  <Text style={{ color: textPrimary, fontWeight: '600' }}>{label}</Text>
                  <Text style={{ color: '#3B82F6', fontWeight: '700' }}>
                    {value === null ? 'N/A' : key === 'exercise_minutes' ? `${value} min` : `${value} / ${max}`}
                  </Text>
                </View>
                {percent !== null && (
                  <View style={[styles.barTrack, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <View style={[styles.barFill, { width: `${percent}%` }]} />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {activeTab === 'Gallery' && (breed.images.length === 0 ? (
        <View style={styles.center}><Text style={{ color: textSecondary }}>No images available.</Text></View>
      ) : (
        <ScrollView key={width} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleGalleryScroll} contentOffset={{ x: activeSlideIndex * width, y: 0 }}>
          {breed.images.map((image, index) => {
            const upgrade = Math.abs(index - activeSlideIndex) <= 1;
            const urls = upgrade
              ? [image.largeUrl, image.mediumUrl, image.thumbUrl]
              : [image.thumbUrl];
            const hasLicenseLink = /^https?:\/\//i.test(image.licenseUrl);
            const source = image.source === 'wikimedia_commons' ? 'Wikimedia Commons' : image.source || 'Unknown source';
            return (
              <ScrollView key={image.id} style={{ width }} contentContainerStyle={[styles.gallerySlide, { width }]}>
                <BreedImageView
                  key={[image.id, image.largeUrl, image.mediumUrl, image.thumbUrl].join('|')}
                  urls={urls}
                  placeholderUri={image.thumbUrl}
                  recyclingKey={image.id}
                  retryKey={image.id + ':' + isOffline + ':' + lastSyncedAt}
                  style={[styles.galleryImage, { width: width - 32 }]}
                  isDark={isDark}
                />
                <View style={[styles.attributionBox, { width: width - 32, backgroundColor: cardBg, borderColor: borderCol }]}>
                  <Text style={[styles.attrTitle, { color: textPrimary }]}>Image {index + 1} of {breed.images.length}</Text>
                  <Text style={[styles.attrText, { color: textSecondary }]}>Author: {image.author || 'Unknown author'}</Text>
                  <Text
                    accessibilityRole={hasLicenseLink ? 'link' : undefined}
                    onPress={hasLicenseLink ? () => { void openLicense(image.licenseUrl); } : undefined}
                    style={[styles.attrText, { color: hasLicenseLink ? '#3B82F6' : textSecondary },
                      hasLicenseLink && { textDecorationLine: 'underline' }]}
                  >
                    License: {image.license || (hasLicenseLink ? 'View license' : 'Unknown license')}
                  </Text>
                  <Text style={[styles.attrText, { color: textSecondary }]}>
                    Source: {source}{image.sourceUrl ? ` (${image.sourceUrl})` : ''}
                  </Text>
                  {linkError && <Text style={{ color: textSecondary }}>{linkError}</Text>}
                </View>
              </ScrollView>
            );
          })}
        </ScrollView>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#3B82F6' },
  tabText: { fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#3B82F6' },
  contentPad: { padding: 16 },
  desc: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  infoBox: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  infoLine: { fontSize: 13, lineHeight: 19 },
  sectionSub: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
    marginTop: 8,
    marginBottom: 10,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  temperamentChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  temperamentText: { fontSize: 12, fontWeight: '600' },
  traitRow: { marginBottom: 12 },
  traitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#3B82F6' },
  gallerySlide: { padding: 16, alignItems: 'center' },
  galleryImage: {
    height: 320,
    borderRadius: 12,
  },
  attributionBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  attrTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  attrText: { fontSize: 12, marginBottom: 2 },
});
