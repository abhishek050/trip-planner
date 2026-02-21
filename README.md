# 🌍 AI Trip Planner

An intelligent travel planning web application that generates personalized itineraries, recommends real hotels/Airbnbs, optimizes budget allocation, and enriches stay data using live Google Places APIs.

Built with **Next.js 16 (App Router)**, **Prisma + MySQL**, **Gemini (LLM)**, and **Google Places API**.

---

## 🚀 Overview

AI Trip Planner allows users to:
* **Select** a destination city
* **Define** travel budget
* **Choose** stay preference (Hotel / Luxury / Airbnb)
* **Select** travel themes (Adventure, Culture, Relaxation, etc.)
* **Specify** trip duration

### The system then:
1. **Uses Gemini AI** to generate 3 real stay suggestions and a structured day-wise itinerary.
2. **Uses Google Places API** to validate stays, fetch ratings/review counts, get coordinates, and retrieve photo references.
3. **Stores enriched data** in MySQL via Prisma using atomic upserts.
4. **Returns optimized results** to the UI.

---

## 🏗️ Architecture Flow

`User Input` → `Gemini AI` → `Google Places` → `Prisma (DB)` → `API Response` → `UI`



### Step-by-Step Logic:
1. **User Submits Form:** Destination, budget, duration, and stay preference.
2. **Gemini Generates:** 3 real, searchable stays and a structured itinerary JSON.
3. **Google Places Enrichment:** Fetches rating, review count, coordinates, and photo references for each stay.
4. **Database Handling:** Atomic upsert with compound key `(city_id + name)`.
5. **API Returns:**
    ```json
    {
      "budgetSummary": {},
      "stays": [],
      "whyThisPlanWorks": "",
      "itinerary": []
    }
    ```

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router) |
| **Backend** | Next.js API Routes |
| **Database** | MySQL |
| **ORM** | Prisma |
| **LLM** | Google Gemini (gemini-2.0-flash) |
| **Enrichment** | Google Places API |
| **Styling** | Tailwind CSS |

---

## 📁 Project Structure

```text
/app
  /api
    /generate
      route.ts      → Main backend logic
  page.tsx          → Frontend UI
/lib
  prisma.ts         → Prisma client
/prisma
  schema.prisma     → Database schema
