// Fetch rows whose ID column is in a large array. Chunks input IDs to avoid
// PostgREST URL-length truncation, and paginates per chunk via .range() to
// bypass the 1000-row response cap.
export async function fetchInChunks<T>(
  ids: string[],
  chunkSize: number,
  fetcher: (chunk: string[], from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  if (!ids.length) return [];
  const out: T[] = [];
  const PAGE = 1000;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    let from = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data } = await fetcher(chunk, from, from + PAGE - 1);
      const rows = data || [];
      out.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
  }
  return out;
}
