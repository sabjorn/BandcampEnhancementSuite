import Logger from '../logger';

const log = new Logger();

const BATCH_SIZE = 5;

interface DownloadRequest {
  type: 'downloadFiles';
  urls: string[];
}

interface FileDownloaded {
  type: 'fileDownloaded';
  filename: string;
  data: ArrayBuffer;
}

interface DownloadComplete {
  type: 'downloadComplete';
  success: boolean;
  message?: string;
}

async function handleDownloadFiles(urls: string[], port: chrome.runtime.Port): Promise<void> {
  log.info(`Starting background download for ${urls.length} files`);

  let completed = 0;
  let failed = 0;

  const downloadFile = async (url: string): Promise<void> => {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        failed++;
        log.warn(`Failed to download ${url}: ${response.status}`);
        return;
      }

      const filename = getFilenameFromResponse(response, url);
      if (!filename) {
        failed++;
        log.error(`Unable to determine filename for ${url}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      log.info(`Downloaded ${filename}: ${arrayBuffer.byteLength} bytes`);

      if (arrayBuffer.byteLength === 0) {
        failed++;
        log.warn(`File ${filename} has 0 bytes, skipping`);
        return;
      }

      port.postMessage({
        type: 'fileDownloaded',
        filename,
        data: arrayBuffer
      } as FileDownloaded);

      completed++;
    } catch (error) {
      failed++;
      log.error(`Error downloading ${url}: ${error}`);
    }
  };

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(url => downloadFile(url)));
  }

  log.info(`Download complete: ${completed} succeeded, ${failed} failed out of ${urls.length} total`);

  port.postMessage({
    type: 'downloadComplete',
    success: completed > 0,
    message: failed > 0 ? `${failed} files failed to download` : undefined
  } as DownloadComplete);
}

function getFilenameFromResponse(response: Response, url: string): string | null {
  try {
    const contentDisposition = response.headers.get('content-disposition');

    if (!contentDisposition) {
      const urlObj = new URL(url);
      const urlPathname = urlObj.pathname;
      const filenameFromUrl = urlPathname.split('/').pop();

      if (!filenameFromUrl) return null;

      if (filenameFromUrl.includes('.')) return filenameFromUrl;

      return `${filenameFromUrl}.flac`;
    }

    const headerFilenamePattern = /filename\*?=['"]?([^'";]+)['"]?/i;
    const filenameMatch = contentDisposition.match(headerFilenamePattern);

    if (!filenameMatch || !filenameMatch[1]) return null;

    let extractedFilename = filenameMatch[1];

    const isRfc5987Encoded = extractedFilename.includes("UTF-8''");
    if (isRfc5987Encoded) {
      const encodedPart = extractedFilename.split("UTF-8''")[1];
      extractedFilename = decodeURIComponent(encodedPart);
    }

    const hasFileExtension = extractedFilename.includes('.');
    if (!hasFileExtension) {
      extractedFilename += '.flac';
    }

    return extractedFilename;
  } catch {
    return null;
  }
}

export function initDownloadBackend(): void {
  log.info('Initializing download backend');

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'bes') return;

    port.onMessage.addListener(async (message: DownloadRequest) => {
      if (message.type === 'downloadFiles') {
        log.info('Download backend handling file download request');
        await handleDownloadFiles(message.urls, port);
      }
    });
  });
}
