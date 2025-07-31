import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createDomNodes, cleanupTestNodes } from './utils'

import DBUtils, { getDB, mousedownCallback, extractBandFollowInfo } from '../src/utilities'

describe('mousedownCallback', () => {
  const spyElement = { click: vi.fn(), duration: 0, currentTime: 0 }

  beforeEach(() => {
    vi.spyOn(document, 'querySelector').mockReturnValue(spyElement as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('positions audio play position based on click', () => {
    spyElement.duration = 100
    spyElement.currentTime = 0

    let event = {
      offsetX: 1,
      target: { offsetWidth: 2 }
    }

    mousedownCallback(event as any)

    expect(document.querySelector).toHaveBeenCalledWith('audio')
    expect(spyElement.currentTime).toBe(50)
  })
})

describe('getDB', () => {
  it('should be a function', () => {
    expect(typeof getDB).toBe('function')
  })

  // Test backward compatibility
  it('should work with DBUtils object interface', () => {
    expect(typeof DBUtils.getDB).toBe('function')
  })
})

describe('extractBandFollowInfo', () => {
  beforeEach(() => {
    createDomNodes(`
            <script type="text/javascript" data-band-follow-info="{&quot;tralbum_id&quot;:2105824806,&quot;tralbum_type&quot;:&quot;a&quot;}"></script>
          `)
  })

  afterEach(() => {
    cleanupTestNodes()
  })

  it('should return a specific set of data', () => {
    const bandInfo = extractBandFollowInfo()
    expect(bandInfo).toEqual({
      tralbum_id: 2105824806,
      tralbum_type: 'a'
    })
  })
})