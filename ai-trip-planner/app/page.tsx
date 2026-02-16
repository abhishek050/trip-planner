"use client";

import { useState, useRef } from "react";

const FEATURES = [
  {
    title: "Smart Budget Optimization",
    description: "AI allocates your budget across flights, stays, and experiences so you get the most value from every dollar.",
    icon: (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-xl">
        $
      </div>
    ),
  },
  {
    title: "Hidden Gems Discovery",
    description: "Go beyond tourist traps. Our AI surfaces local favorites and under-the-radar spots that match your vibe.",
    icon: (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 text-xl">
        ✦
      </div>
    ),
  },
  {
    title: "Personalized Themes",
    description: "Adventure, relaxation, foodie, culture—pick your theme and get itineraries tailored to how you travel.",
    icon: (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-100 to-violet-100 text-xl">
        ◈
      </div>
    ),
  },
];

const THEME_OPTIONS = ["Romantic", "Adventure", "Party", "Family", "Spiritual", "Mixed"];
const STAY_OPTIONS = ["Budget Hotel", "Luxury Hotel", "Airbnb", "No Preference"];

type FormErrors = Record<string, string>;

type BudgetSummary = {
  travel?: number;
  accommodation?: number;
  activities?: number;
  food?: number;
  total?: number;
};

type StayOption = {
  name?: string;
  area?: string;
  type?: string;
  rating?: number;
  cleanlinessScore?: number;
  pricePerNight?: number;
  totalStayCost?: number;
  whyRecommended?: string;
};

type StaySuggestion = {
  name?: string;
  area?: string;
  pricePerNight?: number;
  totalStayCost?: number;
  whyRecommended?: string;
};

type DayActivity = { activity?: string; cost?: number };

type ItineraryActivity = {
  timeOfDay?: string;
  title?: string;
  shortDescription?: string;
  estimatedDuration?: string;
  travelTimeFromPrevious?: number;
  entryFee?: number;
  costIncludedInBudget?: number;
};

type ItineraryDay = {
  day?: number;
  areaCovered?: string;
  morning?: DayActivity;
  afternoon?: DayActivity;
  evening?: DayActivity;
  activities?: ItineraryActivity[];
  dailyEstimatedSpend?: number;
};

