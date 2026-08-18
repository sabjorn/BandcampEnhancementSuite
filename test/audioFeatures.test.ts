import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import {
  createCanvas,
  createCanvasDisplayToggle,
  createBpmDisplay,
  invertColour,
  toggleWaveformCanvas,
  applyAudioConfig,
  initAudioFeatures,
  extractTrackId
} from '../src/audioFeatures';

describe('AudioFeatures', () => {
  const mockPort = {
    onMessage: { addListener: vi.fn() },
    postMessage: vi.fn()
  };

  beforeEach(() => {
    globalThis.AudioContext = vi.fn().mockImplementation(() => ({
      decodeAudioData: vi.fn().mockResolvedValue({}),
      createAnalyser: vi.fn(),
      createBufferSource: vi.fn(),
      close: vi.fn()
    }));

    createDomNodes(`
      <audio></audio>
      <div class="progbar"></div>
      <div class="controls"></div>
      <h2 class="trackTitle" style="color: rgb(255,255,255);">Test Title</h2>
    `);
  });

  afterEach(() => {
    cleanupTestNodes();
    vi.restoreAllMocks();
    delete (globalThis as any).AudioContext;
  });

  it('should initialize AudioFeatures functionality', () => {
    expect(() => initAudioFeatures(mockPort)).not.toThrow();
    expect(mockPort.postMessage).toHaveBeenCalledWith({ requestConfig: {} });
  });

  it('should invert colors correctly', () => {
    let inverted = invertColour('rgb(255,255,255)');
    expect(inverted).toBe('rgb(0,0,0)');

    inverted = invertColour('rgb(0,0,0)');
    expect(inverted).toBe('rgb(255,255,255)');
  });

  it('should toggle waveform canvas display', () => {
    const expectedMessage = { toggleWaveformDisplay: {} };
    toggleWaveformCanvas(mockPort);
    expect(mockPort.postMessage).toHaveBeenCalledWith(expect.objectContaining(expectedMessage));
  });

  it('should apply audio configuration correctly', () => {
    const canvasFake = { style: { display: 'inherit' } };
    const displayToggle = { checked: false };
    const mockLog = { info: vi.fn() };

    applyAudioConfig({ config: { displayWaveform: false } }, canvasFake as any, displayToggle as any, mockLog as any);
    expect(canvasFake.style.display).toBe('none');
  });

  it('should create audio UI components without throwing', () => {
    expect(() => createCanvas()).not.toThrow();
    expect(() => createCanvasDisplayToggle()).not.toThrow();
    expect(() => createBpmDisplay()).not.toThrow();
  });
});

describe('extractTrackId', () => {
  it('should read the track id from a Bandcamp stream url', () => {
    expect(extractTrackId('https://t4.bcbits.com/stream/somehash/mp3-128/3877359137?p=0&ts=1&t=abc')).toBe(3877359137);
  });

  it('should read the track id when the url carries no query string', () => {
    expect(extractTrackId('https://t4.bcbits.com/stream/somehash/mp3-128/1234')).toBe(1234);
  });

  it('should return nothing for a url that is not a stream', () => {
    expect(extractTrackId('https://example.com/audio.mp3')).toBeNull();
  });

  it('should return nothing when the stream path is too short to hold an id', () => {
    expect(extractTrackId('https://t4.bcbits.com/stream/test-audio.mp3')).toBeNull();
  });

  it('should return nothing when the final segment is not a number', () => {
    expect(extractTrackId('https://t4.bcbits.com/stream/somehash/mp3-128/notanid')).toBeNull();
  });
});
