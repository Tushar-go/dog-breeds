import { Image } from 'expo-image';
import { Breed } from '../types/breed';

let prefetchRunning = false;

// Best effort only: native cache eviction and failed downloads can remove offline images.
export async function prefetchThumbnails(
  breeds: Breed[], isOffline: () => boolean
): Promise<void> {
  if (prefetchRunning) return;
  prefetchRunning = true;
  try {
    const urls = [...new Set(breeds.flatMap((breed) =>
      breed.images.map((image) => image.thumbUrl).filter(Boolean)))];
    for (let start = 0; start < urls.length; start += 4) {
      if (isOffline()) break;
      await Promise.allSettled(urls.slice(start, start + 4).map((url) => Image.prefetch(url, 'disk')));
    }
  } finally {
    prefetchRunning = false;
  }
}