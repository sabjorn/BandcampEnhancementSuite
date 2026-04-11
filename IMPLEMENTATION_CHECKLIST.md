# FindMusic.club API Caching Integration - Implementation Checklist

## ✅ Step 1: Token Management in IndexedDB

### src/utilities.ts
- [x] Added `FindMusicTokenData` interface
- [x] Added `storeFindMusicToken(token, expiresInSeconds)` function
- [x] Added `getFindMusicTokenFromStorage()` function
- [x] Added `clearFindMusicToken()` function
- [x] Token stored in 'config' store with key 'findmusicToken'
- [x] Expiry checking implemented (tokens expire and are auto-removed)

### src/clients/findmusic.ts
- [x] Imported token storage utilities
- [x] Updated `exchangeBandcampToken()` to call `storeFindMusicToken()`
- [x] Added `getFindMusicToken()` function
  - [x] Checks for stored token first
  - [x] Returns stored token if valid
  - [x] Exchanges new token if expired/missing

## ✅ Step 2: Config System - Add Caching Toggle

### src/background/config_backend.ts
- [x] Added `enableFindMusicCaching: boolean` to `Config` interface
- [x] Added to `defaultConfig` with value `false`
- [x] Added `toggleFindMusicCaching()` function
- [x] Added handler in `portListenerCallback()` for `toggleFindMusicCaching` message

## ✅ Step 3: UI Integration

### src/main.ts
- [x] Created caching toggle UI element
- [x] Added to settings section (hidden by default)
- [x] Added config message listener to sync toggle state
- [x] Added event listener for toggle changes
- [x] Updated `updateButtonText()` to show/hide toggle based on permissions
- [x] Toggle only visible when FindMusic permissions are granted

## ✅ Step 4: HTTP Request Caching Wrapper

### src/utilities.ts
- [x] Added `cachedFetch(url, options)` function
- [x] Checks `enableFindMusicCaching` config before caching
- [x] Sends cache data to backend via `postCache` message
- [x] Returns original response (non-blocking)
- [x] Error handling (logs warnings, doesn't throw)

### src/bclient.ts
- [x] Imported `cachedFetch`
- [x] Updated `getTralbumDetails()` to use `cachedFetch` instead of `fetch`

### src/background/cache_backend.ts (NEW FILE)
- [x] Created new cache backend module
- [x] Added `processRequest()` handler for `postCache` messages
- [x] Added `postCacheToFindMusic()` function
  - [x] Gets token via `getFindMusicToken()`
  - [x] POSTs to `/api/cache` endpoint
  - [x] Includes Authorization header
  - [x] Error handling with logging
- [x] Added `initCacheBackend()` function

### src/background.ts
- [x] Imported `initCacheBackend`
- [x] Called `initCacheBackend()` in initialization

## ✅ Step 5: Waveform/BPM Caching Integration

### src/background/waveform_backend.ts
- [x] Imported `getFindMusicToken`
- [x] Added handler for `fetchTrackMetadata` message
- [x] Added handler for `postTrackMetadata` message
- [x] Added `fetchTrackMetadata(trackId)` function
  - [x] GETs from `/api/metadata?track_id={id}`
  - [x] Returns `{ waveform, bpm }` or null
  - [x] Handles 404 as cache miss
  - [x] Authorization header included
- [x] Added `postTrackMetadata(trackId, waveform, bpm)` function
  - [x] POSTs to `/api/metadata`
  - [x] Authorization header included
  - [x] Error handling with logging

### src/audioFeatures.ts
- [x] Added `extractTrackId(audioSrc)` helper function
- [x] Updated `generateAudioFeatures()` to:
  - [x] Extract track ID from audio source
  - [x] Check for cached metadata before computing
  - [x] Display cached waveform/BPM if available (skip computation)
  - [x] Compute locally if cache miss
  - [x] Send computed data to API after calculation
  - [x] Handle both waveform and BPM completion (wait for both)

## ✅ Step 6: Permission and Config Flow

### src/findmusic_permission.ts
- [x] Imported `getDB`
- [x] Updated permission grant handler to:
  - [x] Enable `enableFindMusicCaching` in config
  - [x] Save to IndexedDB
  - [x] Log action

### Integration Points
- [x] Caching toggle visible only when permissions granted
- [x] Caching automatically enabled when permissions first granted
- [x] Caching stops when toggle disabled (permissions remain)
- [x] All caching operations check permissions and config

## ✅ Step 7: Testing

### test/findmusic.test.ts
- [x] Added mock for utilities module (`storeFindMusicToken`, `getFindMusicTokenFromStorage`)
- [x] Added test for token storage after exchange
- [x] Added tests for `getFindMusicToken()`:
  - [x] Returns stored token if valid
  - [x] Exchanges new token if no stored token

## ✅ Step 8: Documentation

- [x] Created IMPLEMENTATION_SUMMARY.md
- [x] Created IMPLEMENTATION_CHECKLIST.md

## Verification Steps

### Manual Testing Checklist
- [ ] Install extension with new code
- [ ] Grant FindMusic permissions
- [ ] Verify caching toggle appears in settings
- [ ] Verify caching toggle is enabled by default after permission grant
- [ ] Navigate to album page
- [ ] Check network tab for cache API calls
- [ ] Play track without cache
- [ ] Verify waveform/BPM computed and sent to API
- [ ] Play same track again
- [ ] Verify waveform/BPM loaded from cache (faster)
- [ ] Disable caching toggle
- [ ] Verify no API calls made
- [ ] Re-enable toggle
- [ ] Verify caching resumes
- [ ] Check console for errors

### API Endpoints Used
- [x] POST `/api/cache` - HTTP request caching
- [x] GET `/api/metadata?track_id={id}` - Fetch cached waveform/BPM
- [x] POST `/api/metadata` - Store computed waveform/BPM
- [x] POST `/api/bctoken` - Exchange Bandcamp token (existing)

### Error Handling
- [x] Network failures don't block user
- [x] API errors logged but non-fatal
- [x] Token expiry handled automatically
- [x] Cache misses handled gracefully
- [x] 404 responses treated as cache miss
- [x] Invalid track IDs don't crash

### Security
- [x] Tokens stored with expiry
- [x] Authorization headers on all API calls
- [x] Permissions checked before operations
- [x] No sensitive data in logs
- [x] Token refresh on expiry

## Status: IMPLEMENTATION COMPLETE ✅

All planned features have been implemented according to the specification.
Ready for testing and deployment.
