import Logger from '../logger';
import { downloadZip } from 'client-zip';
import { dateString } from '../utilities';

const log = new Logger();

interface DownloadRequest {
  type: 'downloadZip';
  urls: string[];
}

interface DownloadProgress {
  type: 'downloadProgress';
  completed: number;
  failed: number;
  total: number;
  message: string;
}

interface DownloadComplete {
  type: 'downloadComplete';
  success: boolean;
  filename?: string;
  message: string;
}

interface ZipChunk {
  type: 'zipChunk';
  chunkIndex: number;
  totalChunks: number;
  data: string; // base64 chunk
  filename: string;
}

async function handleDownloadZip(urls: string[], port: chrome.runtime.Port): Promise<void> {
  log.info(`Starting background download for ${urls.length} files`);

  const files: { name: string; input: Uint8Array }[] = [];
  let completed = 0;
  let failed = 0;

  // Send initial progress
  port.postMessage({
    type: 'downloadProgress',
    completed,
    failed,
    total: urls.length,
    message: `Starting download of ${urls.length} files...`
  } as DownloadProgress);

  // Download files in parallel batches to avoid overwhelming the server
  const batchSize = 5; // Process 5 files at a time

  const downloadFile = async (url: string, index: number): Promise<void> => {
    try {
      // Use fetch in background script (no CORS restrictions)
      const response = await fetch(url);

      if (!response.ok) {
        failed++;
        log.warn(`Failed to download ${url}: ${response.status}`);
        return;
      }

      const filename = getFilenameFromResponse(response, url) || `file_${index + 1}.flac`;

      // Convert response to ArrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      log.info(`Downloaded ${filename}: ${arrayBuffer.byteLength} bytes`);

      if (arrayBuffer.byteLength === 0) {
        log.warn(`Warning: ${filename} has 0 bytes`);
      }

      files.push({
        name: filename,
        input: new Uint8Array(arrayBuffer)
      });

      completed++;
    } catch (error) {
      failed++;
      log.error(`Error downloading ${url}: ${error}`);
    }

    // Send progress update after each file (success or failure)
    port.postMessage({
      type: 'downloadProgress',
      completed,
      failed,
      total: urls.length,
      message: `Downloaded ${completed} of ${urls.length} files (${failed} failed)`
    } as DownloadProgress);
  };

  // Process URLs in parallel batches
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchPromises = batch.map((url, batchIndex) => downloadFile(url, i + batchIndex));

    // Wait for this batch to complete before starting the next
    await Promise.all(batchPromises);
  }

  if (files.length === 0) {
    port.postMessage({
      type: 'downloadComplete',
      success: false,
      message: 'No files could be downloaded'
    } as DownloadComplete);
    return;
  }

  try {
    // Show zip creation progress
    port.postMessage({
      type: 'downloadProgress',
      completed,
      failed,
      total: urls.length,
      message: 'Creating zip file...'
    } as DownloadProgress);

    log.info(`Creating zip with ${files.length} files`);
    const blob = await downloadZip(files).blob();
    log.info(`Zip blob created, size: ${blob.size} bytes`);

    const date = dateString();
    const filename = `bandcamp_${date}.zip`;

    // Send zip data to frontend in chunks (service worker can't use URL.createObjectURL)
    log.info('Preparing to send zip data to frontend in chunks...');

    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to base64 in chunks to avoid memory issues
    const chunkSize = 1024 * 1024; // 1MB chunks
    const totalChunks = Math.ceil(uint8Array.length / chunkSize);

    log.info(`Sending ${blob.size} bytes in ${totalChunks} chunks`);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, uint8Array.length);
      const chunk = uint8Array.slice(start, end);

      // Convert chunk to base64
      let binaryString = '';
      for (let j = 0; j < chunk.length; j++) {
        binaryString += String.fromCharCode(chunk[j]);
      }
      const base64Chunk = btoa(binaryString);

      port.postMessage({
        type: 'zipChunk',
        chunkIndex: i,
        totalChunks: totalChunks,
        data: base64Chunk,
        filename: filename
      } as ZipChunk);

      log.info(`Sent chunk ${i + 1}/${totalChunks}`);
    }

    log.info('All chunks sent successfully');

    port.postMessage({
      type: 'downloadComplete',
      success: true,
      filename: filename,
      message:
        failed === 0
          ? `Successfully downloaded ${completed} files as ${filename}`
          : `Downloaded ${completed} files as ${filename}. ${failed} files failed to download.`
    } as DownloadComplete);
  } catch (error) {
    log.error(`Error creating or downloading zip file: ${error}`);
    port.postMessage({
      type: 'downloadComplete',
      success: false,
      message: 'Failed to create or download zip file'
    } as DownloadComplete);
  }
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

    return (() => {
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
    })();
  } catch {
    return null;
  }
}

export function initDownloadBackend(): void {
  log.info('Initializing download backend');

  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'bes') return;

    port.onMessage.addListener(async (message: DownloadRequest) => {
      if (message.type === 'downloadZip') {
        log.info('Download backend handling zip request');
        await handleDownloadZip(message.urls, port);
      }
    });
  });
}
