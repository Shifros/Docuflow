export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      text.startsWith("<!")
        ? `Server error (${response.status}). Check the API route logs.`
        : text || `Request failed (${response.status})`,
    );
  }

  return response.json() as Promise<T>;
}
