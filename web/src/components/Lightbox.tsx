import { useEffect, useState } from "preact/hooks";

type LightboxProps = {
  src: string;
  onClose: () => void;
};

export function Lightbox({ src, onClose }: LightboxProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    setLoaded(false);
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.src = src;
  }, [src]);

  return (
    <div class="lightbox" onClick={onClose}>
      {!loaded && <div class="lightbox-spinner" />}
      {loaded && <img src={src} alt="" />}
    </div>
  );
}
