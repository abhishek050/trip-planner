import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ city: string }> }
) {
  try {
    const { city } = await params;

    const cityData = await prisma.cities.findFirst({
      where: {
        name: city,
      },
      include: {
        places: {
          orderBy: {
            rating: "desc",
          },
        },
      },
    });

    if (!cityData) {
      return NextResponse.json(
        { error: "City not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(cityData);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch city data" },
      { status: 500 }
    );
  }
}
