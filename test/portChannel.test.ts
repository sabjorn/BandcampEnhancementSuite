import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/logger', () => ({
  default: class MockLogger {
    info = vi.fn();
    error = vi.fn();
    debug = vi.fn();
    warn = vi.fn();
  }
}));

import { PortChannel, perPort } from '../src/background/portChannel';

const stubPort = () => ({ postMessage: vi.fn() }) as unknown as chrome.runtime.Port;

describe('PortChannel', () => {
  it('should pass a message to its port', () => {
    const port = stubPort();

    new PortChannel(port).send({ progress: 1 });

    expect(port.postMessage).toHaveBeenCalledWith({ progress: 1 });
  });

  it('should send nothing once abandoned', () => {
    const port = stubPort();
    const channel = new PortChannel(port);

    channel.abandon();
    channel.send({ progress: 1 });

    expect(port.postMessage).not.toHaveBeenCalled();
    expect(channel.isAbandoned()).toBe(true);
  });

  it('should abandon itself rather than throw when the port is already gone', () => {
    const port = {
      postMessage: vi.fn(() => {
        throw new Error('Attempting to use a disconnected port object');
      })
    } as unknown as chrome.runtime.Port;
    const channel = new PortChannel(port);

    expect(() => channel.send({ progress: 1 })).not.toThrow();
    expect(channel.isAbandoned()).toBe(true);
  });

  it('should stop trying after the first failed send', () => {
    const port = {
      postMessage: vi.fn(() => {
        throw new Error('Attempting to use a disconnected port object');
      })
    } as unknown as chrome.runtime.Port;
    const channel = new PortChannel(port);

    channel.send({ progress: 1 });
    channel.send({ progress: 2 });

    expect(port.postMessage).toHaveBeenCalledTimes(1);
  });
});

describe('perPort', () => {
  it('should hand back the same instance for one port', () => {
    const create = vi.fn((_port: chrome.runtime.Port) => ({}));
    const forPort = perPort(create);
    const port = stubPort();

    expect(forPort(port)).toBe(forPort(port));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('should keep separate instances for separate ports', () => {
    const forPort = perPort((_port: chrome.runtime.Port) => ({}));

    expect(forPort(stubPort())).not.toBe(forPort(stubPort()));
  });
});
