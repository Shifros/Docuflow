export function normalizeName(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function matchByName<T extends { name: string }>(
  query: string,
  candidates: T[],
): T | null {
  const normalizedQuery = normalizeName(query);
  if (!normalizedQuery) return null;

  const exact = candidates.find(
    (candidate) => normalizeName(candidate.name) === normalizedQuery,
  );
  if (exact) return exact;

  const partial = candidates.find((candidate) => {
    const normalizedCandidate = normalizeName(candidate.name);
    return (
      normalizedCandidate.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedCandidate)
    );
  });

  return partial ?? null;
}
