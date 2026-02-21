// app/api/place-photo/route.ts
//
// Proxies Google Places photo requests so:
// 1. The API key is never sent to the browser
// 2. The image URL stored in the DB (/api/place-photo?ref=...) never expires
//
// Usage: /api/place-photo?ref=<photo_reference>

import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get("ref");

  if (!ref) {
    return new Response("Missing ref param", { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return new Response("API key not configured", { status: 500 });
  }

  try {
    const googleUrl =
      `https://maps.googleapis.com/maps/api/place/photo` +
      `?maxwidth=800&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;

    const googleRes = await fetch(googleUrl, {
      // Google redirects to the actual CDN image — follow it
      redirect: "follow",
    });

    if (!googleRes.ok) {
      return new Response("Failed to fetch image from Google", {
        status: googleRes.status,
      });
    }

    const imageBuffer = await googleRes.arrayBuffer();
    const contentType = googleRes.headers.get("content-type") ?? "image/jpeg";

    return new Response(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache aggressively — photo_reference is stable for the same place
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("place-photo proxy error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
