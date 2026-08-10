import { schema, OutputType } from "./optimize-route_POST.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";

const DEFAULT_Lager_ADDRESS = "Am Hartholz 3, 82239 Alling";

// --- Geocoding ---

const COORDS_PREFIX = "COORDS:";

/**
 * Attempts to parse a German address string into structured components.
 * Handles formats like "Straße 5, 82239 Alling" or "Straße 5, Alling 82239".
 * Returns null if the address cannot be confidently parsed.
 */
function parseGermanAddress(
  address: string
): { street: string; postalcode: string; city: string } | null {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length < 2) return null;

  const street = parts[0];
  // Join remaining parts in case city itself contains a comma
  const locationPart = parts.slice(1).join(", ").trim();

  // Match "82239 Alling" or "Alling 82239"
  const plzCityMatch = locationPart.match(/^(\d{5})\s+(.+)$/);
  if (plzCityMatch) {
    return { street, postalcode: plzCityMatch[1], city: plzCityMatch[2].trim() };
  }

  const cityPlzMatch = locationPart.match(/^(.+?)\s+(\d{5})$/);
  if (cityPlzMatch) {
    return { street, postalcode: cityPlzMatch[2], city: cityPlzMatch[1].trim() };
  }

  return null;
}

/**
 * Fetches a URL with exponential backoff retries on 429 (Too Many Requests) responses.
 * On non-429 failures the response is returned as-is for the caller to handle.
 *
 * @param url - The URL to fetch.
 * @param options - Standard fetch RequestInit options.
 * @param maxRetries - Maximum number of total attempts (default: 3).
 * @param initialDelay - Delay in ms before the first retry on 429 (default: 1500ms). Subsequent retries double this.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelay = 1500
): Promise<Response> {
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status !== 429) {
      // Return immediately for any non-429 response (success or other error)
      return res;
    }

    if (attempt === maxRetries) {
      console.log(
        `fetchWithRetry: received 429 on attempt ${attempt}/${maxRetries} for "${url}". No more retries.`
      );
      return res;
    }

    console.log(
      `fetchWithRetry: received 429 on attempt ${attempt}/${maxRetries} for "${url}". Waiting ${delay}ms before retry...`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2; // Exponential backoff
  }

  // TypeScript requires a return path here; unreachable in practice
  throw new Error("fetchWithRetry: exhausted all retries");
}

async function geocodeAddress(address: string): Promise<string> {
  // Handle pre-supplied GPS coordinates to skip Nominatim entirely.
  // Format: "COORDS:<lat>,<lon>" → returns "<lon>,<lat>" (OSRM lon,lat order).
  if (address.startsWith(COORDS_PREFIX)) {
    const coordsPart = address.slice(COORDS_PREFIX.length);
    const parts = coordsPart.split(",");
    if (parts.length !== 2) {
      throw new Error(`Invalid COORDS format (expected "COORDS:<lat>,<lon>"): ${address}`);
    }
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(`Invalid numeric coordinates in "${address}"`);
    }
    console.log(`Using pre-supplied coordinates for "${address}": lon=${lon}, lat=${lat}`);
    return `${lon},${lat}`;
  }

  const nominatimOptions: RequestInit = {
    headers: { "User-Agent": "Biber-Fieber-Delivery/1.0" },
  };

  // --- Strategy 1: Structured Nominatim query for German addresses ---
  const parsed = parseGermanAddress(address);
  if (parsed) {
    const structuredUrl =
      `https://nominatim.openstreetmap.org/search?` +
      `street=${encodeURIComponent(parsed.street)}` +
      `&postalcode=${encodeURIComponent(parsed.postalcode)}` +
      `&city=${encodeURIComponent(parsed.city)}` +
      `&country=de&format=json&limit=1`;

    const structuredRes = await fetchWithRetry(structuredUrl, nominatimOptions);

    if (structuredRes.status === 429) {
      // Rate-limited even after retries: wait 1500ms before falling back to free-form
      console.log(
        `Structured geocoding rate-limited (429) for "${address}" after all retries. Waiting 1500ms before free-form fallback.`
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } else if (structuredRes.ok) {
      const structuredData = (await structuredRes.json()) as { lon: string; lat: string }[];
      if (structuredData && structuredData.length > 0) {
        const coord = `${structuredData[0].lon},${structuredData[0].lat}`;
        console.log(`Geocoded (structured) "${address}" → ${coord}`);
        return coord;
      }
      console.log(
        `Structured geocoding returned no results for "${address}", falling back to free-form query.`
      );
    } else {
      console.log(
        `Structured geocoding request failed for "${address}" (status ${structuredRes.status}), falling back to free-form query.`
      );
    }
  }

  // --- Strategy 2: Free-form Nominatim query with Deutschland suffix ---
  const freeFormAddress = address.toLowerCase().includes("deutschland")
    ? address
    : `${address}, Deutschland`;

  const freeFormUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    freeFormAddress
  )}&format=json&limit=1&countrycodes=de`;

  // Use fetchWithRetry with up to 3 attempts and 2000ms initial delay (doubles to 4000ms on 3rd)
  const res = await fetchWithRetry(freeFormUrl, nominatimOptions, 3, 2000);

  if (!res.ok) {
    throw new Error(
      `Geocoding request failed for address: ${address} (status ${res.status})`
    );
  }

  const data = (await res.json()) as { lon: string; lat: string }[];
  if (!data || data.length === 0) {
    throw new Error(`Address not found: ${address}`);
  }

  const coord = `${data[0].lon},${data[0].lat}`;
  console.log(`Geocoded (free-form) "${address}" → ${coord}`);
  return coord;
}

async function geocodeAllAddresses(addresses: string[]): Promise<string[]> {
  const coords: string[] = [];
  for (let i = 0; i < addresses.length; i++) {
    const coord = await geocodeAddress(addresses[i]);
    coords.push(coord);
    // Respect Nominatim's 1 request/second rate limit with an extra safety margin
    if (i < addresses.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }
  return coords;
}

// --- OSRM Table API (distance matrix) ---

async function getDistanceMatrix(coords: string[]): Promise<number[][]> {
  const coordsString = coords.join(";");
  const url = `https://router.project-osrm.org/table/v1/driving/${coordsString}?annotations=distance`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch distance matrix from OSRM Table API");
  }

  const data = (await res.json()) as {
    code: string;
    distances?: number[][];
    message?: string;
  };
  if (data.code !== "Ok" || !data.distances) {
    throw new Error(
      `Invalid response from OSRM Table API: ${data.message ?? "Unknown error"}`
    );
  }

  return data.distances;
}

// --- Nearest-Neighbor + 2-opt TSP heuristic ---
// Layout: index 0 = start (depot), indices 1..N = stops, index N+1 = end (depot).
// We visit all stops 1..N starting from 0 and ending at N+1.

/**
 * Computes the total route distance for a given ordered list of node indices
 * using the provided distance matrix.
 */
