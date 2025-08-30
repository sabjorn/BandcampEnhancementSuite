import Logger from '../logger';
import { downloadFile, dateString } from '../utilities';
import {
  showErrorMessage,
  showSuccessMessage,
  showPersistentNotification,
  updatePersistentNotification,
  removePersistentNotification
} from '../components/notifications';
import { createButton } from '../components/buttons';

export function mutationCallback(
  buttons: {
    curl?: HTMLAnchorElement & { disable: () => void; enable: () => void };
    zip?: HTMLAnchorElement & { disable: () => void; enable: () => void };
  },
  log: Logger
): void {
  const allDownloadLinks = document.querySelectorAll('.download-title .item-button');

  const linksReady = [...allDownloadLinks].every(element => (element as HTMLElement).style.display !== 'none');

  log.info(`linksReady: ${linksReady}`);
  if (linksReady) {
    buttons.curl?.enable();
    if (buttons.curl) buttons.curl.innerText = 'Download cURL File';

    buttons.zip?.enable();
    if (buttons.zip) buttons.zip.innerText = 'Download ZIP';
    return;
  }

  buttons.curl?.disable();
  if (buttons.curl) buttons.curl.innerText = 'preparing download';

  buttons.zip?.disable();
  if (buttons.zip) buttons.zip.innerText = 'preparing download';
}

export function createCurlButton(
  log: Logger
): (HTMLAnchorElement & { disable: () => void; enable: () => void }) | undefined {
  const downloadTitlesLocation = document.querySelector('div.download-titles');
  if (!downloadTitlesLocation) {
    log.warn('Cannot create download button: div.download-titles element not found');
    return undefined;
  }

  const curlDownloadButton = createButton({
    className: 'bes-downloadall',
    innerText: 'preparing download',
    buttonClicked: () => {
      const downloadDate = dateString();
      const downloadList = generateDownloadList();
      const preamble = getDownloadPreamble();
      const postamble = getDownloadPostamble();
      const downloadDocument = preamble + downloadList + postamble;

      downloadFile(`bandcamp_${downloadDate}.txt`, downloadDocument);
    }
  });

  curlDownloadButton.title = "Generates a file for automating downloads using 'cURL'";
  curlDownloadButton.disable();

  downloadTitlesLocation.append(curlDownloadButton);
  return curlDownloadButton;
}

export function createZipDownloadButton(
  log: Logger
): (HTMLAnchorElement & { disable: () => void; enable: () => void }) | undefined {
  const downloadTitlesLocation = document.querySelector('div.download-titles');
  if (!downloadTitlesLocation) {
    log.warn('Cannot create zip download button: div.download-titles element not found');
    return undefined;
  }

  const zipDownloadButton = createButton({
    className: 'bes-downloadzip',
    innerText: 'preparing download',
    buttonClicked: async () => {
      await downloadAsZip(log);
    }
  });

  zipDownloadButton.title = 'Downloads all files directly to a zip archive';
  zipDownloadButton.style.marginLeft = '10px';
  zipDownloadButton.disable();

  downloadTitlesLocation.append(zipDownloadButton);
  return zipDownloadButton;
}

export async function initDownload(): Promise<void> {
  const log = new Logger();

  log.info('Initiating BES Download Helper');

  const curlButton = createCurlButton(log);
  const zipButton = createZipDownloadButton(log);
  const buttons = { curl: curlButton, zip: zipButton };

  const callback = () => mutationCallback(buttons, log);
  const observer = new MutationObserver(callback);

  callback();

  const config = { attributes: true, attributeFilter: ['href'] };
  const targetNodes = document.querySelectorAll('.download-title .item-button');

  for (let node of targetNodes) {
    observer.observe(node, config);
  }
}

export function generateDownloadList(): string {
  const urlSet = new Set(
    [...document.querySelectorAll('a.item-button')].map(item => {
      return item.getAttribute('href')!;
    })
  );

  if (urlSet.size === 0) return 'URLS=()\n';

  const fileList = [...urlSet].map(url => `\t"${url}"`).join('\n');
  return 'URLS=(\n' + fileList + '\n)\n';
}

const preamble = `#!/usr/bin/env bash

`;

const postamble = `
DEFAULT_BATCH_SIZE=5

download_file() {
    local url="$1"
    
    if curl -L --fail -OJ "$url" 2>/dev/null; then
        echo -n "."
        return 0
    else
        echo -n "x"
        return 1
    fi
}

TOTAL_URLS=\${#URLS[@]}
COMPLETED=0
FAILED=0
BATCH_SIZE=\${1:-$DEFAULT_BATCH_SIZE}
if [ "$BATCH_SIZE" -eq "$DEFAULT_BATCH_SIZE" ] && [ -z "$1" ]; then
    echo "note: the BATCH_SIZE can be set with a numerical argument after the command. e.g. bash this_script.txt 10"
fi

echo "Beginning parallel download of $TOTAL_URLS files (batch size: $BATCH_SIZE)"
for ((i=0; i<TOTAL_URLS; i+=BATCH_SIZE)); do
    pids=()
    for ((j=i; j<i+BATCH_SIZE && j<TOTAL_URLS; j++)); do
        download_file "\${URLS[j]}" &
        pids+=($!)
    done
    
    for pid in "\${pids[@]}"; do
        wait $pid
        status=$?
        if [ $status -eq 0 ]; then
            ((COMPLETED++))
        else
            ((FAILED++))
        fi
    done
done

echo ""
if [ $FAILED -eq 0 ]; then
    echo "Successfully downloaded $TOTAL_URLS files"
else
    echo "$FAILED files failed to download"
fi
echo ""
echo "Press any key to exit..."
read -n 1

exit $FAILED
`;

