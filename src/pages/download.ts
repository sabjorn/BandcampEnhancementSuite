import Logger from '../logger';
import { downloadFile, dateString } from '../utilities';
import {
  showErrorMessage,
  showSuccessMessage,
  showPersistentNotification,
  updatePersistentNotification,
  removePersistentNotification
} from '../components/notifications';

export function mutationCallback(buttons: { curl?: HTMLButtonElement; zip?: HTMLButtonElement }, log: Logger): void {
  const allDownloadLinks = document.querySelectorAll('.download-title .item-button');

  const linksReady = [...allDownloadLinks].every(element => (element as HTMLElement).style.display !== 'none');

  log.info(`linksReady: ${linksReady}`);
  if (linksReady) {
    enableButton(buttons.curl, log);
    enableZipButton(buttons.zip, log);
    return;
  }

  disableButton(buttons.curl, log);
  disableZipButton(buttons.zip, log);
}

export function createButton(log: Logger): HTMLButtonElement | undefined {
  const location = document.querySelector('div.download-titles');
  if (!location) {
    log.warn('Cannot create download button: div.download-titles element not found');
    return undefined;
  }

  const button = document.createElement('button');
  button.title = "Generates a file for automating downloads using 'cURL'";
  button.className = 'bes-downloadall';
  button.disabled = true;
  button.textContent = 'preparing download';

  location.append(button);
  return button;
}

export function createZipButton(log: Logger): HTMLButtonElement | undefined {
  const location = document.querySelector('div.download-titles');
  if (!location) {
    log.warn('Cannot create zip download button: div.download-titles element not found');
    return undefined;
  }

  const button = document.createElement('button');
  button.title = 'Downloads all files directly to a zip archive';
  button.className = 'bes-downloadzip';
  button.disabled = true;
  button.textContent = 'preparing download';
  button.style.marginLeft = '10px';

  location.append(button);
  return button;
}

export function enableButton(button: HTMLButtonElement | undefined, log: Logger): void {
  if (!button) return;

  log.info('enableButton()');

  button.disabled = false;
  button.textContent = 'Download cURL File';

  button.addEventListener('click', function () {
    const date = dateString();
    const downloadList = generateDownloadList();
    const preamble = getDownloadPreamble();
    const postamble = getDownloadPostamble();
    const downloadDocument = preamble + downloadList + postamble;

    downloadFile(`bandcamp_${date}.txt`, downloadDocument);
  });
}

export function disableButton(button: HTMLButtonElement | undefined, log: Logger): void {
  if (!button) return;

  log.info('disableButton()');

  button.disabled = true;
  button.textContent = 'preparing download';
}

export function enableZipButton(button: HTMLButtonElement | undefined, log: Logger): void {
  if (!button) return;

  log.info('enableZipButton()');

  button.disabled = false;
  button.textContent = 'Download ZIP';

  button.addEventListener('click', async function () {
    await downloadAsZip(log);
  });
}

export function disableZipButton(button: HTMLButtonElement | undefined, log: Logger): void {
  if (!button) return;

  log.info('disableZipButton()');

  button.disabled = true;
  button.textContent = 'preparing download';
}

export async function initDownload(): Promise<void> {
  const log = new Logger();

  log.info('Initiating BES Download Helper');

  const curlButton = createButton(log);
  const zipButton = createZipButton(log);
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
          zipChunks = new Array(message.totalChunks);
          expectedChunks = message.totalChunks;
          zipFilename = message.filename;
          log.info(`Receiving zip in ${expectedChunks} chunks`);

          updatePersistentNotification('bes-download-progress', `Receiving zip file... (chunk 1/${expectedChunks})`);
        }

        zipChunks[message.chunkIndex] = message.data;
        log.info(`Received chunk ${message.chunkIndex + 1}/${expectedChunks}`);

        updatePersistentNotification(
          'bes-download-progress',
          `Receiving zip file... (chunk ${message.chunkIndex + 1}/${expectedChunks})`
        );

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
            console.error('Error assembling zip file:', error);
            if (error instanceof Error) {
              console.error('Error name:', error.name);
              console.error('Error message:', error.message);
              console.error('Error stack:', error.stack);
            }
            log.error('Assembly failed - check console for details');
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
    log.error('Error connecting to background script:', error);
    showErrorMessage('Failed to connect to background script for downloading');
  }
}
