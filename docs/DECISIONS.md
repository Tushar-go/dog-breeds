# Technical Decisions & Trade-offs

## Rich payloads and list rendering

FlashList virtualizes/recycles rows. Rows receive the full Breed object, but render names, size/coat/lifespan, temperament tags, and a thumbnail. React.memo and a stable navigation callback reduce unnecessary row work; the list memoizes its filtered data. There is no estimatedItemSize prop. recyclingKey belongs to expo-image and prevents stale recycled image content.

The payload contains nested traits, ranges, origin, and image metadata. Virtualization reduces mounted UI work; it does not remove those objects from memory. Scroll FPS, memory, and startup performance: TODO: measure on device.

## Missing values and filters

Missing/malformed numeric values and ranges remain null. Missing coat length, size, and hypoallergenic status also remain null. UI labels show Unknown/N/A; an active filter excludes unknown values for that criterion. Unknown traits do not exclude records when no threshold is active. Group filters use exact case-insensitive names from fetched/cached groups.

Coat type and coat length remain separate. Affenpinscher with type wire and length short matches either the wire or short filter. Values within a filter are ORed; separate filter criteria are ANDed.

## Image cache policy and attribution

After catalog records are saved, best-effort thumbnail prefetch runs in batches of four without blocking the UI. Only actual thumb URLs are prefetched, with disk caching; original image URLs are not treated as thumbnails. Prefetch stops between batches if the app reports offline. Native caching/eviction controls retention; no portable hard size cap or guaranteed offline gallery is claimed.

List images show a placeholder on failure. Gallery slides load large variants only when visible/adjacent and fall back to medium, then thumb. Other slides request thumbnails. A failed chain shows a placeholder. Author, license, and source are shown, with Wikimedia Commons formatted for readability and HTTP(S) license links tappable.

Some gallery images may be unrelated to the breed because the source data is messy. The app retains these images as supplied rather than fabricating or guessing replacements.

## State, persistence, and networking

Zustand stores normalized breeds; the list/App currently subscribe to the whole store, while detail uses selectors. SQLite WAL provides transactional persistence and parameterized upserts. Initialization uses a shared retryable promise; write transactions are serialized.

Catalog sync keeps cached groups on endpoint failure, merges valid pages, persists partial status, and advances freshness only on a complete catalog sync. Detail updates do not change catalog freshness. See ARCHITECTURE.md for schema and legacy-cache migration.

Requests use a ten-second AbortController timeout, exponential backoff with randomized jitter, and no retries for 4xx except 408/429. Page count comes from API metadata, rather than an assumed fixed breed count.

Bundle size: TODO: measure on device.