import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// ─────────────────────────────────────────────────────────────────────────────
// Builds a direct Google Places photo URL from a stored photo_reference.
// Called SERVER-SIDE only — the API key never reaches the browser.
// Returns null if either argument is missing.
// ─────────────────────────────────────────────────────────────────────────────
function buildPlacesPhotoUrl(photoReference: string | null | undefined): string | null {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!photoReference || !apiKey) return null;
  return (
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=800` +
    `&photo_reference=${encodeURIComponent(photoReference)}` +
    `&key=${apiKey}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Given a DB row, resolves the best available image_url to send to the frontend.
//
// Priority order:
//   1. photo_reference column → build a fresh Google URL (never expires)
//   2. image_url column       → use whatever was stored
//   3. null                   → frontend shows Unsplash placeholder
// ─────────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveImageUrl(stay: any): string | null {
  const fromRef = buildPlacesPhotoUrl(stay.photo_reference);
  console.log(fromRef, stay.image_url);
  if (fromRef) return fromRef;
  if (stay.image_url) return stay.image_url as string;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Retry Wrapper
// ─────────────────────────────────────────────────────────────────────────────
async function generateWithRetry(
  prompt: string,
  retries = 2
): Promise<{ text: string }> {
  try {
    return await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "status" in error &&
      (error as unknown as { status: number }).status === 429 &&
      retries > 0
    ) {
      await new Promise((res) => setTimeout(res, 8000));
      return generateWithRetry(prompt, retries - 1);
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Places Enrichment
// NEVER throws — always returns null on any failure.
//
// NOTE ON API KEY RESTRICTION:
// If you see "REQUEST_DENIED: API keys with referer restrictions cannot be
// used with this API" — your key is set to "HTTP referrers (websites)" in
// Google Cloud Console. Server-side fetch() has no Referer header, so Google
// rejects it. Fix: Cloud Console → Credentials → your key → Application
// restrictions → change to "None" (or "IP addresses" with your server IP).
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGooglePlaceDetails(query: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("[places] GOOGLE_PLACES_API_KEY not set");
    return null;
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
        `?query=${encodeURIComponent(query)}&key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      console.warn(`[places] HTTP ${res.status} for: "${query}"`);
      return null;
    }

    const data = await res.json();

    if (data.status === "REQUEST_DENIED") {
      // ── Most common cause: API key has "HTTP referrer" restriction ──────────
      // Server-side fetch() sends no Referer header → Google blocks it.
      // FIX: Cloud Console → Credentials → API key → Application restrictions
      //      → set to "None" or "IP addresses" (not "HTTP referrers").
      console.error(
        `[places] REQUEST_DENIED for "${query}". ` +
        `If your key has HTTP-referrer restrictions, remove them — ` +
        `server-side requests have no Referer header. ` +
        `Error: ${data.error_message ?? "n/a"}`
      );
      return null;
    }

    if (!data?.results?.length) {
      console.warn(`[places] No results for: "${query}"`);
      return null;
    }

    const result = data.results[0];

    // Store the raw reference string — not a built URL.
    // buildPlacesPhotoUrl() constructs the real URL on demand.
    const photo_reference: string | null =
      result.photos?.[0]?.photo_reference ?? null;

    return {
      rating:          result.rating                  ?? null,
      review_count:    result.user_ratings_total      ?? null,
      latitude:        result.geometry?.location?.lat ?? null,
      longitude:       result.geometry?.location?.lng ?? null,
      google_maps_url: `https://www.google.com/maps/place/?q=place_id:${result.place_id}`,
      photo_reference,
      image_url:       buildPlacesPhotoUrl(photo_reference),
      description:     result.formatted_address       ?? null,
    };
  } catch (err) {
    console.error(`[places] Fetch error for "${query}":`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe DB save — tries native upsert first (needs @@unique([city_id, name])),
// falls back to findFirst + create/update.
// ─────────────────────────────────────────────────────────────────────────────
async function safeUpsertStay(
  cityId: number,
  stayName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createData: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateData: any
) {
  try {
    return await prisma.stays.upsert({
      where: { city_id_name: { city_id: cityId, name: stayName } },
      update: updateData,
      create: createData,
    });
  } catch {
    // @@unique not yet migrated — fall through
  }

  try {
    const existing = await prisma.stays.findFirst({
      where: { city_id: cityId, name: stayName },
    });
    if (existing) {
      return await prisma.stays.update({ where: { id: existing.id }, data: updateData });
    }
    return await prisma.stays.create({ data: createData });
  } catch (err) {
    console.error(`[stays] DB save failed for "${stayName}":`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN API
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      destinationCity,
      totalBudget,
      duration       = 1,
      selectedThemes = [],
      stayPreference,
    } = body;

    const budget = Number(totalBudget ?? 0);

    if (!destinationCity) {
      return Response.json({ error: "Destination city required" }, { status: 400 });
    }

    const travelBudget     = Math.round(budget * 0.35);
    const stayBudget       = Math.round(budget * 0.3);
    const activitiesBudget = Math.round(budget * 0.25);
    const foodBudget       = Math.round(budget * 0.1);

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1 — Ensure City Exists
    // ═══════════════════════════════════════════════════════════════════════════
    let city = await prisma.cities.findFirst({ where: { name: destinationCity } });

    if (!city) {
      const googleData = await fetchGooglePlaceDetails(destinationCity);
      city = await prisma.cities.create({
        data: {
          name:        destinationCity,
          country:     "India",
          description: `${destinationCity} travel destination`,
          latitude:    googleData?.latitude  ?? null,
          longitude:   googleData?.longitude ?? null,
          image_url:   googleData?.image_url ?? null,
        },
      });
      console.log(`[city] Created: ${city.name} (id=${city.id})`);
    } else {
      console.log(`[city] Found: ${city.name} (id=${city.id})`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2 — Generate 3 Stays from Gemini
    // ═══════════════════════════════════════════════════════════════════════════
    const preferredType =
      stayPreference === "Budget Hotel" ? "Hotel"  :
      stayPreference === "Luxury Hotel" ? "Luxury" :
      stayPreference === "Airbnb"       ? "Airbnb" :
      null;

    const stayPrompt = `
Return ONLY valid JSON. No markdown, no explanation.

Generate exactly 3 REAL stay options in ${destinationCity}, India.
These must be actual hotels or accommodations that exist and are searchable on Google Maps.

Rules:
- "type" must be one of: Hotel, Airbnb, Luxury
${preferredType ? `- ALL stays MUST be type "${preferredType}"` : ""}
- "price_per_night" in realistic INR (integer)
- No duplicate names
- For tier-2 cities use real, well-known local hotels

Return ONLY:
{
  "stays": [
    {
      "name": "string",
      "type": "Hotel | Airbnb | Luxury",
      "area": "string",
      "price_per_night": number
    }
  ]
}`;

    let stayParsed: {
      stays: Array<{ name: string; type: string; area: string; price_per_night: number }>;
    } = { stays: [] };

    try {
      const stayResponse = await generateWithRetry(stayPrompt);
      const raw = stayResponse.text.replace(/```json|```/g, "").trim();
      const p = JSON.parse(raw);
      if (Array.isArray(p?.stays)) stayParsed = p;
    } catch (err) {
      console.warn("[stays] Gemini parse failed:", err);
    }

    const validGeminiStays = (stayParsed.stays ?? []).filter((s) => {
      if (!s.name?.trim()) return false;
      if (!["Hotel", "Airbnb", "Luxury"].includes(s.type)) return false;
      if (preferredType && s.type !== preferredType) return false;
      return true;
    });

    console.log(`[stays] Gemini: ${validGeminiStays.length} valid stays`);

    // Parallel Places enrichment
    const enrichedResults = await Promise.all(
      validGeminiStays.map(async (stay) => {
        const googleData = await fetchGooglePlaceDetails(
          `${stay.name} ${destinationCity} India`
        );
       
        return { stay, googleData };
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalStays: any[] = [];
      console.log("enrich Result",enrichedResults);
    for (const { stay, googleData } of enrichedResults) {
  if (finalStays.length >= 3) break;

  // 🚨 STRICT: Do NOT save incomplete stays
  if (!googleData?.photo_reference || googleData?.latitude == null) {
    console.warn(
      `[stays] Skipping "${stay.name}" — incomplete Google enrichment`
    );
    continue;
  }

  const createData = {
    city_id:           city.id,
    name:              stay.name,
    type:              stay.type,
    area:              stay.area ?? "",
    rating:            googleData.rating           ?? null,
    review_count:      googleData.review_count     ?? null,
    cleanliness_score: 8.5,
    price_per_night:   Number(stay.price_per_night ?? 3000),
    latitude:          googleData.latitude,
    longitude:         googleData.longitude,
    google_maps_url:   googleData.google_maps_url  ?? null,
    photo_reference:   googleData.photo_reference,
    image_url:         buildPlacesPhotoUrl(googleData.photo_reference),
    description:       googleData.description      ?? null,
  };

  const updateData = {
    ...(googleData.rating           != null && { rating: googleData.rating }),
    ...(googleData.review_count     != null && { review_count: googleData.review_count }),
    ...(googleData.photo_reference  != null && { photo_reference: googleData.photo_reference }),
    ...(googleData.description      != null && { description: googleData.description }),
    ...(googleData.google_maps_url  != null && { google_maps_url: googleData.google_maps_url }),
    ...(googleData.latitude         != null && { latitude: googleData.latitude }),
    ...(googleData.longitude        != null && { longitude: googleData.longitude }),
  };

  const dbStay = await safeUpsertStay(city.id, stay.name, createData, updateData);

  if (dbStay) {
    finalStays.push(dbStay);
    console.log(
      `[stays] Saved: "${dbStay.name}"`,
      `| photo_ref: ✓`,
      `| image_url: ✓`
    );
  }
}

    // ── DB Fallback ──────────────────────────────────────────────────────────
    if (finalStays.length < 3) {
      console.log(`[stays] ${finalStays.length}/3 — DB fallback`);
      const existingIds = new Set(finalStays.map((s) => s.id));

      // Pass 1: rows that have image_url (which implies photo_reference was set).
      // NOTE: We filter on image_url rather than photo_reference here because
      // MySQL TEXT columns cannot use Prisma's `{ not: null }` filter — it
      // generates invalid SQL. image_url is equivalent for this purpose since
      // both columns are set together during enrichment.
      const withImage = await prisma.stays.findMany({
        where: {
          city_id:   city.id,
          ...(preferredType && { type: preferredType }),
          image_url: { not: null },
        },
        orderBy: { rating: "desc" },
        take: 10,
      });
      for (const s of withImage) {
        if (finalStays.length >= 3) break;
        if (!existingIds.has(s.id)) { finalStays.push(s); existingIds.add(s.id); }
      }

      // Pass 2: any stays for this city, no quality filter
      if (finalStays.length < 3) {
        const anyStays = await prisma.stays.findMany({
          where: { city_id: city.id, ...(preferredType && { type: preferredType }) },
          orderBy: { created_at: "desc" },
          take: 10,
        });
        for (const s of anyStays) {
          if (finalStays.length >= 3) break;
          if (!existingIds.has(s.id)) { finalStays.push(s); existingIds.add(s.id); }
        }
      }

      // Pass 3: ignore preferredType as absolute last resort
      if (finalStays.length < 3 && preferredType) {
        const anyType = await prisma.stays.findMany({
          where: { city_id: city.id },
          orderBy: { created_at: "desc" },
          take: 10,
        });
        for (const s of anyType) {
          if (finalStays.length >= 3) break;
          if (!existingIds.has(s.id)) { finalStays.push(s); existingIds.add(s.id); }
        }
      }
    }

    // Deduplicate + rank
    const dedupedStays = finalStays
      .filter((v, i, a) => a.findIndex((t: { id: number }) => t.id === v.id) === i)
      .sort((a, b) => {
        const sA = (a.rating ?? 0) * Math.log((a.review_count ?? 1) + 1);
        const sB = (b.rating ?? 0) * Math.log((b.review_count ?? 1) + 1);
        return sB - sA;
      })
      .slice(0, 3);

    // Resolve image URLs server-side before sending to frontend.
    // Rebuilds from photo_reference so even stale/null image_url rows
    // get a fresh working URL on every response.
    const staysForResponse = dedupedStays.map((stay) => ({
      ...stay,
      image_url: resolveImageUrl(stay),
    }));

    console.log(
      `[stays] Returning ${staysForResponse.length}:`,
      staysForResponse.map((s) => `"${s.name}" [img: ${s.image_url ? "✓" : "✗"}]`)
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3 — Generate Itinerary
    // ═══════════════════════════════════════════════════════════════════════════
    const itineraryPrompt = `
Generate a ${duration} day travel itinerary for ${destinationCity}, India.
Return ONLY valid JSON. No markdown.

{
  "whyThisPlanWorks": "string",
  "itinerary": [
    {
      "day": number,
      "areaCovered": "string",
      "activities": [
        {
          "title": "string",
          "type": "attraction | restaurant | hidden_gem",
          "timeOfDay": "Morning | Afternoon | Evening",
          "shortDescription": "string",
          "estimatedDuration": "string",
          "entryFee": number,
          "costIncludedInBudget": number
        }
      ],
      "dailyEstimatedSpend": number
    }
  ]
}`;

    const itineraryResponse = await generateWithRetry(itineraryPrompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(itineraryResponse.text.replace(/```json|```/g, "").trim());
    } catch {
      return Response.json({ error: "Invalid itinerary JSON" }, { status: 500 });
    }

    return Response.json({
      budgetSummary: {
        travel:        travelBudget,
        accommodation: stayBudget,
        activities:    activitiesBudget,
        food:          foodBudget,
        total:         budget,
      },
      stays: staysForResponse,
      ...(parsed as object),
    });
  } catch (err) {
    console.error("[generate] Unhandled error:", err);
    return Response.json({ error: "Failed to generate itinerary" }, { status: 500 });
  }
}
