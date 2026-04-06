import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const prerender = true;

export interface BondInfo {
  orderbookId: string;
  name: string;
  isin: string;
  /** Current bond rate (market price per 100 DKK face value), or null if not available. */
  bondRate: number | null;
}

export interface BondRatesResponse {
  bonds: BondInfo[];
  /** ISO 8601 timestamp of when this data was fetched (build time). */
  fetchedAt: string;
}

/**
 * Search terms used to find Danish mortgage bonds on Nasdaq Copenhagen.
 * We search for the main issuers of Danish realkredit bonds.
 */
const SEARCH_TERMS = ["Realkredit Danmark", "Nykredit", "BRFkredit", "DLR", "Nordea Kredit"];

/** Common browser-like request headers required by the Nasdaq Nordic API. */
const NASDAQ_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; extraordinary-mortgage-calculator/1.0)",
};

/** Base URL for the Nasdaq Nordic API. */
const NASDAQ_API = "https://api.nasdaq.com/api/nordic";

/**
 * Fetch a list of Danish mortgage bonds from Nasdaq Nordic.
 * Runs server-side at build time (prerendered), so CORS is not an issue.
 */
async function fetchBonds(fetchFn: typeof fetch): Promise<BondInfo[]> {
  const seen = new Set<string>();
  const bonds: BondInfo[] = [];

  for (const term of SEARCH_TERMS) {
    try {
      const res = await fetchFn(`${NASDAQ_API}/search?searchText=${encodeURIComponent(term)}`, {
        headers: NASDAQ_HEADERS,
      });
      if (!res.ok) continue;

      const data: {
        data: Array<{
          instruments: Array<{ orderbookId: string; fullName: string; isin: string }>;
        }> | null;
      } = await res.json();
      if (!data.data) continue;

      for (const group of data.data) {
        for (const inst of group.instruments) {
          if (seen.has(inst.orderbookId)) continue;
          seen.add(inst.orderbookId);
          bonds.push({
            orderbookId: inst.orderbookId,
            name: inst.fullName,
            isin: inst.isin,
            bondRate: null,
          });
        }
      }
    } catch {
      // Skip failed searches silently
    }
  }

  return bonds;
}

/**
 * Try to get the current bond rate for a bond from the Nasdaq Nordic summary endpoint.
 * Returns null if the market is closed or data is unavailable.
 */
async function fetchBondRate(fetchFn: typeof fetch, orderbookId: string): Promise<number | null> {
  try {
    const res = await fetchFn(`${NASDAQ_API}/instruments/${orderbookId}/summary?assetClass=BONDS`, {
      headers: NASDAQ_HEADERS,
    });
    if (!res.ok) return null;

    const data: { data: { lastPrice?: string | number } | null } = await res.json();
    if (!data.data) return null;

    const raw = data.data.lastPrice;
    if (raw == null) return null;
    const parsed = typeof raw === "string" ? parseFloat(raw) : raw;
    return isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async ({ fetch }) => {
  const fetchedAt = new Date().toISOString();

  const bonds = await fetchBonds(fetch);

  // Fetch bond rate for each bond in parallel (best-effort; null when market is closed)
  await Promise.all(
    bonds.map(async (bond) => {
      bond.bondRate = await fetchBondRate(fetch, bond.orderbookId);
    }),
  );

  const response: BondRatesResponse = { bonds, fetchedAt };
  return json(response);
};
