/**
 * Fetch image from URL and return as Buffer.
 * Used by posting services to upload images.
 */
export async function fetchImageAsBuffer(url: string): Promise<{
  buffer: Buffer;
  mimeType: string;
} | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Failed to fetch image: ${response.status} ${url}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();

    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: contentType,
    };
  } catch (error) {
    console.warn(`Error fetching image: ${error}`);
    return null;
  }
}
