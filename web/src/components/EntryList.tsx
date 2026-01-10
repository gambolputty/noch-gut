import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  calculateValidExpiryRange,
  loadProducts,
  loadRatings,
  RecencyTracker,
  shuffle,
  StandardEntryGenerator,
} from "noch-gut-bot";

import { Lightbox } from "./Lightbox";

type DisplayEntry = {
  id: number;
  text: string;
  imageUrl: string | null;
};

export function EntryList() {
  const [entries, setEntries] = useState<DisplayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const generatorRef = useRef<StandardEntryGenerator | null>(null);
  const entryIdRef = useRef(0);

  useEffect(() => {
    const loadData = async () => {
      const productsUrl = new URL("noch-gut-bot/assets/products.csv", import.meta.url);
      const ratingsUrl = new URL("noch-gut-bot/assets/ratings.csv", import.meta.url);
      const [loadedProducts, loadedRatings] = await Promise.all([
        loadProducts(productsUrl),
        loadRatings(ratingsUrl),
      ]);

      const dateRange = calculateValidExpiryRange(2006, 3);
      const recencyTracker = new RecencyTracker();

      generatorRef.current = new StandardEntryGenerator({
        products: shuffle(loadedProducts),
        ratings: loadedRatings,
        dateRange,
        minMonthsAfterExpiry: 3,
        italic: false,
        recencyTracker,
      });

      setLoading(false);
    };
    loadData();
  }, []);

  const generateEntry = useCallback((): DisplayEntry | null => {
    if (!generatorRef.current) return null;

    const entry = generatorRef.current.generate();
    if (!entry) return null;

    return {
      id: entryIdRef.current++,
      text: entry.text,
      imageUrl: entry.product.imageUrl,
    };
  }, []);

  const loadMore = useCallback(() => {
    const newEntries: DisplayEntry[] = [];
    for (let i = 0; i < 10; i++) {
      const entry = generateEntry();
      if (entry) newEntries.push(entry);
    }
    setEntries((prev) => [...prev, ...newEntries]);
  }, [generateEntry]);

  useEffect(() => {
    if (!loading && generatorRef.current) {
      loadMore();
    }
  }, [loading, loadMore]);

  if (loading) {
    return <p style={{ color: "#999" }}>...</p>;
  }

  return (
    <>
      {/* @ts-ignore - React component works with Preact compat */}
      <InfiniteScroll
        dataLength={entries.length}
        next={loadMore}
        hasMore={true}
        loader={<p class="more">...</p>}
        scrollThreshold={0.8}
        style={{ overflow: "visible" }}
      >
        <ul class="entries">
          {entries.map((entry) => (
            <li key={entry.id} class="entry">
              {entry.imageUrl && (
                <img
                  class="entry-thumb"
                  src={entry.imageUrl.replace(".400.", ".100.")}
                  alt=""
                  loading="lazy"
                  onClick={() => setLightboxImage(entry.imageUrl)}
                  onMouseEnter={() => {
                    const img = new Image();
                    img.src = entry.imageUrl!;
                  }}
                  onLoad={(e) => {
                    (e.target as HTMLImageElement).dataset.loaded = "true";
                  }}
                />
              )}
              {entry.text}
            </li>
          ))}
        </ul>
      </InfiniteScroll>

      {lightboxImage && (
        <Lightbox
          src={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </>
  );
}
