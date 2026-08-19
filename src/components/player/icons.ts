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

export function heartIcon(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.5l-1.2-1.08C6.24 15.3 3.5 12.83 3.5 9.78 3.5 7.3 5.46 5.35 7.95 5.35c1.4 0 2.75.65 3.62 1.68l.43.5.43-.5a4.77 4.77 0 0 1 3.62-1.68c2.49 0 4.45 1.95 4.45 4.43 0 3.05-2.74 5.52-7.3 9.65z"></path></svg>`;
}

export function playedIcon(size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a8 8 0 0 0-8 8v6a2.5 2.5 0 0 0 2.5 2.5H8V13H5.5v-2a6.5 6.5 0 0 1 13 0v2H16v6.5h1.5A2.5 2.5 0 0 0 20 17v-6a8 8 0 0 0-8-8z"></path></svg>`;
}
