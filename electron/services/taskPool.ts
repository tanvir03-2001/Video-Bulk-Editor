export async function runTaskPool<T>(
  total: number,
  concurrency: number,
  worker: (index: number) => Promise<T>,
): Promise<T[]> {
  if (total <= 0) {
    return [];
  }

  const results = new Array<T>(total);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, total)) }, async () => {
    while (nextIndex < total) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(index);
    }
  });

  await Promise.all(runners);
  return results;
}
