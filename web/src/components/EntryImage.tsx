import { useState } from "preact/hooks";

type EntryImageProps = {
  src: string;
  alt?: string;
  class?: string;
};

export function EntryImage({
  src,
  alt = "",
  class: className = "",
}: EntryImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      class={`entry-image ${className} ${loaded ? "image-loaded" : "image-loading"}`}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}
