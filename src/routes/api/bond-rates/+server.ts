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
 * Search terms used to find Danish mortgage bonds (MORTGAGE_BONDS asset class) on Nasdaq Copenhagen.
 * Short abbreviations are used because they match bond symbol names that carry the
 * MORTGAGE_BONDS asset class; full company names would instead return bonds in the
 * "Others" group (assetClass=""), which have no price data available.
 *
 * Coverage:
 *  - "SDRO"  → Nordea Kredit (NDASDRO) + Realkredit Danmark (RDSDRO)
 *  - "NYK"   → Nykredit Realkredit
 *  - "BRF"   → BRFkredit
 *  - "DLR"   → DLR Kredit
 */
const SEARCH_TERMS = ["SDRO", "NYK", "BRF", "DLR"];

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
          instruments: Array<{
            orderbookId: string;
            fullName: string;
            isin: string;
            assetClass: string;
          }>;
        }> | null;
      } = await res.json();
      if (!data.data) continue;

      for (const group of data.data) {
        for (const inst of group.instruments) {
          // Only include bonds that have price data available on Nasdaq Nordic.
          // Bonds with assetClass="" ("Others" group) are OTC-listed and cannot be
          // queried for prices via the API.
          if (inst.assetClass !== "MORTGAGE_BONDS") continue;
          // Skip market-maker (BB) and tap-offering (TAP) variants; the primary
          // listing already represents the same ISIN and has the same price.
          if (inst.fullName.endsWith(" BB") || inst.fullName.endsWith(" TAP")) continue;
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
 * Try to get the current bond rate for a mortgage bond from the Nasdaq Nordic chart endpoint.
 * Returns null if the market is closed or data is unavailable.
 *
 * The chart endpoint returns `chartData.lastSalePrice` in the format "DKK 96.475".
 * The summary endpoint (`/summary?assetClass=BONDS`) always returns `data: null` for
 * mortgage bonds; the chart endpoint with `assetClass=MORTGAGE_BONDS` is the correct one.
 */
async function fetchBondRate(fetchFn: typeof fetch, orderbookId: string): Promise<number | null> {
  try {
    const res = await fetchFn(
      `${NASDAQ_API}/instruments/${orderbookId}/chart?assetClass=MORTGAGE_BONDS`,
      { headers: NASDAQ_HEADERS },
    );
    if (!res.ok) return null;

    const data: {
      data: { chartData: { lastSalePrice?: string } | null } | null;
    } = await res.json();

    const lastSalePrice = data?.data?.chartData?.lastSalePrice;
    if (!lastSalePrice) return null;

    // Format is "DKK 96.475" — take the last whitespace-delimited token.
    const priceStr = lastSalePrice.split(" ").at(-1) ?? "";
    const parsed = parseFloat(priceStr);
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
