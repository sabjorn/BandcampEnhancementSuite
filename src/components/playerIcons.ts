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
