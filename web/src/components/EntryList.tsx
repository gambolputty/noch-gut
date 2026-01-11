import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import InfiniteScroll from "react-infinite-scroll-component";
import { EntryImage } from "./ImageWithSkeleton";
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

type DisplayEntry = {
  id: number;
  text: string;
  imageUrl: string | null;
  showImage: boolean;
};

type DisplayDay = {
  id: number;
  date: Date;
  header: string;
  entries: DisplayEntry[];
};

// Show an image roughly every N entries, but max one per day
const IMAGE_FREQUENCY = 8;

export function EntryList() {
  const [days, setDays] = useState<DisplayDay[]>([]);
  const [loading, setLoading] = useState(true);
  const generatorRef = useRef<ProtocolGenerator | null>(null);
  const dayIdRef = useRef(0);
  const entryIdRef = useRef(0);
  const globalEntryCountRef = useRef(0);
  const lastDateRef = useRef<Date | null>(null);

  useEffect(() => {
    const loadData = async () => {
      // Use sampled products from public folder (1/3 of full dataset)
      const productsUrl = new URL("/products.csv", window.location.origin);
      const ratingsUrl = new URL(
        "noch-gut-bot/assets/ratings.csv",
        import.meta.url
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
        protocolStartDate: new Date(2008, 0, 1),
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
    let dayHasImage = false;

    return {
      id: dayIdRef.current++,
      date: day.date,
      header: formatProtocolDayHeader(day.date),
      entries: day.entries.map((entry) => {
        const globalIndex = globalEntryCountRef.current++;
        const hasImage = entry.product.imageUrl !== null;

        // Show image if: it's time for one, day doesn't have one yet, and entry has an image
        const showImage =
          !dayHasImage &&
          hasImage &&
          globalIndex > 0 &&
          globalIndex % IMAGE_FREQUENCY === 0;

        if (showImage) {
          dayHasImage = true;
        }

        return {
          id: entryIdRef.current++,
          text: entry.text,
          imageUrl: entry.product.imageUrl,
          showImage,
        };
      }),
    };
  }, []);

  const loadMore = useCallback(() => {
    if (!generatorRef.current) return;

    const newDays = generatorRef.current.generateDays(
      5,
      lastDateRef.current ?? undefined
    );
    if (newDays.length > 0) {
      lastDateRef.current = newDays[newDays.length - 1].date;
      setDays((prev) => [...prev, ...newDays.map(convertDay)]);
    }
  }, [convertDay]);

  useEffect(() => {
    if (!loading && generatorRef.current) {
      // Load more initial days to fill the viewport
      const initialDays = generatorRef.current.generateDays(20);
      if (initialDays.length > 0) {
        lastDateRef.current = initialDays[initialDays.length - 1].date;
        setDays(initialDays.map(convertDay));
      }
    }
  }, [loading, convertDay]);

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
                  <li
                    key={entry.id}
                    class={entry.showImage ? "entry entry-featured" : "entry"}
                  >
                    {entry.showImage && entry.imageUrl && (
                      <EntryImage src={entry.imageUrl} />
                    )}
                    <span class="entry-text">{entry.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </InfiniteScroll>
    </>
  );
}
