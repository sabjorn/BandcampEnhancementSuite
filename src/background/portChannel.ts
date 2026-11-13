import Logger from '../logger';

const log = new Logger();

export class PortChannel {
  private abandoned = false;

  constructor(private readonly port: chrome.runtime.Port) {}

  abandon(): void {
    this.abandoned = true;
    log.info('The page that started this work went away, abandoning it');
  }

  isAbandoned(): boolean {
    return this.abandoned;
  }

  send(message: object): void {
    if (this.abandoned) return;

    try {
      this.port.postMessage(message);
    } catch (error) {
      log.warn(`Could not reach the page waiting on this work: ${error}`);
      this.abandon();
    }
  }
}

export function perPort<T>(create: (port: chrome.runtime.Port) => T): (port: chrome.runtime.Port) => T {
  const instances = new WeakMap<chrome.runtime.Port, T>();

  return port => {
    const existing = instances.get(port);
    if (existing) return existing;

    const created = create(port);
    instances.set(port, created);

    return created;
  };
}
