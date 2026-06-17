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

const log = new Logger();

export function mutationCallback(
  buttons: {
    curl?: HTMLAnchorElement & { disable: () => void; enable: () => void };
    zip?: HTMLAnchorElement & { disable: () => void; enable: () => void };
  },
  statusElement: HTMLElement | undefined
): void {
  const allDownloadLinks = document.querySelectorAll('.download-title .item-button');

  const linksReady = [...allDownloadLinks].every(element => (element as HTMLElement).style.display !== 'none');

  log.info(`linksReady: ${linksReady}`);
  if (linksReady) {
    buttons.curl?.enable();
    buttons.zip?.enable();
    if (statusElement) statusElement.style.display = 'none';
    return;
  }

  buttons.curl?.disable();
  buttons.zip?.disable();
  if (statusElement) statusElement.style.display = 'block';
}

export function createCurlButton(): (HTMLAnchorElement & { disable: () => void; enable: () => void }) | undefined {
  const downloadTitlesLocation = document.querySelector('div.download-titles');
  if (!downloadTitlesLocation) {
    log.warn('Cannot create download button: div.download-titles element not found');
    return undefined;
  }

  const curlDownloadButton = createButton({
    className: 'bes-downloadall',
    innerText: 'Download cURL File',
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

export function createZipDownloadButton():
  | (HTMLAnchorElement & { disable: () => void; enable: () => void })
  | undefined {
  const downloadTitlesLocation = document.querySelector('div.download-titles');
  if (!downloadTitlesLocation) {
    log.warn('Cannot create download all button: div.download-titles element not found');
    return undefined;
  }

  const downloadAllButton = createButton({
    className: 'bes-downloadall-files',
    innerText: 'Download All Files',
    buttonClicked: downloadAllFiles
  });

  downloadAllButton.title = 'Downloads all files to a folder of your choice';
  downloadAllButton.style.marginLeft = '10px';
  downloadAllButton.disable();

  downloadTitlesLocation.append(downloadAllButton);
  return downloadAllButton;
}

export function createStatusElement(): HTMLElement | undefined {
  const downloadTitlesLocation = document.querySelector('div.download-titles');
  if (!downloadTitlesLocation) {
    log.warn('Cannot create status element: div.download-titles element not found');
    return undefined;
  }

  const statusElement = document.createElement('div');
  statusElement.className = 'bes-download-status';
  statusElement.textContent = 'preparing download';
  statusElement.setAttribute('disabled', 'true');
  statusElement.style.display = 'none';
  statusElement.style.marginBottom = '10px';
  statusElement.style.marginTop = '10px';
  statusElement.style.fontSize = '13px';
  statusElement.style.color = '#666';

  downloadTitlesLocation.appendChild(statusElement);
  return statusElement;
}

export async function initDownload(): Promise<void> {
  log.info('Initiating BES Download Helper');

  const statusElement = createStatusElement();
  const curlButton = createCurlButton();
  const zipButton = createZipDownloadButton();
  const buttons = { curl: curlButton, zip: zipButton };

  const callback = () => mutationCallback(buttons, statusElement);
  const observer = new MutationObserver(callback);

  callback();

  const config = { attributes: true, attributeFilter: ['href'] };
  const targetNodes = document.querySelectorAll('.download-title .item-button');

  for (const node of targetNodes) {
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

async function selectDownloadDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) {
    log.info('File System Access API not available, using default downloads folder');
    return null;
  }

  try {
    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'downloads'
    });
    return dirHandle;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      log.info('User cancelled directory selection');
      return null;
    }
    throw error;
  }
}

async function writeFileToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  data: ArrayBuffer
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
  log.info(`Wrote ${filename} to directory`);
}

async function downloadFileViaAnchor(filename: string, data: ArrayBuffer): Promise<void> {
  const blob = new Blob([data]);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  log.info(`Downloaded ${filename} via anchor`);
}

export async function downloadAllFiles(): Promise<void> {
  const urls = [...document.querySelectorAll('.download-title .item-button')]
    .map(item => item.getAttribute('href'))
    .filter((url): url is string => url !== null);

  if (urls.length === 0) {
    showErrorMessage('No download links found');
    return;
  }

  log.info(`Starting download of ${urls.length} files`);

  const dirHandle = await selectDownloadDirectory();
  if (dirHandle === null && 'showDirectoryPicker' in window) {
    return;
  }

  showPersistentNotification({
    id: 'bes-download-progress',
    message: `Downloading 0 of ${urls.length} files...`,
    type: 'info'
  });

  try {
    const port = chrome.runtime.connect({ name: 'bes' });
    let completed = 0;
    let failed = 0;

    port.onMessage.addListener(async message => {
      if (message.type === 'fileDownloaded') {
        const { filename, data } = message;

        try {
          if (dirHandle) {
            await writeFileToDirectory(dirHandle, filename, data);
          } else {
            await downloadFileViaAnchor(filename, data);
          }
          completed++;
          updatePersistentNotification('bes-download-progress', `Downloaded ${completed} of ${urls.length} files...`);
        } catch (error) {
          log.error(`Failed to save ${filename}: ${error}`);
          failed++;
        }
      }

      if (message.type === 'downloadComplete') {
        port.disconnect();
        removePersistentNotification('bes-download-progress');

        if (message.success) {
          const failedCount = failed > 0 ? ` (${failed} failed)` : '';
          showSuccessMessage(`Successfully downloaded ${completed} of ${urls.length} files${failedCount}`);
        } else {
          showErrorMessage(message.message || 'Download failed');
        }
      }
    });

    port.postMessage({
      type: 'downloadFiles',
      urls
    });
  } catch (error) {
    log.error(`Error during download: ${error}`);
    removePersistentNotification('bes-download-progress');
    showErrorMessage('Download failed. Check console for details.');
  }
}
