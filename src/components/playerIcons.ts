export function prevIcon(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"></path></svg>`;
}

export function nextIcon(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z"></path></svg>`;
}

export function playIcon(size: number): string {
  return `<svg class="bes-play-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"></path></svg>`;
}

export function pauseIcon(size: number): string {
  return `<svg class="bes-pause-icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"></rect><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"></rect></svg>`;
}

const speakerBody = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none"></polygon>';

const strokedIcon = (size: number, contents: string): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contents}</svg>`;

export function volumeIcon(size: number): string {
  return strokedIcon(
    size,
    `${speakerBody}<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>`
  );
}

export function mutedVolumeIcon(size: number): string {
  return strokedIcon(
    size,
    `${speakerBody}<line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`
  );
}

export function minimizeIcon(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="2" rx="1" fill="currentColor"></rect></svg>`;
}

export function closeIcon(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18 M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"></path></svg>`;
}
