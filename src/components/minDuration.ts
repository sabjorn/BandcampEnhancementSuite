export const MIN_SPINNER_MS = 250;

export function withMinDuration<T>(promise: Promise<T>, ms: number = MIN_SPINNER_MS): Promise<T> {
  const elapsed = new Promise<void>(resolve => setTimeout(resolve, ms));
  const settled = promise.then(
    result => () => result,
    error => () => {
      throw error;
    }
  );

  return Promise.all([settled, elapsed]).then(([outcome]) => outcome());
}
