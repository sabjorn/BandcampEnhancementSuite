# FindMusic.club API Caching Integration - Implementation Summary

## Overview
This implementation adds bidirectional caching between BandcampEnhancementSuite and FindMusic.club API. Users can opt-in to send HTTP requests and computed waveform/BPM data to FindMusic.club API, and in exchange receive pre-computed waveform/BPM data when available.

## Files Modified

### 1. Token Management (`src/utilities.ts`)
- **Added**: `FindMusicTokenData` interface
- **Added**: `storeFindMusicToken()` - Store FindMusic API token with expiry
- **Added**: `getFindMusicTokenFromStorage()` - Retrieve valid token or null if expired
- **Added**: `clearFindMusicToken()` - Delete stored token
- **Added**: `cachedFetch()` - Wrapper for fetch that caches requests to FindMusic API

### 2. FindMusic Client (`src/clients/findmusic.ts`)
- **Modified**: `exchangeBandcampToken()` - Now stores token after exchange
- **Added**: `getFindMusicToken()` - Get valid token from storage or exchange new one

### 3. Config Backend (`src/background/config_backend.ts`)
- **Modified**: `Config` interface - Added `enableFindMusicCaching: boolean`
- **Modified**: `defaultConfig` - Added `enableFindMusicCaching: false`
- **Added**: `toggleFindMusicCaching()` - Toggle caching config option
- **Modified**: `portListenerCallback()` - Handle `toggleFindMusicCaching` message

### 4. UI (`src/main.ts`)
- **Added**: Caching toggle UI element in settings drawer
- **Modified**: `updateButtonText()` - Show/hide caching toggle based on permissions
- **Added**: Event listener for caching toggle
- **Added**: Config listener to sync toggle state

### 5. HTTP Client (`src/bclient.ts`)
- **Modified**: `getTralbumDetails()` - Use `cachedFetch()` instead of `fetch()`

### 6. Cache Backend (`src/background/cache_backend.ts`) - NEW FILE
- **Added**: `processRequest()` - Handle `postCache` messages
- **Added**: `postCacheToFindMusic()` - Send HTTP cache to FindMusic API
- **Added**: `initCacheBackend()` - Initialize cache backend

### 7. Waveform Backend (`src/background/waveform_backend.ts`)
- **Modified**: `processRequest()` - Handle `fetchTrackMetadata` and `postTrackMetadata` messages
- **Added**: `fetchTrackMetadata()` - GET metadata from FindMusic API
- **Added**: `postTrackMetadata()` - POST metadata to FindMusic API

### 8. Audio Features (`src/audioFeatures.ts`)
- **Added**: `extractTrackId()` - Extract track ID from audio source URL
- **Modified**: `generateAudioFeatures()` - Check for cached metadata before computing
- **Modified**: Waveform/BPM computation - Send computed data to API after calculation

### 9. Background Entry (`src/background.ts`)
- **Added**: Import and initialization of `initCacheBackend()`

### 10. Tests (`test/findmusic.test.ts`)
- **Added**: Mock for utilities module
- **Added**: Test for token storage after exchange
- **Added**: Tests for `getFindMusicToken()` function

## API Endpoints Used

### Cache Endpoint
- **POST** `/api/cache`
- **Headers**: `Authorization: Bearer {token}`, `Content-Type: application/json`
- **Body**: `{ url, method, body, rawResponse }`

### Metadata Endpoints
- **GET** `/api/metadata?track_id={id}`
- **Headers**: `Authorization: Bearer {token}`
- **Returns**: `{ waveform: number[], bpm: number }` or 404

- **POST** `/api/metadata`
- **Headers**: `Authorization: Bearer {token}`, `Content-Type: application/json`
- **Body**: `{ track_id: string, waveform: number[], bpm: number }`

## Flow

### Token Management Flow
1. User grants FindMusic permissions
2. Extension exchanges Bandcamp cookie for FindMusic token
3. Token stored in IndexedDB with expiry timestamp
4. All API calls use `getFindMusicToken()` which returns stored token or exchanges new one

### HTTP Caching Flow
1. User enables caching toggle in settings
2. `getTralbumDetails()` calls wrapped in `cachedFetch()`
3. After successful response, request/response sent to cache backend
4. Cache backend posts to FindMusic API with auth token
5. Errors logged but don't block user experience

### Waveform/BPM Caching Flow

#### Cache Hit (Data Retrieved)
1. User plays track
2. `generateAudioFeatures()` extracts track ID from audio URL
3. Check if caching enabled in config
4. Send `fetchTrackMetadata` message to backend
5. Backend calls FindMusic API GET `/api/metadata`
6. If data found, display immediately (skip computation)

#### Cache Miss (Data Computed)
1. No cached data found
2. Compute waveform and BPM locally as normal
3. Display results to user
4. If caching enabled, send `postTrackMetadata` to backend
5. Backend calls FindMusic API POST `/api/metadata`
6. Data cached for future use

### Config Flow
1. Caching toggle visible only when FindMusic permissions granted
2. Toggle state synced with config backend via port messages
3. All caching operations check `config.enableFindMusicCaching` before proceeding
4. If permissions revoked, caching automatically disabled (permissions take precedence)

## Error Handling
- Token expiry handled automatically by `getFindMusicToken()`
- Network errors logged but don't break user experience
- Cache failures are non-blocking (always fall back to local computation)
- 404 responses treated as cache miss (normal flow)

## Security Considerations
- Tokens stored with expiry in IndexedDB
- Authorization header used for all API calls
- Permissions checked before showing caching toggle
- No sensitive data logged (tokens truncated in logs)

## Testing
- Unit tests updated to mock token storage
- Tests for `getFindMusicToken()` added
- Existing tests still pass with new token storage side effect

## Future Enhancements
- Token refresh before expiry
- Batch metadata requests
- Cache invalidation mechanism
- Analytics on cache hit rate
