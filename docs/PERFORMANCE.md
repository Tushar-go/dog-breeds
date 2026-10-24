# Performance & Profiling Report

No device profiling measurements or screenshots are available yet.

| Metric | Result |
| --- | --- |
| Main production bundle size | TODO: measure on device |
| Bundle size breakdown | TODO: measure on device |
| Cached startup to interactive | TODO: measure on device |
| List scroll FPS (UI and JS) | TODO: measure on device |
| Peak memory during list/gallery use | TODO: measure on device |

## Measurement checklist

- Use a production/release build; record device, OS, build configuration, and catalog record count.
- Capture cached cold startup separately from first network download.
- Profile sustained list scrolling with thumbnails, filter interactions, and gallery swiping.
- Capture profiler and memory screenshots, plus bundle analysis output.
- Inspect cache growth and offline image availability after thumbnail prefetch and native eviction.
- Record results before replacing the placeholders above. No performance target is claimed as achieved.