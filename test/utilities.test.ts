import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';

import DBUtils, { getDB, mousedownCallback, extractBandFollowInfo, loadTextFile, extractBandcampUrlInfo } from '../src/utilities';

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

describe('extractBandcampUrlInfo', () => {
  const mockTralbumData = {
    current: {
      id: 12345,
      type: 'album',
      title: 'Test Album',
      minimum_price_currency: 'USD'
    },
    artist: 'Test Artist'
  };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should extract album info from bandcamp URL', async () => {
    const htmlWithData = `<html><div data-tralbum="${JSON.stringify(mockTralbumData).replace(/"/g, '&quot;')}"></div></html>`;
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(htmlWithData)
    };
    
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await extractBandcampUrlInfo('https://test.bandcamp.com/album/test-album');

    expect(fetch).toHaveBeenCalledWith('https://test.bandcamp.com/album/test-album');
    expect(result).toEqual({
      item_id: 12345,
      item_type: 'a',
      item_title: 'Test Album',
      band_name: 'Test Artist',
      currency: 'USD',
      url: 'https://test.bandcamp.com/album/test-album',
      unit_price: 0.5
    });
  });

  it('should extract track info from bandcamp URL', async () => {
    const trackData = {
      ...mockTralbumData,
      current: {
        ...mockTralbumData.current,
        type: 'track',
        title: 'Test Track'
      }
    };

    const htmlWithData = `<html><div data-tralbum="${JSON.stringify(trackData).replace(/"/g, '&quot;')}"></div></html>`;
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(htmlWithData)
    };
    
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await extractBandcampUrlInfo('https://test.bandcamp.com/track/test-track');

    expect(result).toEqual({
      item_id: 12345,
      item_type: 't',
      item_title: 'Test Track',
      band_name: 'Test Artist',
      currency: 'USD',
      url: 'https://test.bandcamp.com/track/test-track',
      unit_price: 0.5
    });
  });

  it('should default to USD currency when not provided', async () => {
    const dataWithoutCurrency = {
      ...mockTralbumData,
      current: {
        ...mockTralbumData.current,
        minimum_price_currency: undefined
      }
    };

    const htmlWithData = `<html><div data-tralbum="${JSON.stringify(dataWithoutCurrency).replace(/"/g, '&quot;')}"></div></html>`;
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue(htmlWithData)
    };
    
    (global.fetch as any).mockResolvedValue(mockResponse);

    const result = await extractBandcampUrlInfo('https://test.bandcamp.com/album/test-album');

    expect(result.currency).toBe('USD');
    expect(result.unit_price).toBe(0.5);
  });

  it('should throw error when fetch fails', async () => {
    const mockResponse = { ok: false, status: 404 };
    (global.fetch as any).mockResolvedValue(mockResponse);

    await expect(extractBandcampUrlInfo('https://test.bandcamp.com/album/not-found'))
      .rejects.toThrow('Failed to fetch page: 404');
  });

  it('should throw error when tralbum data not found', async () => {
    const mockResponse = {
      ok: true,
      text: vi.fn().mockResolvedValue('<html><div></div></html>')
    };
    
    (global.fetch as any).mockResolvedValue(mockResponse);

    await expect(extractBandcampUrlInfo('https://test.bandcamp.com/album/no-data'))
      .rejects.toThrow('Could not find tralbum data in page');
  });
});
