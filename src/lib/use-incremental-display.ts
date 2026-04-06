"use client";

import { useEffect, useState } from "react";

interface IncrementalDisplayOptions {
  initialCount?: number;
  step?: number;
  resetKey?: string;
}

export function useIncrementalDisplay<T>(
  items: T[],
  options: IncrementalDisplayOptions = {},
) {
  const initialCount = options.initialCount ?? 20;
  const step = options.step ?? initialCount;
  const resetKey = options.resetKey ?? "";

  const [visibleCount, setVisibleCount] = useState(initialCount);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount, resetKey]);

  const totalCount = items.length;
  const hasMore = visibleCount < totalCount;
  const visibleItems = items.slice(0, visibleCount);

  const loadMore = () => {
    setVisibleCount((current) => Math.min(current + step, totalCount));
  };

  return {
    visibleItems,
    visibleCount,
    totalCount,
    hasMore,
    loadMore,
  };
}
