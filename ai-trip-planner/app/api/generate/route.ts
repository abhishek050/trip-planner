import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const fromCity = body.fromCity ?? "";
    const destinationCity = body.destinationCity ?? "";
    const budget = Number(body.budget ?? 0);
    const persons = Number(body.persons ?? 1);
    const duration = Number(body.duration ?? 1);
    const selectedThemes = body.selectedThemes ?? [];
    const stayPreference = body.stayPreference ?? "";

    if (!destinationCity) {
      return Response.json(
        { error: "Destination city required" },
        { status: 400 }
      );
    }

    // -------------------------
    // Budget Allocation
    // -------------------------
    const travelBudget = Math.round(budget * 0.35);
    const stayBudget = Math.round(budget * 0.3);
    const activitiesBudget = Math.round(budget * 0.25);
    const foodBudget = Math.round(budget * 0.1);

    // -------------------------
    // Fetch City + Places
    // -------------------------
    const city = await prisma.cities.findFirst({
      where: { name: destinationCity },
      include: { places: true },
    });

    if (!city) {
      return Response.json({ error: "City not found" }, { status: 404 });
    }

    // Send top 15 DB places to AI for grounding
    const knownPlaces = city.places
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 15);

    const knownPlacesText = knownPlaces
      .map(
        (p) =>
          `${p.name} (Area: ${p.area}, Rating: ${p.rating}, AvgCost: ₹${
            p.average_cost ?? 0
          })`
      )
      .join("\n");

    // -------------------------
    // AI Prompt (HYBRID MODE)
    // -------------------------
    const prompt = `
You are an elite Indian travel curator.

You may use the known places below OR suggest better real attractions in ${destinationCity}.
Do not invent fake places.

Known Places:
${knownPlacesText}

Trip Details:
From: ${fromCity}
To: ${destinationCity}
Budget: ₹${budget}
Duration: ${duration} days
Themes: ${
      Array.isArray(selectedThemes)
        ? selectedThemes.join(", ")
        : selectedThemes || "General"
    }

Return ONLY valid JSON:

{
  "budgetSummary": {
    "travel": number,
    "accommodation": number,
    "activities": number,
    "food": number,
    "total": number
  },
  "whyThisPlanWorks": "string",
  "itinerary": [
    {
      "day": number,
      "areaCovered": "string",
      "activities": [
        {
          "title": "Real place name",
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
}

Generate exactly ${duration} days.
Ensure total spend ≤ ${budget}.
`;

async function generateWithRetry(prompt: string, retries = 2) {
  try {
    return await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });
  } catch (error: any) {
    if (error.status === 429 && retries > 0) {
      console.log("Rate limited. Waiting 10 seconds...");
      await new Promise((res) => setTimeout(res, 10000));
      return generateWithRetry(prompt, retries - 1);
    }
    throw error;
  }
}

const response = await generateWithRetry(prompt);

    const text = response.text ?? "";

    let parsed: any;

    try {
      parsed = JSON.parse(
        text.replace(/```json|```/g, "").replace(/`/g, "").trim()
      );
    } catch {
      return Response.json(
        { error: "Invalid AI response", raw: text },
        { status: 500 }
      );
    }

    // -------------------------
    // AUTO DB SYNC
    // -------------------------
    for (const day of parsed.itinerary) {
      for (const activity of day.activities) {
        const placeName = activity.title;

        let place = await prisma.places.findFirst({
          where: {
            name: placeName,
            city_id: city.id,
          },
        });

        // If not found → insert new place
        if (!place) {
          place = await prisma.places.create({
            data: {
              city_id: city.id,
              name: placeName,
              type: activity.type ?? "attraction",
              category:
                selectedThemes?.[0] ?? "general",
              description: activity.shortDescription ?? "",
              google_maps_url: null,
              rating: 4.0,
              review_count: 0,
              price_level: 2,
              average_cost: activity.entryFee ?? 0,
              latitude: 0, // later fetch from Google Places API
              longitude: 0,
              area: day.areaCovered ?? "",
              is_featured: false,
            },
          });
        }

        // Replace AI data with DB truth
        activity.place_id = place.id;
        activity.latitude = place.latitude;
        activity.longitude = place.longitude;
        activity.rating = place.rating;
        activity.average_cost = place.average_cost;
      }
    }

    return Response.json(parsed);
  } catch (err) {
    console.error("Generate error:", err);
    return Response.json(
      { error: "Failed to generate itinerary" },
      { status: 500 }
    );
  }
}
