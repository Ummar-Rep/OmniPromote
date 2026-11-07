"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-fetches the page every few seconds so new chat messages appear.
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