function routeDistance(order: number[], distances: number[][]): number {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) {
    total += distances[order[i]][order[i + 1]];
  }
  return total;
}

/**
 * Nearest-Neighbor heuristic: greedily pick the closest unvisited stop at each step.
 * Returns the intermediate stop indices (1..N) in visit order.
 */
function nearestNeighborTour(distances: number[][], N: number): number[] {
  const visited = new Set<number>();
  const tour: number[] = [];
  let current = 0; // start at depot

  for (let step = 0; step < N; step++) {
    let bestNext = -1;
    let bestDist = Infinity;
    for (let j = 1; j <= N; j++) {
      if (!visited.has(j) && distances[current][j] < bestDist) {
        bestDist = distances[current][j];
        bestNext = j;
      }
    }
    if (bestNext === -1) {
      throw new Error("Nearest-neighbor: could not find next unvisited stop");
    }
    visited.add(bestNext);
    tour.push(bestNext);
    current = bestNext;
  }

  return tour;
}

/**
 * 2-opt improvement: iteratively reverse sub-segments of the intermediate stop
 * order to reduce total route distance. Start/end (depot) are kept fixed.
 * Returns the improved order of intermediate stop indices (1..N).
 */
function twoOptImprove(
  initialTour: number[],
  distances: number[][],
  endIdx: number
): number[] {
  // Full route: [0 (start), ...tour, endIdx]
  let tour = [...initialTour];
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < tour.length - 1; i++) {
      for (let j = i + 1; j < tour.length; j++) {
        // Current route segment: ...→ tour[i-1|start] → tour[i] → ... → tour[j] → tour[j+1|end] ...
        const prevI = i === 0 ? 0 : tour[i - 1];
        const nextJ = j === tour.length - 1 ? endIdx : tour[j + 1];

        const currentDist =
          distances[prevI][tour[i]] + distances[tour[j]][nextJ];
        const newDist =
          distances[prevI][tour[j]] + distances[tour[i]][nextJ];

        if (newDist < currentDist - 1e-10) {
          // Reverse the segment from i to j
          const reversed = tour.slice(i, j + 1).reverse();
          tour = [...tour.slice(0, i), ...reversed, ...tour.slice(j + 1)];
          improved = true;
        }
      }
    }
  }

  return tour;
}

/**
 * Nearest-Neighbor + 2-opt: runs NN to get an initial tour, then refines with 2-opt.
 * Returns 0-based indices into the original stops array.
 */
