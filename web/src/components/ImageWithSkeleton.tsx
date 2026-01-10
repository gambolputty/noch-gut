import { useState } from "preact/hooks";

type EntryImageProps = {
  src: string;
  alt?: string;
};

export function EntryImage({ src, alt = "" }: EntryImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return null;
  }

  return (
    <div class={`entry-image-wrapper ${loaded ? "" : "loading"}`}>
      <img
        src={src}
        alt={alt}
        class={`entry-image ${loaded ? "loaded" : ""}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
}