export function getDownloadPreamble(): string {
  return preamble;
}

export function getDownloadPostamble(): string {
  return postamble;
}

export async function downloadAsZip(log: Logger): Promise<void> {
  const urls = [...document.querySelectorAll('a.item-button')]
    .map(item => item.getAttribute('href'))
    .filter((url): url is string => url !== null);

  if (urls.length === 0) {
    showErrorMessage('No download links found');
    return;
  }

  log.info(`Starting zip download for ${urls.length} files via background script`);

  try {
    // Connect to background script
    const port = chrome.runtime.connect({ name: 'bes' });

    // Variables for chunked zip data
    let zipChunks: string[] = [];
    let expectedChunks = 0;
    let zipFilename = '';

    // Set up message listener for progress updates
    port.onMessage.addListener(async message => {
      if (message.type === 'downloadProgress') {
        if (!document.getElementById('bes-download-progress')) {
          showPersistentNotification({
            id: 'bes-download-progress',
            message: message.message,
            type: 'info'
          });
        } else {
          updatePersistentNotification('bes-download-progress', message.message);
        }
      } else if (message.type === 'zipChunk') {
        // Handle chunked zip data
        if (message.chunkIndex === 0) {
          // First chunk - initialize
          zipChunks = Array.from({ length: message.totalChunks });
          expectedChunks = message.totalChunks;
          zipFilename = message.filename;
          log.info(`Receiving zip in ${expectedChunks} chunks`);

          updatePersistentNotification('bes-download-progress', 'Downloading... 0%');
        }

        zipChunks[message.chunkIndex] = message.data;
        log.info(`Received chunk ${message.chunkIndex + 1}/${expectedChunks}`);

        // Calculate download percentage
        const receivedSoFar = message.chunkIndex + 1;
        const percentage = Math.round((receivedSoFar / expectedChunks) * 100);
        updatePersistentNotification('bes-download-progress', `Downloading... ${percentage}%`);

        // Check if all chunks received
        const receivedChunks = zipChunks.filter(chunk => chunk !== undefined).length;
        if (receivedChunks === expectedChunks) {
          log.info('All chunks received, assembling zip file...');

          try {
            // Convert base64 chunks back to binary one by one (avoid memory issues)
            log.info('Converting base64 chunks to binary...');
            const binaryChunks: Uint8Array[] = [];
            let totalLength = 0;

            for (let i = 0; i < zipChunks.length; i++) {
              const chunk = zipChunks[i];
              if (!chunk) {
                throw new Error(`Missing chunk at index ${i}`);
              }

              const binaryString = atob(chunk);
              const chunkBytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                chunkBytes[j] = binaryString.charCodeAt(j);
              }

              binaryChunks.push(chunkBytes);
              totalLength += chunkBytes.length;

              if ((i + 1) % 10 === 0) {
                log.info(`Processed chunk ${i + 1}/${zipChunks.length}`);
              }
            }

            log.info(`Converting ${binaryChunks.length} chunks to single array (${totalLength} bytes)...`);

            // Combine all binary chunks into one array
            const bytes = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of binaryChunks) {
              bytes.set(chunk, offset);
              offset += chunk.length;
            }

            log.info(`Assembled zip file: ${bytes.length} bytes`);

            // Create blob and trigger download
            log.info('Creating blob...');
            const blob = new Blob([bytes], { type: 'application/zip' });
            log.info(`Blob created, size: ${blob.size} bytes`);

            log.info('Creating download URL...');
            const downloadUrl = URL.createObjectURL(blob);

            log.info('Triggering download...');
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = zipFilename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            removePersistentNotification('bes-download-progress');
            showSuccessMessage(`Successfully downloaded ${zipFilename}`);
          } catch (error) {
            log.error(`Error assembling zip file: ${error}`);
            removePersistentNotification('bes-download-progress');
            showErrorMessage('Failed to assemble zip file');
          }
        }
      } else if (message.type === 'downloadComplete') {
        if (!message.success) {
          removePersistentNotification('bes-download-progress');
          showErrorMessage(message.message);
        }
        // Success case is handled after all chunks are received
        port.disconnect();
      }
    });

    // Send download request to background script
    port.postMessage({
      type: 'downloadZip',
      urls: urls
    });
  } catch (error) {
    log.error(`Error connecting to background script: ${error}`);
    showErrorMessage('Failed to connect to background script for downloading');
  }
}