function nearestNeighbor2Opt(distances: number[][], N: number): number[] {
  const endIdx = N + 1;

  // Phase 1: Nearest-Neighbor initial tour
  const nnTour = nearestNeighborTour(distances, N);
  const fullNnRoute = [0, ...nnTour, endIdx];
  const nnDistance = routeDistance(fullNnRoute, distances);
  console.log(
    `NN initial tour (1-indexed stops): [${nnTour.join(", ")}], total distance: ${nnDistance.toFixed(0)}m`
  );

  // Phase 2: 2-opt improvement
  const improvedTour = twoOptImprove(nnTour, distances, endIdx);
  const fullImprovedRoute = [0, ...improvedTour, endIdx];
  const improvedDistance = routeDistance(fullImprovedRoute, distances);
  console.log(
    `2-opt improved tour (1-indexed stops): [${improvedTour.join(", ")}], total distance: ${improvedDistance.toFixed(0)}m (saved ${(nnDistance - improvedDistance).toFixed(0)}m)`
  );

  // Convert from 1-indexed node indices to 0-based original stop indices
  return improvedTour.map((i) => i - 1);
}

// --- OSRM Trip heuristic (emergency fallback if distance matrix call fails) ---

async function osrmTripFallback(
  coords: string[],
  stopCount: number
): Promise<number[]> {
  console.log("Falling back to OSRM /trip heuristic...");
  const coordsString = coords.join(";");
  const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordsString}?source=first&destination=last&roundtrip=false&geometries=geojson&overview=false`;

  const res = await fetch(osrmUrl);
  if (!res.ok) {
    throw new Error("Failed to compute optimal route with OSRM Trip API");
  }

  const data = (await res.json()) as {
    code: string;
    waypoints?: { waypoint_index: number }[];
    message?: string;
  };

  if (data.code !== "Ok" || !data.waypoints) {
    throw new Error(
      `Invalid response from OSRM routing service: ${data.message ?? "Unknown routing error"}`
    );
  }

  const waypoints = data.waypoints;
  const stopsWithRouteOrder = Array.from({ length: stopCount }, (_, index) => ({
    originalIndex: index,
    waypointIndex: waypoints[index + 1].waypoint_index,
  }));

  stopsWithRouteOrder.sort((a, b) => a.waypointIndex - b.waypointIndex);
  return stopsWithRouteOrder.map((s) => s.originalIndex);
}

// --- Main handler ---

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "driver" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized access. Driver role required." }),
        { status: 403 }
      );
    }

    const text = await request.text();
    const json = superjson.parse(text);
    const result = schema.parse(json);

    const { stops } = result;
    const startAddress = result.startAddress || DEFAULT_Lager_ADDRESS;
    const endAddress = result.endAddress || DEFAULT_Lager_ADDRESS;

    if (stops.length === 0) {
      return new Response(
        superjson.stringify({ optimizedOrder: [] } satisfies OutputType)
      );
    }

    if (stops.length === 1) {
      return new Response(
        superjson.stringify({ optimizedOrder: [0] } satisfies OutputType)
      );
    }

    // 1. Geocode all addresses: [start, ...stops, end]
    const allAddresses = [startAddress, ...stops.map((s) => s.address), endAddress];
    console.log(`Geocoding ${allAddresses.length} addresses...`);
    const coords = await geocodeAllAddresses(allAddresses);
    console.log(`Geocoding complete. Computing route for ${stops.length} stops.`);

    let optimizedOrder: number[];

    // 2. Try Nearest-Neighbor + 2-opt using OSRM distance matrix
    try {
      const distanceMatrix = await getDistanceMatrix(coords);
      console.log(
        `Distance matrix retrieved (${distanceMatrix.length}x${distanceMatrix[0]?.length}). Running Nearest-Neighbor + 2-opt...`
      );

      const N = stops.length;
      optimizedOrder = nearestNeighbor2Opt(distanceMatrix, N);
      console.log(`NN+2-opt optimized order (0-based): ${optimizedOrder.join(", ")}`);
    } catch (matrixError) {
      // Emergency fallback: OSRM /trip if distance matrix is unavailable
      console.error(
        "Distance matrix fetch failed, falling back to OSRM /trip heuristic:",
        matrixError
      );
      optimizedOrder = await osrmTripFallback(coords, stops.length);
      console.log(`OSRM /trip fallback order (0-based): ${optimizedOrder.join(", ")}`);
    }

    return new Response(
      superjson.stringify({ optimizedOrder } satisfies OutputType)
    );
  } catch (error) {
    console.error("optimize-route error:", error);
    return new Response(
      superjson.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status:
          error instanceof Error && error.message.startsWith("Unauthorized")
            ? 403
            : 400,
      }
    );
  }
}