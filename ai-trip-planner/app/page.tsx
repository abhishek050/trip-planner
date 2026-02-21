"use client";

import { useState, useRef } from "react";
// import Image from "next/image";

const FEATURES = [
  {
    title: "Smart Budget Optimization",
    description:
      "AI allocates your budget across flights, stays, and experiences so you get the most value from every dollar.",
    icon: (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50">
        <svg viewBox="0 0 48 48" className="h-12 w-12" fill="none">
          <rect x="6" y="16" width="36" height="20" rx="6" fill="#2563EB" />
          <rect x="6" y="20" width="28" height="12" rx="4" fill="#3B82F6" />
          <circle cx="34" cy="26" r="7" fill="#FBBF24" />
          <text x="34" y="30" textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">₹</text>
          <path d="M12 22 L18 18 L24 21 L30 17" stroke="#BFDBFE" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    ),
  },
  {
    title: "Hidden Gems Discovery",
    description:
      "Go beyond tourist traps. Our AI surfaces local favorites and under-the-radar spots that match your vibe.",
    icon: (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50">
        <svg viewBox="0 0 48 48" className="h-12 w-12" fill="none">
          <rect x="6" y="26" width="36" height="10" rx="3" fill="#FED7AA" />
          <path d="M24 10c-4 0-7 3-7 7 0 5 7 11 7 11s7-6 7-11c0-4-3-7-7-7z" fill="#F97316" />
          <circle cx="24" cy="17" r="2.5" fill="white" />
          <polygon points="24,20 30,26 24,32 18,26" fill="#FBBF24" />
          <polygon points="24,20 27,26 24,32 21,26" fill="#FCD34D" />
        </svg>
      </div>
    ),
  },
  {
    title: "Personalized Themes",
    description:
      "Adventure, relaxation, foodie, culture—pick your theme and get itineraries tailored to how you travel.",
    icon: (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-50">
        <svg viewBox="0 0 48 48" className="h-12 w-12" fill="none">
          <rect x="12" y="8" width="24" height="32" rx="6" fill="#7C3AED" />
          <rect x="16" y="14" width="16" height="20" rx="3" fill="#C4B5FD" />
          <line x1="19" y1="19" x2="29" y2="19" stroke="#7C3AED" strokeWidth="2" />
          <line x1="19" y1="24" x2="29" y2="24" stroke="#7C3AED" strokeWidth="2" />
          <line x1="19" y1="29" x2="26" y2="29" stroke="#7C3AED" strokeWidth="2" />
          <path d="M18 19l2 2 4-4" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
  },
];

const THEME_OPTIONS = ["Romantic", "Adventure", "Party", "Family", "Spiritual", "Mixed"];
const STAY_OPTIONS  = ["Budget Hotel", "Luxury Hotel", "Airbnb", "No Preference"];

// Deterministic Unsplash placeholder — uses the stay name as a seed so the
// same hotel always gets the same image, and it's always a real hotel photo.
// Width/height match the card slot (800×320 = 2.5:1).
function getUnsplashFallback(stayName: string, cityName?: string): string {
  const query = encodeURIComponent(
    cityName ? `hotel ${cityName}` : "luxury hotel room"
  );
  // Unsplash source picks a random image matching the query.
  // We append the stayName hash as a sig so repeated renders pick the same image.
  const sig   = encodeURIComponent(stayName.slice(0, 20));
  return `https://source.unsplash.com/800x320/?${query}&sig=${sig}`;
}

type FormErrors = Record<string, string>;

type BudgetSummary = {
  travel?:        number;
  accommodation?: number;
  activities?:    number;
  food?:          number;
  total?:         number;
};

type DayActivity = { activity?: string; cost?: number };

type ItineraryActivity = {
  timeOfDay?:              string;
  title?:                  string;
  shortDescription?:       string;
  estimatedDuration?:      string;
  travelTimeFromPrevious?: number;
  entryFee?:               number;
  costIncludedInBudget?:   number;
};

type ItineraryDay = {
  day?:                 number;
  areaCovered?:         string;
  morning?:             DayActivity;
  afternoon?:           DayActivity;
  evening?:             DayActivity;
  activities?:          ItineraryActivity[];
  dailyEstimatedSpend?: number;
};

// Canonical stay type — all fields match Prisma/DB snake_case output exactly.
// rating and review_count must accept null because Prisma returns null, not undefined.
type BackendStay = {
  id:               number;
  name:             string;
  area?:            string | null;
  type?:            string | null;
  rating?:          number | null;
  review_count?:    number | null;
  price_per_night?: number;
  image_url?:       string | null;
  google_maps_url?: string | null;
  description?:     string | null;
};

type ResultData = {
  budgetSummary?:    BudgetSummary;
  stays?:            BackendStay[];
  whyThisPlanWorks?: string;
  itinerary?:        ItineraryDay[];
};

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString("en-IN")}`;

// ─────────────────────────────────────────────────────────────────────────────
// StayImage — renders the hotel image with a two-tier fallback:
//
//  Tier 1: image_url from the API response (Google Places photo — always fresh
//          because route.ts rebuilds it from photo_reference server-side)
//
//  Tier 2: if image_url is null OR the <img> fires onError (e.g. expired key,
//          CORS block, network error) → switch to a real Unsplash photo
//          matching "hotel <cityName>" so the card always looks polished.
//
// No more grey box with an emoji.
// ─────────────────────────────────────────────────────────────────────────────
function StayImage({
  src,
  alt,
  cityName,
}: {
  src:       string | null | undefined;
  alt:       string;
  cityName?: string;
}) {
  const fallbackUrl            = getUnsplashFallback(alt, cityName);
  const [currentSrc, setCurrentSrc] = useState<string>(src ?? fallbackUrl);
  const [usedFallback, setUsedFallback] = useState(!src);

  // If the primary src prop changes (e.g. parent re-renders with a real URL),
  // reset so we try the fresh URL instead of staying on the fallback.
  // We only do this when src transitions from null → non-null.
  const handleError = () => {
    if (!usedFallback) {
      setCurrentSrc(fallbackUrl);
      setUsedFallback(true);
    }
    // If even the Unsplash fallback fails (offline), leave it — broken image
    // is still better than crashing the component.
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      className="mb-4 h-40 w-full rounded-xl object-cover"
      onError={handleError}
      // Give the browser a crossOrigin hint for Unsplash images
      crossOrigin={usedFallback ? "anonymous" : undefined}
    />
  );
}

export default function Home() {
  const [hasResult,    setHasResult]    = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError,     setApiError]     = useState<string | null>(null);
  const [resultData,   setResultData]   = useState<ResultData | null>(null);
  const [errors,       setErrors]       = useState<FormErrors>({});

  // We store the submitted destinationCity separately so StayImage can use
  // it as the Unsplash query keyword even after the form resets.
  const [submittedCity, setSubmittedCity] = useState<string>("");

  const formSectionRef = useRef<HTMLElement>(null);

  const [fromCity,        setFromCity]        = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [totalBudget,     setTotalBudget]     = useState("");
  const [numberOfPersons, setNumberOfPersons] = useState("");
  const [duration,        setDuration]        = useState("");
  const [selectedThemes,  setSelectedThemes]  = useState<string[]>([]);
  const [stayPreference,  setStayPreference]  = useState("");

  const scrollToForm = () => {
    formSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleTheme = (theme: string) => {
    setSelectedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
    );
  };

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!fromCity.trim())        nextErrors.fromCity        = "From City is required";
    if (!destinationCity.trim()) nextErrors.destinationCity = "Destination City is required";

    const budgetNum = Number(totalBudget);
    if (!totalBudget.trim())                     nextErrors.totalBudget = "Total Budget is required";
    else if (isNaN(budgetNum) || budgetNum <= 0) nextErrors.totalBudget = "Must be greater than 0";

    const personsNum = Number(numberOfPersons);
    if (!numberOfPersons.trim())                   nextErrors.numberOfPersons = "Number of Persons is required";
    else if (isNaN(personsNum) || personsNum < 1)  nextErrors.numberOfPersons = "Must be at least 1";

    const durationNum = Number(duration);
    if (!duration.trim())                          nextErrors.duration = "Duration is required";
    else if (isNaN(durationNum) || durationNum < 1) nextErrors.duration = "Must be at least 1";

    if (selectedThemes.length === 0) nextErrors.selectedThemes = "Select at least one theme";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});
    setApiError(null);
    setResultData(null);
    setSubmittedCity(destinationCity); // ← capture for Unsplash fallback keyword

    try {
      const res = await fetch("/api/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCity,
          destinationCity,
          totalBudget:     totalBudget     ? Number(totalBudget)     : undefined,
          numberOfPersons: numberOfPersons ? Number(numberOfPersons) : undefined,
          duration:        duration        ? Number(duration)        : undefined,
          selectedThemes,
          stayPreference: stayPreference || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && !data.error) {
        setResultData(data);
        setHasResult(true);
        console.log("[page] stays received:", {
          count:  data.stays?.length ?? 0,
          images: (data.stays ?? []).map((s: BackendStay) => ({
            name:      s.name,
            image_url: s.image_url ?? "null",
          })),
        });
      } else {
        setApiError(data.error ?? data.details ?? "Failed to generate itinerary");
      }
    } catch {
      setApiError("Failed to connect. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBaseClass =
    "w-full rounded-xl border bg-white px-5 py-4 text-gray-900 placeholder:text-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const inputErrorClass = "border-red-500 focus:ring-red-500";
  const inputOkClass    = "border-gray-200 hover:border-gray-300 focus:border-transparent";

  return (
    <main className="relative min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Decorative blur circles */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-blue-400/15 blur-3xl" />
        <div className="absolute -right-40 top-1/4 h-80 w-80 rounded-full bg-purple-400/12 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute right-1/3 top-1/2 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 h-72 w-72 rounded-full bg-violet-400/12 blur-3xl" />
      </div>

      {/* ── Hero ── */}
      <section className="relative flex min-h-[70vh] w-full flex-col items-center justify-center px-6 py-20 sm:px-8 md:px-12 lg:px-16">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Plan Your Perfect Trip
            <span className="mt-2 block bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              with AI
            </span>
          </h1>
          <p className="mb-10 mx-auto max-w-2xl text-lg font-medium text-gray-600 sm:text-xl md:text-2xl">
            Personalized itineraries. Budget optimized. Theme driven.
          </p>
          <div className="relative inline-block transition-transform duration-300 hover:scale-105">
            <div className="absolute -inset-1 animate-pulse rounded-2xl bg-gradient-to-r from-blue-500/40 to-purple-500/40 blur-xl" />
            <button
              type="button"
              onClick={scrollToForm}
              className="relative inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-base font-semibold text-white shadow-xl transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98] sm:text-lg"
            >
              Start Planning
            </button>
          </div>
        </div>
      </section>

      <div className="border-t border-gray-200/60" />

      {/* ── Features ── */}
      <section className="relative px-6 py-20 sm:px-8 md:px-12 lg:px-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <span className="inline-block rounded-full bg-gray-100 px-4 py-1.5 text-sm font-semibold text-gray-700">
              Why choose us
            </span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-6 shadow-md transition-all duration-300 hover:shadow-xl"
              >
                <div className="mb-4">{feature.icon}</div>
                <h3 className="mb-2 text-lg font-bold text-gray-900">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-200/60" />

      {/* ── Form ── */}
      <section
        ref={formSectionRef}
        className="relative px-6 py-20 sm:px-8 md:px-12 lg:px-16"
      >
        <div className="mx-auto max-w-xl">
          <div className="mb-6 text-center">
            <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-sm font-semibold text-blue-700">
              Get started
            </span>
          </div>
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/40 bg-white/70 p-10 shadow-2xl backdrop-blur-xl transition-all duration-300"
          >
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Plan your trip
            </h2>
            <p className="mb-8 text-gray-600">
              Tell us about your trip and we&apos;ll handle the rest.
            </p>
            <div className="space-y-6">

              <div>
                <input
                  type="text"
                  placeholder="From City"
                  value={fromCity}
                  onChange={(e) => setFromCity(e.target.value)}
                  className={`${inputBaseClass} ${errors.fromCity ? inputErrorClass : inputOkClass}`}
                />
                {errors.fromCity && <p className="mt-1.5 text-sm text-red-600">{errors.fromCity}</p>}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Destination City"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  className={`${inputBaseClass} ${errors.destinationCity ? inputErrorClass : inputOkClass}`}
                />
                {errors.destinationCity && <p className="mt-1.5 text-sm text-red-600">{errors.destinationCity}</p>}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <input
                    type="number"
                    placeholder="Total Budget"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                    min={0}
                    className={`${inputBaseClass} ${errors.totalBudget ? inputErrorClass : inputOkClass}`}
                  />
                  {errors.totalBudget && <p className="mt-1.5 text-sm text-red-600">{errors.totalBudget}</p>}
                </div>
                <div>
                  <input
                    type="number"
                    placeholder="Number of Persons"
                    value={numberOfPersons}
                    onChange={(e) => setNumberOfPersons(e.target.value)}
                    min={1}
                    className={`${inputBaseClass} ${errors.numberOfPersons ? inputErrorClass : inputOkClass}`}
                  />
                  {errors.numberOfPersons && <p className="mt-1.5 text-sm text-red-600">{errors.numberOfPersons}</p>}
                </div>
              </div>

              <div>
                <input
                  type="number"
                  placeholder="Duration (days)"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min={1}
                  className={`${inputBaseClass} ${errors.duration ? inputErrorClass : inputOkClass}`}
                />
                {errors.duration && <p className="mt-1.5 text-sm text-red-600">{errors.duration}</p>}
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-gray-700">Theme</p>
                <div
                  className={`flex flex-wrap gap-2 rounded-xl border p-3 transition-colors ${
                    errors.selectedThemes ? "border-red-500" : "border-gray-200"
                  }`}
                >
                  {THEME_OPTIONS.map((themeOption) => {
                    const isSelected = selectedThemes.includes(themeOption);
                    return (
                      <button
                        key={themeOption}
                        type="button"
                        onClick={() => toggleTheme(themeOption)}
                        className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-all ${
                          isSelected
                            ? "border-transparent bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {themeOption}
                      </button>
                    );
                  })}
                </div>
                {errors.selectedThemes && <p className="mt-1.5 text-sm text-red-600">{errors.selectedThemes}</p>}
              </div>

              <select
                value={stayPreference}
                onChange={(e) => setStayPreference(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-5 py-4 text-gray-900 transition-colors duration-200 hover:border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Stay Preference</option>
                {STAY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-4 text-base font-semibold text-white shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100"
              >
                {isSubmitting ? "Crafting your premium itinerary..." : "Generate Itinerary"}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Results ── */}
      {(hasResult || apiError || isSubmitting) && (
        <>
          <div className="border-t border-gray-200/60" />
          <section className="animate-fade-in-up px-6 py-20 sm:px-8 md:px-12 lg:px-16">
            <div className="mx-auto max-w-6xl">
              <div className="mb-8 text-center">
                <span className="inline-block rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">
                  Your itinerary
                </span>
              </div>
              <div className="rounded-3xl bg-gradient-to-br from-blue-100/50 via-white to-purple-100/50 p-[1px] shadow-xl">
                <div className="rounded-3xl bg-white/90 p-10 backdrop-blur-sm">

                  {/* Loading state */}
                  {isSubmitting ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <p className="text-lg font-medium text-gray-600">
                        Crafting your premium itinerary...
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Curating stays and experiences for you
                      </p>
                      {/* Skeleton cards */}
                      <div className="mt-10 w-full">
                        <div className="mb-4 h-5 w-40 animate-pulse rounded-full bg-gray-100" />
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                              <div className="mb-4 h-40 w-full animate-pulse rounded-xl bg-gradient-to-br from-gray-100 to-gray-200" />
                              <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                              <div className="mb-2 h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                              <div className="mt-4 h-3 w-1/3 animate-pulse rounded bg-gray-100" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                  ) : apiError ? (
                    <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/80 to-rose-50/50 p-10 shadow-sm">
                      <p className="text-center font-semibold text-red-700">{apiError}</p>
                      <p className="mt-2 text-center text-sm text-red-600/80">
                        Please check your connection and try again.
                      </p>
                    </div>

                  ) : resultData ? (
                    <>
                      <h2 className="mb-10 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                        Your AI Generated Itinerary
                      </h2>

                      {/* Why This Plan Works */}
                      {resultData.whyThisPlanWorks && (
                        <div className="mb-10 rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 via-blue-50/50 to-purple-50/30 p-8 shadow-sm">
                          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-indigo-700">
                            Why This Plan Works
                          </h3>
                          <p className="text-base leading-relaxed text-gray-800">
                            {resultData.whyThisPlanWorks}
                          </p>
                        </div>
                      )}

                      {/* Budget Breakdown */}
                      {resultData.budgetSummary && (
                        <div className="mb-10 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                          <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
                            Budget Breakdown
                          </h3>
                          <div className="space-y-5">
                            {(() => {
                              const bs    = resultData.budgetSummary;
                              const total = typeof bs.total === "number" && bs.total > 0 ? bs.total : 1;
                              const items = [
                                { label: "Travel",        value: bs.travel        ?? 0, color: "bg-blue-500"   },
                                { label: "Accommodation", value: bs.accommodation ?? 0, color: "bg-indigo-500" },
                                { label: "Activities",    value: bs.activities    ?? 0, color: "bg-purple-500" },
                                { label: "Food",          value: bs.food          ?? 0, color: "bg-amber-500"  },
                              ];
                              return items.map((item, i) => {
                                const pct = Math.min(100, (item.value / total) * 100);
                                return (
                                  <div key={i}>
                                    <div className="mb-1.5 flex justify-between text-sm">
                                      <span className="text-gray-600">{item.label}</span>
                                      <span className="font-medium text-gray-900">
                                        {formatCurrency(item.value)}
                                      </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                      <div
                                        className={`h-full rounded-full ${item.color} transition-all duration-500`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                          <div className="mt-6 flex justify-between border-t border-gray-200 pt-6">
                            <span className="font-bold text-gray-900">Total Estimated Cost</span>
                            <span className="text-xl font-bold text-indigo-600">
                              {typeof resultData.budgetSummary.total === "number"
                                ? formatCurrency(resultData.budgetSummary.total)
                                : ""}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* ── Curated Stay Options ── */}
                      {Array.isArray(resultData.stays) && resultData.stays.length > 0 ? (
                        <div className="mb-12">
                          <h3 className="mb-6 text-lg font-bold text-gray-900">
                            Curated Stay Options
                          </h3>
                          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {resultData.stays.map((stay) => (
                              <div
                                key={stay.id}
                                className="relative flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-md transition-all duration-300 hover:shadow-xl"
                              >
                                {/*
                                  StayImage now receives cityName so the Unsplash fallback
                                  uses "hotel <city>" as the search query — much better than
                                  the old grey box with a 🏨 emoji.

                                  Priority:
                                    1. image_url from API (direct Google URL, built server-side)
                                    2. Unsplash photo matching the destination city
                                */}
                                <StayImage
                                  src={stay.image_url}
                                  alt={stay.name}
                                  cityName={submittedCity}
                                />

                                <p className="font-semibold text-gray-900">{stay.name}</p>

                                {stay.area && (
                                  <p className="mt-1 text-sm text-gray-500">{stay.area}</p>
                                )}

                                {stay.description && (
                                  <p className="mt-1 text-xs leading-relaxed text-gray-500 line-clamp-2">
                                    {stay.description}
                                  </p>
                                )}

                                {stay.type && (
                                  <span className="mt-2 inline-block self-start rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                    {stay.type}
                                  </span>
                                )}

                                <div className="mt-3 flex items-center gap-4 text-sm">
                                  {stay.rating != null && (
                                    <span className="font-semibold text-amber-500">
                                      ★ {stay.rating}
                                    </span>
                                  )}
                                  {stay.review_count != null && (
                                    <span className="text-xs text-gray-400">
                                      {stay.review_count.toLocaleString("en-IN")} reviews
                                    </span>
                                  )}
                                </div>

                                {typeof stay.price_per_night === "number" && (
                                  <p className="mt-3 text-sm font-bold text-indigo-600">
                                    {formatCurrency(stay.price_per_night)}{" "}
                                    <span className="font-normal text-gray-400">/ night</span>
                                  </p>
                                )}

                                {stay.google_maps_url && (
                                  <a
                                    href={stay.google_maps_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
                                  >
                                    View on Maps →
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-12 rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                          <p className="text-sm text-gray-400">
                            Stay options are being sourced — try regenerating or check back shortly.
                          </p>
                        </div>
                      )}

                      {/* Day-by-day itinerary — Timeline style */}
                      {resultData.itinerary && resultData.itinerary.length > 0 && (
                        <div className="space-y-12">
                          {resultData.itinerary.map((dayData, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-gray-100 bg-white p-8 shadow-md transition-all duration-300 hover:shadow-xl"
                            >
                              {/* Day header */}
                              <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-6">
                                <h3 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                                  Day {dayData.day ?? idx + 1}
                                </h3>
                                {dayData.areaCovered && (
                                  <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                                    {dayData.areaCovered}
                                  </span>
                                )}
                              </div>

                              {/* Timeline activities */}
                              {dayData.activities && dayData.activities.length > 0 ? (
                                <div className="relative">
                                  <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />
                                  <ul className="space-y-0">
                                    {dayData.activities.map((act, actIdx) => (
                                      <li key={actIdx} className="relative flex gap-6 pb-10 last:pb-0">
                                        <div
                                          className={`relative z-10 mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                            act.timeOfDay === "Morning"   ? "bg-amber-100"  :
                                            act.timeOfDay === "Afternoon" ? "bg-sky-100"    :
                                            "bg-violet-100"
                                          }`}
                                        >
                                          <span
                                            className={`text-xs font-bold ${
                                              act.timeOfDay === "Morning"   ? "text-amber-800"  :
                                              act.timeOfDay === "Afternoon" ? "text-sky-800"    :
                                              "text-violet-800"
                                            }`}
                                          >
                                            {act.timeOfDay?.[0] ?? "•"}
                                          </span>
                                        </div>
                                        <div className="min-w-0 flex-1 rounded-xl border border-gray-50 bg-gray-50/50 p-5">
                                          <div className="mb-1 flex items-center gap-2">
                                            <span
                                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                                                act.timeOfDay === "Morning"   ? "bg-amber-100 text-amber-800"  :
                                                act.timeOfDay === "Afternoon" ? "bg-sky-100 text-sky-800"      :
                                                "bg-violet-100 text-violet-800"
                                              }`}
                                            >
                                              {act.timeOfDay ?? "Activity"}
                                            </span>
                                          </div>
                                          <p className="font-bold text-gray-900">{act.title ?? ""}</p>
                                          {act.shortDescription && (
                                            <p className="mt-2 text-sm leading-relaxed text-gray-600">
                                              {act.shortDescription}
                                            </p>
                                          )}
                                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                                            {act.estimatedDuration && (
                                              <span>⏱ {act.estimatedDuration}</span>
                                            )}
                                            {typeof act.travelTimeFromPrevious === "number" &&
                                              act.travelTimeFromPrevious > 0 && (
                                                <span>🚗 {act.travelTimeFromPrevious} min</span>
                                              )}
                                            {typeof act.entryFee === "number" && (
                                              <span>🎟 {formatCurrency(act.entryFee)}</span>
                                            )}
                                            {typeof act.costIncludedInBudget === "number" && (
                                              <span className="font-semibold text-gray-700">
                                                {formatCurrency(act.costIncludedInBudget)}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                /* Legacy morning / afternoon / evening shape */
                                <ul className="space-y-6">
                                  {dayData.morning?.activity && (
                                    <li className="flex items-start gap-5">
                                      <span className="shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                                        Morning
                                      </span>
                                      <div className="flex-1">
                                        <span className="text-base text-gray-700">{dayData.morning.activity}</span>
                                        {typeof dayData.morning.cost === "number" && (
                                          <span className="ml-2 text-sm font-medium text-gray-500">
                                            {formatCurrency(dayData.morning.cost)}
                                          </span>
                                        )}
                                      </div>
                                    </li>
                                  )}
                                  {dayData.afternoon?.activity && (
                                    <li className="flex items-start gap-5">
                                      <span className="shrink-0 rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-sky-800">
                                        Afternoon
                                      </span>
                                      <div className="flex-1">
                                        <span className="text-base text-gray-700">{dayData.afternoon.activity}</span>
                                        {typeof dayData.afternoon.cost === "number" && (
                                          <span className="ml-2 text-sm font-medium text-gray-500">
                                            {formatCurrency(dayData.afternoon.cost)}
                                          </span>
                                        )}
                                      </div>
                                    </li>
                                  )}
                                  {dayData.evening?.activity && (
                                    <li className="flex items-start gap-5">
                                      <span className="shrink-0 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-violet-800">
                                        Evening
                                      </span>
                                      <div className="flex-1">
                                        <span className="text-base text-gray-700">{dayData.evening.activity}</span>
                                        {typeof dayData.evening.cost === "number" && (
                                          <span className="ml-2 text-sm font-medium text-gray-500">
                                            {formatCurrency(dayData.evening.cost)}
                                          </span>
                                        )}
                                      </div>
                                    </li>
                                  )}
                                </ul>
                              )}

                              {typeof dayData.dailyEstimatedSpend === "number" && (
                                <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
                                  <span className="text-sm font-semibold text-indigo-600">
                                    Day total: {formatCurrency(dayData.dailyEstimatedSpend)}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}

                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
