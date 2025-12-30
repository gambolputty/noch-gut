import { createRestAPIClient } from "masto";

import { fetchImageAsBuffer } from "./image-fetcher";
import type { Poster, PostOptions, PostResult } from "./types";

export const createMastodonPoster = (): Poster => {
  const createClient = () =>
    createRestAPIClient({
      url: process.env.MASTODON_API_BASE_URL!,
      accessToken: process.env.MASTODON_ACCESS_TOKEN!,
    });

  return {
    name: "Mastodon",
    async post(text: string, options?: PostOptions): Promise<PostResult> {
      const client = createClient();

      let mediaIds: string[] | undefined;

      if (options?.imageUrl) {
        const imageData = await fetchImageAsBuffer(options.imageUrl);
        if (imageData) {
          const media = await client.v1.media.create({
            file: new Blob([new Uint8Array(imageData.buffer)], { type: imageData.mimeType }),
            description: options.imageAlt || "Produktbild",
          });
          mediaIds = [media.id];
        }
      }

      const status = await client.v1.statuses.create({
        status: text,
        visibility: "public",
        ...(mediaIds && { mediaIds }),
      });
      return { url: status.url ?? status.uri };
    },
  };
};
