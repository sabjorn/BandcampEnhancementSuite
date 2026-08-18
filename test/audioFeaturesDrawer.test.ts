import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import { generateAudioFeatures, drawOverlay } from '../src/audioFeatures';
import { analyze } from 'web-audio-beat-detector';

vi.mock('web-audio-beat-detector', () => ({
  analyze: vi.fn()
}));

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}));

describe('AudioFeatures - Waveform & BPM for Drawer Player', () => {
  let canvas: HTMLCanvasElement;
  let audio: HTMLAudioElement;
  let mockContext: any;
  let originalChromeRuntime: any;
  let cachedMetadata: { waveform: number[]; bpm: number } | null;

  beforeEach(() => {
    createDomNodes(`
      <canvas class="waveform" width="600" height="30"></canvas>
      <audio></audio>
      <div class="bpm-number"></div>
    `);

    canvas = document.querySelector('canvas.waveform') as HTMLCanvasElement;
    audio = document.querySelector('audio') as HTMLAudioElement;

    // Mock canvas context
    mockContext = {
      fillStyle: '',
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn()
    };

    canvas.getContext = vi.fn().mockReturnValue(mockContext);

    vi.mocked(analyze).mockResolvedValue(120);

    cachedMetadata = null;
    originalChromeRuntime = (globalThis as any).chrome.runtime;
    (globalThis as any).chrome.runtime = {
      ...originalChromeRuntime,
      sendMessage: vi.fn((message: any, callback?: (data: { data: number[] }) => void) => {
        if (message.contentScriptQuery === 'fetchTrackMetadata') return Promise.resolve(cachedMetadata);

        callback?.({ data: Array.from(new Uint8Array(1024)) });
        return Promise.resolve();
      })
    };

    // Mock AudioContext
    globalThis.AudioContext = vi.fn().mockImplementation(() => ({
      decodeAudioData: vi.fn().mockResolvedValue({
        length: 44100,
        sampleRate: 44100,
        numberOfChannels: 2,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(44100))
      }),
      createAnalyser: vi.fn(() => ({
        fftSize: 2048,
        connect: vi.fn(),
        disconnect: vi.fn(),
        getByteTimeDomainData: vi.fn()
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn()
      })),
      destination: {},
      close: vi.fn()
    }));
  });

  afterEach(() => {
    cleanupTestNodes();
    vi.restoreAllMocks();
    delete (globalThis as any).AudioContext;
    (globalThis as any).chrome.runtime = originalChromeRuntime;
  });

  describe('waveform rendering', () => {
    it('should generate waveform on canvas', async () => {
      const bpmCallback = vi.fn();
      const currentTarget = { value: undefined as string | undefined };

      audio.src = 'https://t4.bcbits.com/stream/test-audio.mp3';

      await generateAudioFeatures(() => audio, canvas, bpmCallback, '#e2e2e6', console as any, currentTarget, {
        urlFormatter: () => ({ stream: { type: 'direct-path' as const, path: 'test-audio.mp3' } })
      });

      await vi.waitFor(() => expect(mockContext.fillRect).toHaveBeenCalled());
    });

    it('should use 100 datapoints for waveform (RMS analysis)', async () => {
      const bpmCallback = vi.fn();
      const currentTarget = { value: undefined as string | undefined };

      audio.src = 'https://t4.bcbits.com/stream/test-audio.mp3';

      await generateAudioFeatures(() => audio, canvas, bpmCallback, '#e2e2e6', console as any, currentTarget, {
        urlFormatter: () => ({ stream: { type: 'direct-path' as const, path: 'test-audio.mp3' } })
      });

      await vi.waitFor(() => expect(mockContext.fillRect).toHaveBeenCalledTimes(100));
    });
  });

  describe('progress overlay', () => {
    it('should draw overlay showing played portion', () => {
      const waveformColour = '#e2e2e6';
      const overlayColour = '#5b53e8';

      canvas.width = 600;
      canvas.height = 30;

      // 50% progress
      drawOverlay(canvas, 0.5, overlayColour, waveformColour);

      // Should draw purple overlay over left half
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

    it('should use purple accent color for played portion', () => {
      const waveformColour = '#e2e2e6';
      const overlayColour = '#5b53e8'; // Purple accent

      drawOverlay(canvas, 0.5, overlayColour, waveformColour);

      expect(mockContext.fillStyle).toBe(overlayColour);
    });

    it('should update overlay as progress changes', () => {
      const waveformColour = '#e2e2e6';
      const overlayColour = '#5b53e8';

      // 25% progress
      drawOverlay(canvas, 0.25, overlayColour, waveformColour);

      mockContext.fillRect.mockClear();

      // 75% progress
      drawOverlay(canvas, 0.75, overlayColour, waveformColour);

      expect(mockContext.fillRect).toHaveBeenCalled();
    });
  });

  describe('bpm detection', () => {
    it('should call BPM callback with detected tempo', async () => {
      vi.mocked(analyze).mockResolvedValue(128);

      const bpmCallback = vi.fn();
      const currentTarget = { value: undefined as string | undefined };

      audio.src = 'https://t4.bcbits.com/stream/test-audio.mp3';

      await generateAudioFeatures(() => audio, canvas, bpmCallback, '#e2e2e6', console as any, currentTarget, {
        urlFormatter: () => ({ stream: { type: 'direct-path' as const, path: 'test-audio.mp3' } })
      });

      await vi.waitFor(() => expect(bpmCallback).toHaveBeenCalledWith(128));
    });

    it('should handle BPM detection errors gracefully', async () => {
      vi.mocked(analyze).mockRejectedValue(new Error('no beats found'));

      const bpmCallback = vi.fn();
      const currentTarget = { value: undefined as string | undefined };

      audio.src = 'https://t4.bcbits.com/stream/test-audio.mp3';

      await expect(
        generateAudioFeatures(() => audio, canvas, bpmCallback, '#e2e2e6', console as any, currentTarget, {
          urlFormatter: () => ({ stream: { type: 'direct-path' as const, path: 'test-audio.mp3' } })
        })
      ).resolves.not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(bpmCallback).toHaveBeenCalledWith(null);
      expect(bpmCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('metadata caching', () => {
    const streamUrl = (trackId: number) => `https://t4.bcbits.com/stream/somehash/mp3-128/${trackId}?p=0&ts=1`;

    const messagesFor = (query: string) =>
      vi
        .mocked((globalThis as any).chrome.runtime.sendMessage)
        .mock.calls.filter(([message]: [any]) => message.contentScriptQuery === query);

    const analyse = (trackId: number, bpmCallback = vi.fn()) =>
      generateAudioFeatures(
        () => audio,
        canvas,
        bpmCallback,
        '#e2e2e6',
        console as any,
        { value: undefined as string | undefined },
        {
          urlFormatter: audioSrc => ({ stream: { type: 'direct-path' as const, path: audioSrc.split('stream/')[1] } })
        }
      );

    it('should look the track up in the cache before analysing it', async () => {
      audio.src = streamUrl(1001);

      await analyse(1001);

      expect(messagesFor('fetchTrackMetadata')[0][0]).toMatchObject({ trackId: 1001 });
    });

    it('should use cached metadata instead of downloading and analysing the audio', async () => {
      cachedMetadata = { waveform: [0.1, 0.5, 1], bpm: 128 };
      audio.src = streamUrl(1002);
      const bpmCallback = vi.fn();

      await analyse(1002, bpmCallback);

      expect(bpmCallback).toHaveBeenCalledWith(128);
      expect(messagesFor('renderBuffer')).toEqual([]);
    });

    it('should draw the cached waveform', async () => {
      cachedMetadata = { waveform: [0.1, 0.5, 1], bpm: 128 };
      audio.src = streamUrl(1003);

      await analyse(1003);

      expect(mockContext.fillRect).toHaveBeenCalledTimes(3);
    });

    it('should send freshly analysed metadata back to the cache', async () => {
      audio.src = streamUrl(1004);

      await analyse(1004);

      await vi.waitFor(() => expect(messagesFor('postTrackMetadata').length).toBe(1));
      const [message] = messagesFor('postTrackMetadata')[0];
      expect(message).toMatchObject({ trackId: 1004, bpm: 120 });
      expect(message.waveform).toHaveLength(100);
    });

    it('should not cache anything for a track it cannot identify', async () => {
      audio.src = 'https://example.com/not-a-bandcamp-stream.mp3';

      await analyse(0);

      expect(messagesFor('fetchTrackMetadata')).toEqual([]);
      await vi.waitFor(() => expect(messagesFor('postTrackMetadata')).toEqual([]));
    });
  });

  describe('waveform colours', () => {
    it('should use grey (#e2e2e6) for base waveform', async () => {
      const bpmCallback = vi.fn();
      const currentTarget = { value: undefined as string | undefined };
      const waveformColour = '#e2e2e6';

      audio.src = 'https://t4.bcbits.com/stream/test-audio.mp3';

      await generateAudioFeatures(() => audio, canvas, bpmCallback, waveformColour, console as any, currentTarget, {
        urlFormatter: () => ({ stream: { type: 'direct-path' as const, path: 'test-audio.mp3' } })
      });

      await vi.waitFor(() => expect(mockContext.fillStyle).toBe(waveformColour));
    });

    it('should use purple (#5b53e8) for progress overlay', () => {
      const waveformColour = '#e2e2e6';
      const overlayColour = '#5b53e8'; // Purple accent

      drawOverlay(canvas, 0.5, overlayColour, waveformColour);

      expect(mockContext.fillRect).toHaveBeenLastCalledWith(0, 0, canvas.width * 0.5, canvas.height);
      expect(mockContext.fillStyle).toBe(overlayColour);
    });
  });
});
