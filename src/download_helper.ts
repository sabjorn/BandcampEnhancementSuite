import Logger from './logger';
import { downloadFile, dateString } from './utilities';

export function mutationCallback(button: HTMLButtonElement | undefined, log: Logger): void {
  const allDownloadLinks = document.querySelectorAll('.download-title .item-button');

  const linksReady = [...allDownloadLinks].every(element => (element as HTMLElement).style.display !== 'none');

  log.info(`linksReady: ${linksReady}`);
  if (linksReady) {
    enableButton(button, log);
    return;
  }

  disableButton(button, log);
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

export async function initDownloadHelper(): Promise<void> {
  const log = new Logger();

  log.info('Initiating BES Download Helper');

  const button = createButton(log);

  const callback = () => mutationCallback(button, log);
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
