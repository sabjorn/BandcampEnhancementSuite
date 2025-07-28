import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest'
import { createDomNodes, cleanupTestNodes } from './utils'

import { mousedownCallback } from '../src/utilities'
import AudioFeatures, { 
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
} from '../src/audioFeatures'

vi.mock('../src/audioFeatures', async () => {
  const actual = await vi.importActual('../src/audioFeatures') as any
  return {
    ...actual,
    createCanvas: vi.fn(),
    createCanvasDisplayToggle: vi.fn(),
    createBpmDisplay: vi.fn(),
    fillBar: vi.fn(),
    drawOverlay: vi.fn(),
    invertColour: vi.fn(),
    toggleWaveformCanvas: vi.fn(),
    monitorAudioCanPlay: vi.fn(),
    monitorAudioTimeupdate: vi.fn(),
    applyAudioConfig: vi.fn()
  }
})

describe('AudioFeatures', () => {
  let wf: any
  let _sandbox: any

  let ctx = {
    globalCompositeOperation: {},
    fillStyle: {},
    fillRect: vi.fn(),
    clearRect: vi.fn()
  }

  let canvas = {
    getContext: vi.fn(() => ctx),
    width: 100,
    height: 100
  }

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

    wf = new AudioFeatures(mockPort)

    wf.log = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }

    createDomNodes(`
      <audio></audio>
    `)
  })

  afterEach(() => {
    cleanupTestNodes()
    vi.restoreAllMocks()
    // Clean up AudioContext mock
    delete (globalThis as any).AudioContext
  })

  describe('init()', () => {
    let canvasSpy = {
      addEventListener: vi.fn(),
      style: { display: 'inherit' }
    }

    let toggleDivSpy = {
      addEventListener: vi.fn()
    }

    let toggleSpy = {
      checked: false,
      parentNode: toggleDivSpy
    }

    let bpmDivSpy = vi.fn()

    let _trackTitleElement: any

    let audioSpy = {
      addEventListener: vi.fn()
    }

    let _getPropertyValueStub = vi.fn().mockReturnValue('rgb(255, 0, 0)')

    beforeEach(() => {
      (createCanvas as any).mockReturnValue(canvasSpy)
      ;(createCanvasDisplayToggle as any).mockReturnValue(toggleSpy)
      ;(createBpmDisplay as any).mockReturnValue(bpmDivSpy)
      ;(invertColour as any).mockImplementation(() => 'rgb(0,0,0)')
      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === 'audio') return audioSpy as any
        if (selector === 'h2.trackTitle') return {} as any
        return null
      })

      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        getPropertyValue: vi.fn().mockReturnValue('rgb(255, 0, 0)')
      } as any)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('creates canvas with clickable interface', () => {
      wf.init()
      expect(createCanvas).toHaveBeenCalled()
      expect(canvasSpy.addEventListener).toHaveBeenCalledWith(
        'click',
        mousedownCallback
      )
    })

    it('creates toggle which acts as a display for toggle state', () => {
      wf.init()
      expect(createCanvasDisplayToggle).toHaveBeenCalled()
    })

    it('creates div which can be clicked on to trigger state changes', () => {
      wf.init()
      expect(toggleDivSpy.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      )
    })

    it('creates div to display audio bpm', () => {
      wf.init()
      expect(createBpmDisplay).toHaveBeenCalled()
    })

    it('gets the background colour for specific element', () => {
      wf.init()

      const rgbResult = 'rgb(255, 0, 0)'
      expect(wf.waveformColour).toBe(rgbResult)
      expect(invertColour).toHaveBeenCalledWith(rgbResult)
    })

    it('adds eventListener for audio element canplay', () => {
      wf.init()
      expect(audioSpy.addEventListener).toHaveBeenCalledWith(
        'canplay',
        expect.any(Function)
      )
    })

    it('adds eventListener for audio element timeupdate', () => {
      wf.init()
      expect(audioSpy.addEventListener).toHaveBeenCalledWith(
        'timeupdate',
        expect.any(Function)
      )
    })

    it('adds listener to port.onMessage', () => {
      wf.init()
      expect(mockPort.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      )
    })

    it('posts message to request configs from backend AFTER canvasDisplayToggle', () => {
      wf.init()
      expect(mockPort.postMessage).toHaveBeenCalledWith({
        requestConfig: {}
      })
    })
  })

  describe('generateAudioFeatures()', () => {
    beforeAll(() => {
      // Mock chrome global
      globalThis.chrome = {
        runtime: {
          sendMessage: vi.fn()
        }
      } as any
    })

    let _ctx: any

    let audioSpy = {
      src: 'stream/nothing',
      duration: 10
    }

    beforeEach(() => {
      vi.clearAllMocks()

      vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === 'audio') return audioSpy as any
        return null
      })

      wf.bpmDisplay = { innerText: '' }

      _ctx = vi.fn() // Mock AudioContext

      wf.canvas = canvas
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    afterAll(() => {
      // Clean up chrome mock
      if ('chrome' in globalThis) {
        ;(globalThis as any).chrome = undefined
      }
    })

    it('does nothing if target matches audio.source', () => {
      wf.currentTarget = 'stream/nothing'

      wf.generateAudioFeatures()
      expect(globalThis.chrome.runtime.sendMessage).not.toHaveBeenCalled()
    })

    it('updates target to audio.source if they do not match', () => {
      audioSpy.src = 'a/specific/src'
      wf.currentTarget = ''

      wf.generateAudioFeatures()
      expect(wf.currentTarget).toBe('a/specific/src')
    })

    it('clears bpmDisplay if audio.source does not match previous', () => {
      audioSpy.src = 'a/specific/src'
      wf.bpmDisplay.innerText = 'innerText'

      wf.generateAudioFeatures()
      expect(wf.bpmDisplay.innerText).toBe('')
    })

    it('sends a message with chrome.runtime.sendMessage', () => {
      audioSpy.src = 'stream/src'
      wf.currentTarget = ''
      // Set up canvas with proper mock
      wf.canvas = canvas

      wf.generateAudioFeatures()

      let expectedMessage = {
        contentScriptQuery: 'renderBuffer',
        url: 'src'
      }
      expect(globalThis.chrome.runtime.sendMessage).toHaveBeenCalledWith(expectedMessage, expect.any(Function))
    })
  })

  describe('applyAudioConfig()', () => {
    const canvasFake = {
      style: { display: 'inherit' }
    }
    const displayToggle = { checked: false }
    const mockLog = { info: vi.fn() } as any

    it('sets the display value of the audioFeatures from config object', () => {
      applyAudioConfig({ config: { displayWaveform: false } }, canvasFake as any, displayToggle as any, mockLog)
      expect(canvasFake.style.display).toBe('none')

      applyAudioConfig({ config: { displayWaveform: true } }, canvasFake as any, displayToggle as any, mockLog)
      expect(canvasFake.style.display).toBe('inherit')
    })

    it('sets the display of the onscreen toggle', () => {
      applyAudioConfig({ config: { displayWaveform: false } }, canvasFake as any, displayToggle as any, mockLog)
      expect(displayToggle.checked).toBe(false)

      applyAudioConfig({ config: { displayWaveform: true } }, canvasFake as any, displayToggle as any, mockLog)
      expect(displayToggle.checked).toBe(true)
    })
  })

  describe('toggleWaveformCanvas()', () => {
    it('should send command to backend to invert audioFeaturesDisplay', () => {
      const expectedMessage = { toggleWaveformDisplay: {} }

      toggleWaveformCanvas(mockPort)

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining(expectedMessage)
      )
    })
  })

  describe('monitorAudioCanPlay()', () => {
    let audioSpy = { paused: true }
    let displayToggle = { checked: false }
    let generateAudioFeaturesSpy = vi.fn()

    beforeEach(() => {
      vi.spyOn(document, 'querySelector').mockReturnValue(audioSpy as any)
      generateAudioFeaturesSpy.mockClear()
    })
    
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should call generateAudioFeatures() ', () => {
      audioSpy.paused = false
      displayToggle.checked = true
      monitorAudioCanPlay(displayToggle as any, generateAudioFeaturesSpy)

      expect(generateAudioFeaturesSpy).toHaveBeenCalled()
    })

    it('should not call generateAudioFeatures() ', () => {
      audioSpy.paused = true
      displayToggle.checked = true
      monitorAudioCanPlay(displayToggle as any, generateAudioFeaturesSpy)

      expect(generateAudioFeaturesSpy).not.toHaveBeenCalled()

      audioSpy.paused = true
      displayToggle.checked = false
      monitorAudioCanPlay(displayToggle as any, generateAudioFeaturesSpy)

      expect(generateAudioFeaturesSpy).not.toHaveBeenCalled()
    })
  })

  describe('monitorAudioTimeupdate()', () => {
    it('should update audioFeatures overlay by calling drawOverlay', () => {
      (drawOverlay as any).mockImplementation(() => {})

      const event = {
        target: {
          currentTime: 1,
          duration: 10
        }
      }

      const mockCanvas = {} as HTMLCanvasElement
      const mockOverlayColour = 'red'
      const mockWaveformColour = 'blue'

      monitorAudioTimeupdate(event as any, mockCanvas, mockOverlayColour, mockWaveformColour)
      const expectedProgress = 0.1
      expect(drawOverlay).toHaveBeenCalledWith(
        mockCanvas,
        expectedProgress,
        mockOverlayColour,
        mockWaveformColour
      )
    })
  })

  describe('createCanvas()', () => {
    beforeEach(() => {
      vi.unmock('../src/audioFeatures')
      createDomNodes(`
        <div class="progbar"></div>
      `)
    })
    afterEach(() => {
      cleanupTestNodes()
      vi.doMock('../src/audioFeatures', async () => {
        const actual = await vi.importActual('../src/audioFeatures') as any
        return {
          ...actual,
          createCanvas: vi.fn(),
          createCanvasDisplayToggle: vi.fn(),
          createBpmDisplay: vi.fn(),
          fillBar: vi.fn(),
          drawOverlay: vi.fn(),
          invertColour: vi.fn()
        }
      })
    })

    it('should call create a canvas in the DOM', async () => {
      const { createCanvas } = await vi.importActual('../src/audioFeatures') as any
      let canvas = createCanvas()

      let progbarNodes = document.querySelector('div.waveform')
      let domDiv = progbarNodes?.getElementsByTagName('div')[0]
      let domCanvas = domDiv?.getElementsByTagName('canvas')[0]

      expect(domCanvas).toBe(canvas)
    })
  })

  describe('createCanvasDisplayToggle()', () => {
    beforeEach(() => {
      vi.unmock('../src/audioFeatures')
      createDomNodes(`
        <div class="controls"></div>
      `)
    })
    afterEach(() => {
      cleanupTestNodes()
    })

    it('should call create a toggle in the DOM', async () => {
      const { createCanvasDisplayToggle } = await vi.importActual('../src/audioFeatures') as any
      let toggle = createCanvasDisplayToggle()

      let inlineplayerNodes = document.querySelector('div.controls')

      let domToggle = inlineplayerNodes?.getElementsByTagName('input')[0]
      expect(domToggle?.getAttribute('title')).toBe(
        'toggle waveform display'
      )
      expect(domToggle?.getAttribute('type')).toBe('checkbox')
      expect(domToggle?.getAttribute('class')).toBe('waveform')
      expect(domToggle?.getAttribute('id')).toBe('switch')

      let domLabel = inlineplayerNodes?.getElementsByTagName('label')[0]
      expect(domLabel?.getAttribute('class')).toBe('waveform')
      expect(domLabel?.htmlFor).toBe('switch')
      expect(domLabel?.innerHTML).toBe('Toggle')

      expect(toggle).toBe(domToggle)
    })
  })

  describe('createBpmDisplay()', () => {
    beforeEach(() => {
      vi.unmock('../src/audioFeatures')
      createDomNodes(`
        <div class="progbar"></div>
      `)
    })
    afterEach(() => {
      cleanupTestNodes()
    })

    it('should call create a div in the DOM', async () => {
      const { createBpmDisplay } = await vi.importActual('../src/audioFeatures') as any
      let bpmDiv = createBpmDisplay()

      let inlineplayerNodes = document.querySelector('div.progbar')

      let domBpmDiv = inlineplayerNodes?.getElementsByTagName('div')[0]
      expect(domBpmDiv?.getAttribute('class')).toBe('bpm')

      expect(bpmDiv).toBe(domBpmDiv)
    })
  })

  describe('fillBar()', () => {
    it('should draw narrow rectangular bar on canvas', async () => {
      const { fillBar } = await vi.importActual('../src/audioFeatures') as any
      fillBar(canvas as any, 0.5, 10, 100)

      expect(ctx.globalCompositeOperation).toBe('source-over')
      expect(ctx.fillStyle).toBe('white')
      expect(ctx.fillRect).toHaveBeenCalledWith(10, 100, 1, -50)
    })
  })

  describe('drawOverlay()', () => {
    it('should draw progress bar on canvas', async () => {
      const { drawOverlay } = await vi.importActual('../src/audioFeatures') as any
      drawOverlay(canvas as any, 0.5)

      expect(ctx.globalCompositeOperation).toBe('source-atop')
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100)
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100 * 0.5, 100)
      expect(ctx.fillStyle).toBe('red')
    })
  })

  describe('invertColour()', () => {
    it('should invert rgb colors correctly', async () => {
      const { invertColour } = await vi.importActual('../src/audioFeatures') as any
      let inverted = invertColour('rgb(255,255,255')
      expect(inverted).toBe('rgb(0,0,0)')

      inverted = invertColour('rgb(0,0,0')
      expect(inverted).toBe('rgb(255,255,255)')

      inverted = invertColour('rgb(55,155,200')
      expect(inverted).toBe('rgb(200,100,55)')
    })
  })
})