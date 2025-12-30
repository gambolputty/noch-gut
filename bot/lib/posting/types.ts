export interface PostResult {
  url: string;
}

export interface PostOptions {
  imageUrl?: string;
  imageAlt?: string;
}

export interface Poster {
  name: string;
  post(text: string, options?: PostOptions): Promise<PostResult>;
}
