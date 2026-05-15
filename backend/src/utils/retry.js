/**
 * Retries an async operation with a fixed delay.
 *
 * @template T
 * @param {() => Promise<T>} operation async operation to execute.
 * @param {{ retries?: number, delayMs?: number, shouldRetry?: (error: Error) => boolean }} options retry settings.
 * @returns {Promise<T>}
 */
export async function retry(operation, options = {}) {
  const { retries = 3, delayMs = 2000, shouldRetry = () => true } = options;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(error)) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
