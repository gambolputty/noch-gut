import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import InfiniteScroll from "react-infinite-scroll-component";
import {
  calculateValidExpiryRange,
  formatProtocolDayHeader,
  loadProducts,
  loadRatings,
  type ProtocolDay,
  ProtocolGenerator,
  RecencyTracker,
  shuffle,
} from "noch-gut-bot";

import { Lightbox } from "./Lightbox";

type DisplayEntry = {
  id: number;
  text: string;
  imageUrl: string | null;
};

type DisplayDay = {
  id: number;
  date: Date;
  header: string;
  entries: DisplayEntry[];
};

export function EntryList() {
  const [days, setDays] = useState<DisplayDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const generatorRef = useRef<ProtocolGenerator | null>(null);
  const dayIdRef = useRef(0);
  const entryIdRef = useRef(0);
  const lastDateRef = useRef<Date | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const productsUrl = new URL(
        "noch-gut-bot/assets/products.csv",
        import.meta.url,
      );
      const ratingsUrl = new URL(
        "noch-gut-bot/assets/ratings.csv",
        import.meta.url,
      );
      const [loadedProducts, loadedRatings] = await Promise.all([
        loadProducts(productsUrl),
        loadRatings(ratingsUrl),
      ]);

      const dateRange = calculateValidExpiryRange(2006, 3);
      const recencyTracker = new RecencyTracker();

      generatorRef.current = new ProtocolGenerator({
        products: shuffle(loadedProducts),
        ratings: loadedRatings,
        dateRange,
        protocolStartDate: new Date(2016, 0, 1),
        protocolEndDate: new Date(),
        activeDayRatio: 0.15,
        entriesPerDay: { min: 1, max: 4, weights: [40, 35, 20, 5] },
        sortOrder: "desc", // newest first
        minMonthsAfterExpiry: 3,
        italic: false,
        recencyTracker,
      });

      setLoading(false);
    };
    loadData();
  }, []);

  const convertDay = useCallback((day: ProtocolDay): DisplayDay => {
    return {
      id: dayIdRef.current++,
      date: day.date,
      header: formatProtocolDayHeader(day.date),
      entries: day.entries.map((entry) => ({
        id: entryIdRef.current++,
        text: entry.text,
        imageUrl: entry.product.imageUrl,
      })),
    };
  }, []);

  const loadMore = useCallback(() => {
    if (!generatorRef.current) return;

    const newDays = generatorRef.current.generateDays(5, lastDateRef.current ?? undefined);
    if (newDays.length > 0) {
      lastDateRef.current = newDays[newDays.length - 1].date;
      setDays((prev) => [...prev, ...newDays.map(convertDay)]);
    }
  }, [convertDay]);

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
        dataLength={days.length}
        next={loadMore}
        hasMore={true}
        loader={<p class="more">...</p>}
        scrollThreshold={0.8}
        style={{ overflow: "visible" }}
      >
        <div class="protocol">
          {days.map((day) => (
            <div key={day.id} class="protocol-day">
              <h2 class="day-header">{day.header}</h2>
              <ul class="entries">
                {day.entries.map((entry) => (
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
                          (e.target as HTMLImageElement).dataset.loaded =
                            "true";
                        }}
                      />
                    )}
                    {entry.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
