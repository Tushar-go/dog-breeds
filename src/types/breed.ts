export type SizeBucket = 'Small' | 'Medium' | 'Large' | 'Giant';
export type CoatLength = 'short' | 'medium' | 'long' | 'wire';

export interface RangeMetric {
  min: number | null;
  max: number | null;
}

export interface TraitScores {
  energy: number | null;
  barking: number | null;
  drooling: number | null;
  grooming: number | null;
  shedding: number | null;
  trainability: number | null;
  good_with_dogs: number | null;
  exercise_minutes: number | null;
  apartment_friendly: number | null;
  good_with_children: number | null;
  good_with_strangers: number | null;
}

export interface BreedImage {
  id: string;
  url: string;
  thumbUrl: string;
  mediumUrl: string;
  largeUrl: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
  sourceUrl: string;
}

export interface Breed {
  id: string;
  name: string;
  otherNames: string[];
  description: string;
  groupId: string;
  groupName: string | null;
  lifeSpan: RangeMetric | null;
  maleWeight: RangeMetric | null;
  femaleWeight: RangeMetric | null;
  maleHeight: RangeMetric | null;
  femaleHeight: RangeMetric | null;
  sizeBucket: SizeBucket | null;
  coatType: string | null;
  coatLength: CoatLength | null;
  coatColors: string[];
  hypoallergenic: boolean | null;
  origin: { era: string; region: string; country: string };
  kennelClubs: string[];
  temperamentTags: string[];
  traits: TraitScores;
  images: BreedImage[];
}

export interface BreedGroup { id: string; name: string }

export interface FilterState {
  searchQuery: string;
  groups: string[];
  sizes: SizeBucket[];
  coats: CoatLength[];
  hypoallergenicOnly: boolean | null;
  minChildFriendly: number;
  minDogFriendly: number;
  minStrangerFriendly: number;
}

export type RootStackParamList = {
  BreedList: undefined;
  BreedDetail: { breedId: string; breedName: string };
};