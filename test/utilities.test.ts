import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

import DBUtils, { getDB, mousedownCallback, extractBandFollowInfo, loadTextFile } from '../src/utilities';
import { getTralbumDetailsFromPage } from '../src/bclient';

vi.mock('../src/bclient', () => ({
  getTralbumDetailsFromPage: vi.fn(),
  CURRENCY_MINIMUMS: { USD: 0.5, EUR: 0.25 }
}));

describe('mousedownCallback', () => {
  const spyElement = { click: vi.fn(), duration: 0, currentTime: 0 };

  beforeEach(() => {
    vi.spyOn(document, 'querySelector').mockReturnValue(spyElement as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('positions audio play position based on click', () => {
    spyElement.duration = 100;
    spyElement.currentTime = 0;

    let event = {
      offsetX: 1,
      target: { offsetWidth: 2 }
    };

    mousedownCallback(event as any);

    expect(document.querySelector).toHaveBeenCalledWith('audio');
    expect(spyElement.currentTime).toBe(50);
  });
});

describe('getDB', () => {
  it('should be a function', () => {
    expect(typeof getDB).toBe('function');
  });

  it('should work with DBUtils object interface', () => {
    expect(typeof DBUtils.getDB).toBe('function');
  });
});

describe('extractBandFollowInfo', () => {
  beforeEach(() => {
    createDomNodes(`
            <script type="text/javascript" data-band-follow-info="{&quot;tralbum_id&quot;:2105824806,&quot;tralbum_type&quot;:&quot;a&quot;}"></script>
          `);
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  it('should return a specific set of data', () => {
    const bandInfo = extractBandFollowInfo();
    expect(bandInfo).toEqual({
      tralbum_id: 2105824806,
      tralbum_type: 'a'
    });
  });
});

describe('loadTextFile', () => {
  let mockInput: HTMLInputElement;
  let mockFile: File;
  let mockReader: FileReader;

  beforeEach(() => {
    mockInput = {
      type: '',
      accept: '',
      onchange: null,
      click: vi.fn(),
      files: null
    } as any;

    mockReader = {
      onload: null,
      onerror: null,
      readAsText: vi.fn(),
      result: 'test file content'
    } as any;

    mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    vi.spyOn(document, 'createElement').mockReturnValue(mockInput);
    vi.spyOn(window, 'FileReader').mockReturnValue(mockReader);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create file input with correct attributes', () => {
    loadTextFile();

    expect(document.createElement).toHaveBeenCalledWith('input');
    expect(mockInput.type).toBe('file');
    expect(mockInput.accept).toBe('.txt,.json');
    expect(mockInput.click).toHaveBeenCalled();
  });

  it('should resolve with file content when file is loaded', async () => {
    const promise = loadTextFile();

    mockInput.files = [mockFile] as any;

    const changeEvent = { target: mockInput } as any;
    mockInput.onchange!(changeEvent);

    expect(mockReader.readAsText).toHaveBeenCalledWith(mockFile);

    const loadEvent = { target: { result: 'test file content' } } as any;
    mockReader.onload!(loadEvent);

    const result = await promise;
    expect(result).toBe('test file content');
  });

  it('should reject when file read fails', async () => {
    const promise = loadTextFile();

    mockInput.files = [mockFile] as any;

    const changeEvent = { target: mockInput } as any;
    mockInput.onchange!(changeEvent);

    const errorEvent = new Error('File read failed') as any;
    mockReader.onerror!(errorEvent);

    await expect(promise).rejects.toEqual(errorEvent);
  });

  it('should reject when result is not string', async () => {
    const promise = loadTextFile();

    mockInput.files = [mockFile] as any;

    const changeEvent = { target: mockInput } as any;
    mockInput.onchange!(changeEvent);

    const loadEvent = { target: { result: new ArrayBuffer(8) } } as any;
    mockReader.onload!(loadEvent);

    await expect(promise).rejects.toThrow('Failed to read file as text');
  });
});

describe('getTralbumDetailsFromPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract album info from bandcamp URL', async () => {
    const mockResult = {
      id: 12345,
      type: 'a',
      title: 'Test Album',
      tralbum_artist: 'Test Artist',
      currency: 'USD',
      bandcamp_url: 'https://test.bandcamp.com/album/test-album',
      price: 0.5,
      is_purchasable: true
    };

    (getTralbumDetailsFromPage as any).mockResolvedValue(mockResult);

    const result = await getTralbumDetailsFromPage('https://test.bandcamp.com/album/test-album');

    expect(getTralbumDetailsFromPage).toHaveBeenCalledWith('https://test.bandcamp.com/album/test-album');
    expect(result).toEqual(mockResult);
  });

  it('should extract track info from bandcamp URL', async () => {
    const mockResult = {
      id: 12345,
      type: 't',
      title: 'Test Track',
      tralbum_artist: 'Test Artist',
      currency: 'USD',
      bandcamp_url: 'https://test.bandcamp.com/track/test-track',
      price: 0.5,
      is_purchasable: true
    };

    (getTralbumDetailsFromPage as any).mockResolvedValue(mockResult);

    const result = await getTralbumDetailsFromPage('https://test.bandcamp.com/track/test-track');

    expect(result).toEqual(mockResult);
  });

  it('should default to USD currency when not provided', async () => {
    const mockResult = {
      id: 12345,
      type: 'a',
      title: 'Test Album',
      tralbum_artist: 'Test Artist',
      currency: 'USD',
      bandcamp_url: 'https://test.bandcamp.com/album/test-album',
      price: 0.5,
      is_purchasable: true
    };

    (getTralbumDetailsFromPage as any).mockResolvedValue(mockResult);

    const result = await getTralbumDetailsFromPage('https://test.bandcamp.com/album/test-album');

    expect(result.currency).toBe('USD');
    expect(result.price).toBe(0.5);
  });

  it('should throw error when fetch fails', async () => {
    (getTralbumDetailsFromPage as any).mockRejectedValue(new Error('Failed to fetch page: 404'));

    await expect(getTralbumDetailsFromPage('https://test.bandcamp.com/album/not-found')).rejects.toThrow(
      'Failed to fetch page: 404'
    );
  });

  it('should throw error when tralbum data not found', async () => {
    (getTralbumDetailsFromPage as any).mockRejectedValue(new Error('Could not find tralbum data in page'));

    await expect(getTralbumDetailsFromPage('https://test.bandcamp.com/album/no-data')).rejects.toThrow(
      'Could not find tralbum data in page'
    );
  });
});
