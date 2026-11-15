import Logger from '../logger';

const log = new Logger();

export interface PortChannel {
  send: (message: object) => void;
  abandon: () => void;
  isAbandoned: () => boolean;
}

export function createPortChannel(port: chrome.runtime.Port): PortChannel {
  let abandoned = false;

  const abandon = (): void => {
    abandoned = true;
    log.info('The page that started this work went away, abandoning it');
  };

  return {
    abandon,
    isAbandoned: () => abandoned,
    send: (message: object) => {
      if (abandoned) return;

      try {
        port.postMessage(message);
      } catch (error) {
        log.warn(`Could not reach the page waiting on this work: ${error}`);
        abandon();
      }
    }
  };
}
