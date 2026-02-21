export async function GET() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=The Oberoi Delhi&key=${apiKey}`
    );

    const data = await res.json();

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err }, { status: 500 });
  }
}