type ResultData = {
  budgetSummary?: BudgetSummary;
  stayOptions?: StayOption[];
  staySuggestion?: StaySuggestion;
  hotelSuggestion?: { name?: string; pricePerNight?: number };
  whyThisPlanWorks?: string;
  itinerary?: ItineraryDay[];
};

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString("en-IN")}`;

export default function Home() {
  const [hasResult, setHasResult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<ResultData | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const formSectionRef = useRef<HTMLElement>(null);

  const [fromCity, setFromCity] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [numberOfPersons, setNumberOfPersons] = useState("");
  const [duration, setDuration] = useState("");
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [stayPreference, setStayPreference] = useState("");

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

    if (!fromCity.trim()) nextErrors.fromCity = "From City is required";
    if (!destinationCity.trim()) nextErrors.destinationCity = "Destination City is required";

    const budgetNum = Number(totalBudget);
    if (!totalBudget.trim()) nextErrors.totalBudget = "Total Budget is required";
    else if (isNaN(budgetNum) || budgetNum <= 0) nextErrors.totalBudget = "Must be greater than 0";

    const personsNum = Number(numberOfPersons);
    if (!numberOfPersons.trim()) nextErrors.numberOfPersons = "Number of Persons is required";
    else if (isNaN(personsNum) || personsNum < 1) nextErrors.numberOfPersons = "Must be at least 1";

    const durationNum = Number(duration);
    if (!duration.trim()) nextErrors.duration = "Duration is required";
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
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCity,
          destinationCity,
          totalBudget: totalBudget ? Number(totalBudget) : undefined,
          numberOfPersons: numberOfPersons ? Number(numberOfPersons) : undefined,
          duration: duration ? Number(duration) : undefined,
          selectedThemes,
          stayPreference: stayPreference || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        setResultData(data);
        setHasResult(true);
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
  const inputOkClass = "border-gray-200 hover:border-gray-300 focus:border-transparent";

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

      {/* Hero Section */}
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

      {/* Feature Section */}
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
                <h3 className="mb-2 text-lg font-bold text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-200/60" />

      {/* Form Section */}
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
                {errors.fromCity && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.fromCity}</p>
                )}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Destination City"
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  className={`${inputBaseClass} ${errors.destinationCity ? inputErrorClass : inputOkClass}`}
                />
                {errors.destinationCity && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.destinationCity}</p>
                )}
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
                  {errors.totalBudget && (
                    <p className="mt-1.5 text-sm text-red-600">{errors.totalBudget}</p>
                  )}
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
                  {errors.numberOfPersons && (
                    <p className="mt-1.5 text-sm text-red-600">{errors.numberOfPersons}</p>
                  )}
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
                {errors.duration && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.duration}</p>
                )}
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
                {errors.selectedThemes && (
                  <p className="mt-1.5 text-sm text-red-600">{errors.selectedThemes}</p>
                )}
              </div>
              <select
                value={stayPreference}
                onChange={(e) => setStayPreference(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-5 py-4 text-gray-900 transition-colors duration-200 hover:border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Stay Preference</option>
                {STAY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
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

      {/* Result Section */}
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
                  {isSubmitting ? (
                    <div className="flex flex-col items-center justify-center py-24">
                      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                      <p className="text-lg font-medium text-gray-600">
                        Crafting your premium itinerary...
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Curating stays and experiences for you
                      </p>
                    </div>
                  ) : apiError ? (
                    <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/80 to-rose-50/50 p-10 shadow-sm">
                      <p className="text-center font-semibold text-red-700">
                        {apiError}
                      </p>
                      <p className="mt-2 text-center text-sm text-red-600/80">
                        Please check your connection and try again.
                      </p>
                    </div>
                  ) : resultData ? (
                    <>
                      <h2 className="mb-10 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                        Your AI Generated Itinerary
                      </h2>

                      {/* Why This Plan Works - Top of results */}
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

                      {/* Budget Summary with Progress Bars */}
                      {resultData.budgetSummary && (
                        <div className="mb-10 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
                          <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
                            Budget Breakdown
                          </h3>
                          <div className="space-y-5">
                            {(() => {
                              const bs = resultData.budgetSummary;
                              const total =
                                typeof bs.total === "number" && bs.total > 0 ? bs.total : 1;
                              const items = [
                                {
                                  label: "Travel",
                                  value: bs.travel ?? 0,
                                  color: "bg-blue-500",
                                },
                                {
                                  label: "Accommodation",
                                  value: bs.accommodation ?? 0,
                                  color: "bg-indigo-500",
                                },
                                {
                                  label: "Activities",
                                  value: bs.activities ?? 0,
                                  color: "bg-purple-500",
                                },
                                {
                                  label: "Food",
                                  value: bs.food ?? 0,
                                  color: "bg-amber-500",
                                },
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
                            <span className="font-bold text-gray-900">
                              Total Estimated Cost
                            </span>
                            <span className="text-xl font-bold text-indigo-600">
                              {typeof resultData.budgetSummary.total === "number"
                                ? formatCurrency(resultData.budgetSummary.total)
                                : ""}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Stay Options - 3 side-by-side on desktop */}
                      {resultData.stayOptions && resultData.stayOptions.length > 0 ? (
                        <div className="mb-12">
                          <h3 className="mb-6 text-lg font-bold text-gray-900">
                            Curated Stay Options
                          </h3>
                          {(() => {
                            const stays = resultData.stayOptions;
                            const bestValueIdx = stays.reduce((best, s, i) => {
                              const price = s.pricePerNight ?? Infinity;
                              const bestPrice = stays[best]?.pricePerNight ?? Infinity;
                              return price < bestPrice ? i : best;
                            }, 0);
                            return (
                              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                {stays.map((stay, idx) => (
                                  <div
                                    key={idx}
                                    className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-md transition-all duration-300 hover:shadow-xl"
                                  >
                                    {idx === bestValueIdx && (
                                      <span className="absolute -top-2 right-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow">
                                        Best Value
                                      </span>
                                    )}
                                    <div className="mb-4 h-28 w-full rounded-xl bg-gradient-to-br from-slate-100 to-slate-200" />
                                    <p className="font-semibold text-gray-900">{stay.name ?? ""}</p>
                                    {stay.area && (
                                      <p className="mt-0.5 text-sm text-gray-600">{stay.area}</p>
                                    )}
                                    {stay.type && (
                                      <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                        {stay.type}
                                      </span>
                                    )}
                                    <div className="mt-4 flex flex-wrap gap-3 text-sm">
                                      {typeof stay.rating === "number" && (
                                        <span className="font-medium text-amber-600">
                                          ★ {stay.rating}
                                        </span>
                                      )}
                                      {typeof stay.cleanlinessScore === "number" && (
                                        <span className="text-gray-500">
                                          Clean: {stay.cleanlinessScore}/10
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-4 space-y-1">
                                      {typeof stay.pricePerNight === "number" && (
                                        <p className="text-sm font-semibold text-indigo-600">
                                          {formatCurrency(stay.pricePerNight)} / night
                                        </p>
                                      )}
                                      {typeof stay.totalStayCost === "number" && (
                                        <p className="text-sm text-gray-600">
                                          Total stay: {formatCurrency(stay.totalStayCost)}
                                        </p>
                                      )}
                                    </div>
                                    {stay.whyRecommended && (
                                      <p className="mt-4 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-600">
                                        {stay.whyRecommended}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        /* Legacy: single stay suggestion */
                        (resultData.staySuggestion || resultData.hotelSuggestion) && (
                          <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-8 shadow-lg transition-shadow duration-300 hover:shadow-xl">
                            <h3 className="mb-5 text-lg font-bold text-gray-900">
                              Suggested Stay
                            </h3>
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                              <div className="h-28 w-36 shrink-0 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200" />
                              <div className="min-w-0 flex-1 space-y-2">
                                <p className="font-semibold text-gray-900">
                                  {resultData.staySuggestion?.name ??
                                    resultData.hotelSuggestion?.name ??
                                    ""}
                                </p>
                                {resultData.staySuggestion?.area && (
                                  <p className="text-sm text-gray-600">
                                    {resultData.staySuggestion.area}
                                  </p>
                                )}
                                {(typeof resultData.staySuggestion?.pricePerNight === "number" ||
                                  typeof resultData.hotelSuggestion?.pricePerNight === "number") && (
                                  <p className="text-sm font-medium text-indigo-600">
                                    {formatCurrency(
                                      (resultData.staySuggestion?.pricePerNight ??
                                        resultData.hotelSuggestion?.pricePerNight) as number
                                    )}{" "}
                                    / night
                                  </p>
                                )}
                                {typeof resultData.staySuggestion?.totalStayCost === "number" && (
                                  <p className="text-sm text-gray-600">
                                    Total stay:{" "}
                                    {formatCurrency(resultData.staySuggestion.totalStayCost)}
                                  </p>
                                )}
                                {resultData.staySuggestion?.whyRecommended && (
                                  <p className="mt-3 border-t border-gray-100 pt-3 text-sm leading-relaxed text-gray-600">
                                    {resultData.staySuggestion.whyRecommended}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      )}

                      {/* Day-by-day itinerary - Timeline style */}
                      {resultData.itinerary && resultData.itinerary.length > 0 && (
                        <div className="space-y-12">
                          {resultData.itinerary.map((dayData, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-gray-100 bg-white p-8 shadow-md transition-all duration-300 hover:shadow-xl"
                            >
                              {/* Day header with areaCovered badge */}
                              <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-6">
                                <h3 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                                  Day {dayData.day ?? idx + 1}
                                </h3>
                                <div className="flex flex-wrap items-center gap-3">
                                  {dayData.areaCovered && (
                                    <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                                      {dayData.areaCovered}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Timeline activities */}
                              {dayData.activities && dayData.activities.length > 0 ? (
                                <div className="relative">
                                  {/* Vertical timeline line */}
                                  <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />
                                  <ul className="space-y-0">
                                    {dayData.activities.map((act, actIdx) => (
                                      <li
                                        key={actIdx}
                                        className="relative flex gap-6 pb-10 last:pb-0"
                                      >
                                        {/* Timeline dot */}
                                        <div
                                          className={`relative z-10 mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                            act.timeOfDay === "Morning"
                                              ? "bg-amber-100"
                                              : act.timeOfDay === "Afternoon"
                                                ? "bg-sky-100"
                                                : "bg-violet-100"
                                          }`}
                                        >
                                          <span
                                            className={`text-xs font-bold ${
                                              act.timeOfDay === "Morning"
                                                ? "text-amber-800"
                                                : act.timeOfDay === "Afternoon"
                                                  ? "text-sky-800"
                                                  : "text-violet-800"
                                            }`}
                                          >
                                            {act.timeOfDay?.[0] ?? "•"}
                                          </span>
                                        </div>
                                        <div className="min-w-0 flex-1 rounded-xl border border-gray-50 bg-gray-50/50 p-5">
                                          <div className="mb-1 flex items-center gap-2">
                                            <span
                                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                                                act.timeOfDay === "Morning"
                                                  ? "bg-amber-100 text-amber-800"
                                                  : act.timeOfDay === "Afternoon"
                                                    ? "bg-sky-100 text-sky-800"
                                                    : "bg-violet-100 text-violet-800"
                                              }`}
                                            >
                                              {act.timeOfDay ?? "Activity"}
                                            </span>
                                          </div>
                                          <p className="font-bold text-gray-900">
                                            {act.title ?? ""}
                                          </p>
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
                                /* Legacy: morning/afternoon/evening */
                                <ul className="space-y-6">
                                  {dayData.morning?.activity && (
                                    <li className="flex items-start gap-5">
                                      <span className="shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                                        Morning
                                      </span>
                                      <div className="flex-1">
                                        <span className="text-base text-gray-700">
                                          {dayData.morning.activity}
                                        </span>
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
                                        <span className="text-base text-gray-700">
                                          {dayData.afternoon.activity}
                                        </span>
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
                                        <span className="text-base text-gray-700">
                                          {dayData.evening.activity}
                                        </span>
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

                              {/* Daily estimated spend at bottom */}
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
