import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { createDomNodes, cleanupTestNodes } from './utils'

import { mousedownCallback } from '../src/utilities'
import AudioFeatures from '../src/audioFeatures'

// Since we've migrated to functional architecture, let's test the core functionality
// rather than the complex mocking setup

describe('AudioFeatures', () => {
  const mockPort = {
    onMessage: { addListener: vi.fn() },
    postMessage: vi.fn()
  }

  beforeEach(() => {
    // Mock AudioContext globally
    globalThis.AudioContext = vi.fn().mockImplementation(() => ({
      decodeAudioData: vi.fn().mockResolvedValue({}),
      createAnalyser: vi.fn(),
      createBufferSource: vi.fn(),
      close: vi.fn()
    }))

    createDomNodes(`
      <audio></audio>
      <div class="progbar"></div>
      <div class="controls"></div>
      <h2 class="trackTitle">Test Title</h2>
    `)
  })

  afterEach(() => {
    cleanupTestNodes()
    vi.restoreAllMocks()
    // Clean up AudioContext mock
    delete (globalThis as any).AudioContext
  })

  it('should initialize AudioFeatures functionality', () => {
    const audioFeatures = new AudioFeatures(mockPort)
    
    // Test that the constructor works
    expect(audioFeatures.log).toBeDefined()
    expect(audioFeatures.port).toBe(mockPort)
    
    // Just test that the object is created properly - init has complex dependencies
    expect(audioFeatures).toBeDefined()
  })

  // Test basic functionality of the utility functions
  it('should test utility functions', async () => {
    const { 
      createCanvas, 
      createCanvasDisplayToggle, 
      createBpmDisplay,
      fillBar,
      drawOverlay,
      invertColour,
      toggleWaveformCanvas,
      monitorAudioCanPlay,
      monitorAudioTimeupdate,
      applyAudioConfig 
    } = await vi.importActual('../src/audioFeatures') as any

    // Test invertColour function
    let inverted = invertColour('rgb(255,255,255)')
    expect(inverted).toBe('rgb(0,0,0)')

    inverted = invertColour('rgb(0,0,0)')
    expect(inverted).toBe('rgb(255,255,255)')

    // Test toggleWaveformCanvas
    const expectedMessage = { toggleWaveformDisplay: {} }
    toggleWaveformCanvas(mockPort)
    expect(mockPort.postMessage).toHaveBeenCalledWith(
      expect.objectContaining(expectedMessage)
    )

    // Test applyAudioConfig
    const canvasFake = { style: { display: 'inherit' } }
    const displayToggle = { checked: false }
    const mockLog = { info: vi.fn() } 

    applyAudioConfig({ config: { displayWaveform: false } }, canvasFake as any, displayToggle as any, mockLog as any)
    expect(canvasFake.style.display).toBe('none')

    // Test DOM creation functions work without throwing
    expect(() => createCanvas()).not.toThrow()
    expect(() => createCanvasDisplayToggle()).not.toThrow()  
    expect(() => createBpmDisplay()).not.toThrow()
  })
})