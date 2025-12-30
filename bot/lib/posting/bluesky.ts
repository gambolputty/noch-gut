import { type AppBskyEmbedImages,AtpAgent } from "@atproto/api";

import { fetchImageAsBuffer } from "./image-fetcher";
import type { Poster, PostOptions, PostResult } from "./types";

export const createBlueskyPoster = (): Poster => {
  const createAgent = async () => {
    const agent = new AtpAgent({
      service: process.env.BLUESKY_SERVICE || "https://bsky.social",
    });

    await agent.login({
      identifier: process.env.BLUESKY_IDENTIFIER!,
      password: process.env.BLUESKY_PASSWORD!,
    });

    return agent;
  };

  return {
    name: "Bluesky",
    async post(text: string, options?: PostOptions): Promise<PostResult> {
      const agent = await createAgent();

      let embed: AppBskyEmbedImages.Main | undefined;

      if (options?.imageUrl) {
        const imageData = await fetchImageAsBuffer(options.imageUrl);
        if (imageData) {
          const uploadResponse = await agent.uploadBlob(imageData.buffer, {
            encoding: imageData.mimeType,
          });

          embed = {
            $type: "app.bsky.embed.images",
            images: [
              {
                image: uploadResponse.data.blob,
                alt: options.imageAlt || "Produktbild",
              },
            ],
          };
        }
      }

      const response = await agent.post({
        text,
        createdAt: new Date().toISOString(),
        ...(embed && { embed }),
      });
      return { url: response.uri };
    },
  };
};
