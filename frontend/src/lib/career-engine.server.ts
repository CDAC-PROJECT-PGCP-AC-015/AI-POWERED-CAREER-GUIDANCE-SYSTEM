/**
 * ============================================================================
 *  >>> INTEGRATION POINT #1 & #2 — ML MODEL + LLM  <<<
 * ============================================================================
 *
 *  This file is SERVER-ONLY (never bundled to the browser), so it is the safe
 *  place to read API keys. Everything below already works today using the
 *  built-in fallback data, so the whole UI is functional before you plug
 *  anything in.
 *
 *  ---------------------------------------------------------------------------
 *  1) YOUR ML MODEL  ->  see `callCareerModel()` below
 *     Set env var  CAREER_MODEL_URL  (e.g. https://your-model.onrender.com/predict)
 *     Optional     CAREER_MODEL_KEY
 *     Expected response JSON:
 *       { "predictions": [ { "career_id": "software-engineer", "confidence": 0.87 }, ... ] }
 *     `career_id` should match an id in src/lib/career-data.ts (or return a
 *     `title` and it will be slugified). The ML service also exposes
 *     GET {origin}/vocab (derived automatically from CAREER_MODEL_URL) —
 *     see `fetchModelVocab()` below.
 *
 *  2) YOUR LLM  ->  see `callLlm()` below
 *     Primary (required for any LLM feature to work):
 *       LLM_API_KEY, LLM_BASE_URL (default OpenRouter), LLM_MODEL
 *     Secondary / failover (optional, used automatically if the primary
 *     errors, times out, or returns a non-2xx response):
 *       LLM_FALLBACK_API_KEY, LLM_FALLBACK_BASE_URL (default Groq), LLM_FALLBACK_MODEL
 *     Any OpenAI-compatible /chat/completions endpoint works for either slot
 *     (OpenAI, Groq, Together, OpenRouter, Ollama, ...).
 *
 *  3) FEATURE EXTRACTION FOR THE ML MODEL -> see `extractStructuredSignals()`.
 *     Turns the free-text interview transcript into the structured
 *     skills/interests/certifications/internship fields the model was
 *     trained on, constrained to the model's own vocabulary (fetched live
 *     from /vocab) so nothing the LLM invents gets silently dropped.
 *     Marks/CGPA are NOT extracted here — they're collected as exact
 *     numbers at onboarding/Settings and passed straight through.
 *
 *  4) FULL CAREER ENRICHMENT (summary, path, skill gaps, mentors) ->
 *     see `enrichCareerFully()` below. Mentors are grounded in the REAL
 *     mentor directory (fetched from the backend, BACKEND_API_URL) so the
 *     LLM can only ever pick an existing mentor, never invent one.
 *     Optional env var  BACKEND_API_URL  (default: http://localhost:5001/api)
 *
 *  5) LIVE COURSES + COMPANIES -> see `fetchLiveCourses()` / `fetchLiveCompanies()`.
 *     Real, currently-indexed results via Tavily web search (through the
 *     backend's /api/discover/* routes, same TAVILY_API_KEY used for job
 *     postings). When Tavily isn't configured or returns nothing, the
 *     LLM-generated companies/courses from enrichCareerFully() are kept as-is.
 *
 *  Add the env vars via the project's secret manager, then redeploy. No other
 *  file needs to change.
 * ============================================================================
 */

import {
  CAREER_COMPANY_HINTS,
  FALLBACK_CAREERS,
  type AssessmentAnswer,
  type CareerPrediction,
  type Company,
  type Course,
  type Mentor,
  type StudentProfile,
} from "./career-data";

const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-");

type RawPrediction = { career_id?: string; title?: string; confidence: number };

/**
 * Builds honest, non-fabricated guidance for any of the model's 35 career
 * classes that don't have hand-curated content in FALLBACK_CAREERS yet.
 * Crucially this never borrows another career's companies/mentors — it
 * only ever links to real, general-purpose resources (job boards, course
 * search pages), so nothing here can misrepresent a specific employer or
 * mentor as matched to a career it has nothing to do with.
 */
function buildGenericCareer(title: string, id: string, confidence: number): CareerPrediction {
  const query = encodeURIComponent(title);
  // Real, well-known employers for this career (see CAREER_COMPANY_HINTS in
  // career-data.ts) instead of an empty list — package bands are
  // illustrative ranges, not a live/scraped figure.
  const hint = CAREER_COMPANY_HINTS[title];
  const companies: Company[] = hint
    ? hint.companies.map((name, i) => ({
        name,
        role: title,
        openRoles: 3 + ((i * 2 + title.length) % 6),
        location: "Bengaluru / Remote",
        packageRange: hint.packageRange,
        logoHue: (i * 90 + title.length * 7) % 360,
      }))
    : [];
  return {
    id,
    title,
    confidence,
    blurb:
      "A curated deep-dive for this career is still being built — here's general guidance in the meantime.",
    salaryRange: hint?.packageRange ?? "Varies by experience & location",
    demand: confidence >= 70 ? "High" : confidence >= 45 ? "Moderate" : "Emerging",
    aiSummary:
      `${title} was predicted as a strong fit based on your assessment responses, but this ` +
      `career doesn't have a hand-curated guidance page yet. Use the links below to research ` +
      `real openings and courses, and connect with a mentor through the Mentorship page to get ` +
      `advice specific to this path.`,
    companies,
    mentors: [],
    courses: [
      {
        id: `${id}-coursera`,
        title: `${title} courses on Coursera`,
        provider: "Coursera",
        duration: "Varies",
        level: "Beginner",
        reason: "No course is curated for this career yet — search results for the role.",
        url: `https://www.coursera.org/search?query=${query}`,
      },
      {
        id: `${id}-nptel`,
        title: `${title} courses on NPTEL`,
        provider: "NPTEL",
        duration: "Varies",
        level: "Beginner",
        reason: "Government-backed free courses relevant to this career.",
        url: "https://nptel.ac.in/course.html",
      },
    ],
    path: [
      {
        phase: "Phase 1",
        title: "Research the role",
        detail: `Read 3-5 real job descriptions for ${title} to understand day-to-day expectations.`,
        status: "in-progress",
      },
      {
        phase: "Phase 2",
        title: "Build foundational skills",
        detail: "Identify the 2-3 skills that show up most often across those job descriptions.",
        status: "upcoming",
      },
      {
        phase: "Phase 3",
        title: "Build a portfolio piece",
        detail: "Ship one project or writeup that demonstrates those skills concretely.",
        status: "upcoming",
      },
      {
        phase: "Phase 4",
        title: "Get a mentor's perspective",
        detail: "Request a session on the Mentorship page for advice specific to this path.",
        status: "upcoming",
      },
      {
        phase: "Phase 5",
        title: "Apply & interview",
        detail: "Target entry-level or internship roles to build direct experience.",
        status: "goal",
      },
    ],
    skillGaps: [
      {
        skill: "Role-specific knowledge",
        match: Math.round(confidence),
        note: "Based on your assessment responses",
      },
      {
        skill: "Practical experience",
        match: Math.max(20, Math.round(confidence) - 25),
        note: "General estimate — refine with a mentor",
      },
      {
        skill: "Industry exposure",
        match: Math.max(15, Math.round(confidence) - 35),
        note: "General estimate — refine with a mentor",
      },
    ],
  };
}

/** ---- 1. ML MODEL CALL ---------------------------------------------------- */
async function callCareerModel(
  profile: Record<string, unknown>,
  answers: AssessmentAnswer[],
): Promise<RawPrediction[] | null> {
  const url = process.env.CAREER_MODEL_URL;
  if (!url) return null; // not configured yet -> fallback predictions are used

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CAREER_MODEL_KEY
          ? { Authorization: `Bearer ${process.env.CAREER_MODEL_KEY}` }
          : {}),
      },
      body: JSON.stringify({ profile, answers }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Model returned ${res.status}`);
    const json = (await res.json()) as { predictions?: RawPrediction[] };
    return json.predictions?.slice(0, 3) ?? null;
  } catch (err) {
    console.error("[career-model] falling back:", err);
    return null;
  }
}

/**
 * Derives the ML service's GET /vocab URL from CAREER_MODEL_URL, e.g.
 * "https://x.onrender.com/predict" -> "https://x.onrender.com/vocab".
 * Falls back to swapping in "/vocab" on the origin if CAREER_MODEL_URL
 * doesn't end in "/predict" for some reason.
 */
function vocabUrlFrom(modelUrl: string): string {
  if (modelUrl.endsWith("/predict")) return modelUrl.slice(0, -"/predict".length) + "/vocab";
  try {
    return new URL("/vocab", modelUrl).toString();
  } catch {
    return modelUrl;
  }
}

export type ModelVocab = {
  education_level: string[];
  specialization: string[];
  internship_domain: string[];
  skills_tech: string[];
  skills_soft: string[];
  interests: string[];
  certifications: string[];
};

// Module-level cache — the vocabulary only changes when the .pkl is
// retrained/redeployed, so one fetch per server process lifetime is enough.
let cachedVocab: ModelVocab | null = null;

/** Fetches the exact controlled vocabulary the deployed ML model was trained
 *  on, so extractStructuredSignals() can constrain the LLM to values that
 *  actually map onto real feature columns. Returns null if CAREER_MODEL_URL
 *  isn't configured or the service is unreachable — extraction still runs,
 *  just without vocab constraints (ml-service's own keyword-matching
 *  fallback still applies server-side in that case). */
async function fetchModelVocab(): Promise<ModelVocab | null> {
  if (cachedVocab) return cachedVocab;
  const modelUrl = process.env.CAREER_MODEL_URL;
  if (!modelUrl) return null;

  try {
    const res = await fetch(vocabUrlFrom(modelUrl), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`vocab endpoint returned ${res.status}`);
    const json = (await res.json()) as ModelVocab;
    cachedVocab = json;
    return json;
  } catch (err) {
    console.error("[career-model] /vocab unavailable, extraction proceeds unconstrained:", err);
    return null;
  }
}

/** ---- 2. LLM CALL (dual-key failover) ------------------------------------- */

/** One provider slot — either the primary or the fallback. */
type LlmSlot = { apiKey: string; baseUrl: string; model: string; label: string };

function primarySlot(): LlmSlot | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1",
    model: process.env.LLM_MODEL ?? "openai/gpt-4o-mini",
    label: "primary",
  };
}

function fallbackSlot(): LlmSlot | null {
  const apiKey = process.env.LLM_FALLBACK_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.LLM_FALLBACK_BASE_URL ?? "https://api.groq.com/openai/v1",
    model: process.env.LLM_FALLBACK_MODEL ?? "llama-3.3-70b-versatile",
    label: "fallback",
  };
}

async function callSlot(slot: LlmSlot, system: string, user: string): Promise<string> {
  const res = await fetch(`${slot.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${slot.apiKey}`,
    },
    body: JSON.stringify({
      model: slot.model,
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`${slot.label} LLM (${slot.baseUrl}) returned ${res.status}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error(`${slot.label} LLM returned an empty response`);
  return content;
}

/**
 * Calls the LLM with automatic failover: tries the primary provider
 * (OpenRouter by default) first, and — only if that request errors, times
 * out, or comes back non-2xx/empty — retries the exact same prompt against
 * the secondary provider (Groq by default). This exists because OpenRouter
 * occasionally has availability hiccups; Groq is fast and cheap enough to
 * be a safe automatic backup.
 *
 * Returns null (caller keeps its built-in fallback content) only if neither
 * provider is configured, or both attempts fail.
 */
export async function callLlm(system: string, user: string): Promise<string | null> {
  const primary = primarySlot();
  const fallback = fallbackSlot();
  if (!primary && !fallback) return null; // no LLM configured at all

  if (primary) {
    try {
      return await callSlot(primary, system, user);
    } catch (err) {
      console.error("[llm] primary failed, trying fallback if configured:", err);
    }
  }
  if (fallback) {
    try {
      return await callSlot(fallback, system, user);
    } catch (err) {
      console.error("[llm] fallback also failed:", err);
    }
  }
  return null; // both attempts exhausted -> caller's built-in fallback text is used
}

/** ---- 3. STRUCTURED FEATURE EXTRACTION FOR THE ML MODEL ------------------- */

export type ExtractedSignals = {
  specialization?: string;
  skills_tech: string[];
  skills_soft: string[];
  interests: string[];
  certifications: string[];
  has_internship: boolean;
  internship_domain: string | null;
  internship_duration_months: number | null;
  avg_tech_skill_rating: number | null;
  avg_soft_skill_rating: number | null;
};

/**
 * Turns the free-text interview transcript (+ the structured stream/branch/
 * interests already collected at onboarding) into the rich structured
 * fields the ML model was trained on, using ONE LLM call. Everything the
 * LLM outputs is constrained to the model's actual trained vocabulary
 * (fetched via fetchModelVocab()) so results map onto real feature columns
 * instead of being silently dropped as unrecognised values.
 *
 * Marks/CGPA are deliberately NOT part of this — those are exact numbers
 * collected directly from the student at onboarding/Settings and passed
 * straight through in runPrediction() without needing the LLM at all.
 *
 * Returns null if the LLM isn't configured or the response doesn't parse —
 * callCareerModel() still works in that case via ml-service's own
 * keyword-matching fallback over the raw transcript, just less precisely.
 */
async function extractStructuredSignals(
  profile: Partial<StudentProfile>,
  answers: AssessmentAnswer[],
  vocab: ModelVocab | null,
): Promise<ExtractedSignals | null> {
  const system = [
    "You extract structured signals from a student's career-assessment interview for a",
    "machine-learning career-prediction model. You output ONLY strict JSON matching the",
    "given schema — no markdown fences, no commentary.",
    "",
    "Rules:",
    "- For every list/enum field where a controlled vocabulary is provided below, choose",
    "  ONLY values that appear verbatim in that vocabulary. If nothing in the transcript",
    "  clearly supports a value, leave the list empty (or the field null) — never invent",
    "  a plausible-sounding value that isn't in the vocabulary.",
    "- Base every choice strictly on what the student actually said or on their stated",
    "  stream/branch — do not assume skills or interests they never mentioned.",
    "- avg_tech_skill_rating / avg_soft_skill_rating are your best-effort 0-10 estimate of",
    "  the student's overall technical / soft-skill strength, judged only from the",
    "  transcript's tone and content.",
  ].join("\n");

  const schema = `{
  "specialization": "<best match from the specialization vocabulary below, or null if unsure>",
  "skills_tech": ["<subset of skills_tech vocabulary>"],
  "skills_soft": ["<subset of skills_soft vocabulary>"],
  "interests": ["<subset of interests vocabulary>"],
  "certifications": ["<subset of certifications vocabulary, or [] if none mentioned>"],
  "has_internship": true|false,
  "internship_domain": "<one value from internship_domain vocabulary, or null>",
  "internship_duration_months": <number, or null>,
  "avg_tech_skill_rating": <0-10>,
  "avg_soft_skill_rating": <0-10>
}`;

  const vocabBlock = vocab
    ? [
        `specialization vocabulary: ${JSON.stringify(vocab.specialization)}`,
        `skills_tech vocabulary (${vocab.skills_tech.length} values): ${JSON.stringify(vocab.skills_tech)}`,
        `skills_soft vocabulary: ${JSON.stringify(vocab.skills_soft)}`,
        `interests vocabulary (${vocab.interests.length} values): ${JSON.stringify(vocab.interests)}`,
        `certifications vocabulary (${vocab.certifications.length} values): ${JSON.stringify(vocab.certifications)}`,
        `internship_domain vocabulary: ${JSON.stringify(vocab.internship_domain)}`,
      ].join("\n")
    : "No controlled vocabulary is available right now — use your best judgement with concise, conventional terms.";

  const user = [
    `Student: stream=${profile.stream ?? "unknown"}, branch=${profile.branch ?? "unknown"}, year=${profile.year ?? "unknown"}.`,
    `Interests already selected at onboarding: ${(profile.interests ?? []).join(", ") || "none"}.`,
    "",
    "Controlled vocabularies (choose only from these where applicable):",
    vocabBlock,
    "",
    answers.length
      ? `Full interview transcript:\n${answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`).join("\n")}`
      : "No interview transcript is available yet.",
    "",
    `Respond with JSON matching exactly this shape:\n${schema}`,
  ].join("\n");

  const raw = await callLlm(system, user);
  if (!raw) return null;

  try {
    const cleaned = raw.replace(/^```json\s*|^```\s*|```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<ExtractedSignals> & {
      specialization?: string | null;
    };
    return {
      specialization: parsed.specialization ?? undefined,
      skills_tech: Array.isArray(parsed.skills_tech) ? parsed.skills_tech : [],
      skills_soft: Array.isArray(parsed.skills_soft) ? parsed.skills_soft : [],
      interests: Array.isArray(parsed.interests) ? parsed.interests : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      has_internship: !!parsed.has_internship,
      internship_domain: parsed.internship_domain ?? null,
      internship_duration_months:
        typeof parsed.internship_duration_months === "number"
          ? parsed.internship_duration_months
          : null,
      avg_tech_skill_rating:
        typeof parsed.avg_tech_skill_rating === "number" ? parsed.avg_tech_skill_rating : null,
      avg_soft_skill_rating:
        typeof parsed.avg_soft_skill_rating === "number" ? parsed.avg_soft_skill_rating : null,
    };
  } catch (err) {
    console.error(
      "[extractStructuredSignals] could not parse LLM response, skipping extraction:",
      err,
    );
    return null;
  }
}

/**
 * Merges the raw profile (stream/branch/marks/CGPA — collected directly,
 * no LLM involved) with the LLM-extracted signals (skills/interests/certs/
 * internship — derived from the free-text interview) into the exact
 * snake_case shape ml-service's Profile model expects. Original camelCase
 * fields are also included for backward compatibility (ml-service's Config
 * has extra="allow", so unrecognised keys are harmless).
 */
function toModelProfile(
  profile: Partial<StudentProfile>,
  extracted: ExtractedSignals | null,
): Record<string, unknown> {
  return {
    // Passed through as-is for any legacy consumer of the raw shape.
    name: profile.name,
    email: profile.email,
    role: profile.role,
    stream: profile.stream,
    year: profile.year,
    branch: profile.branch,
    interests: extracted?.interests?.length ? extracted.interests : (profile.interests ?? []),
    strengths: profile.strengths ?? {},

    // Rich, snake_case fields the ML model was actually trained on.
    education_level: profile.stream, // aligned to the model's vocab at onboarding — see EDUCATION_LEVELS
    specialization: extracted?.specialization || profile.branch,
    marks_10th_percent: profile.marks10thPercent ?? null,
    marks_12th_percent: profile.marks12thPercent ?? null,
    graduation_cgpa: profile.graduationCgpa ?? null,
    postgrad_cgpa: profile.postgradCgpa ?? null,
    skills_tech: extracted?.skills_tech ?? [],
    skills_soft: extracted?.skills_soft ?? [],
    certifications: extracted?.certifications ?? [],
    has_internship: extracted?.has_internship ?? false,
    internship_domain: extracted?.internship_domain ?? null,
    internship_duration_months: extracted?.internship_duration_months ?? null,
    avg_tech_skill_rating: extracted?.avg_tech_skill_rating ?? null,
    avg_soft_skill_rating: extracted?.avg_soft_skill_rating ?? null,
  };
}

/** ---- 4. FULL CAREER ENRICHMENT (summary + path + skill gaps + mentors) --- */

/** Minimal shape of what GET {BACKEND_API_URL}/mentors returns (server/src/routes/mentors.ts). */
type BackendMentorRow = {
  id: string;
  title: string | null;
  company: string | null;
  expertiseTags: string[];
  bio: string | null;
};

/** Fetches the REAL mentor directory from the backend for this career, so the LLM
 *  below can be constrained to only ever pick a mentor that actually exists. */
async function fetchRealMentors(careerTitle: string): Promise<Mentor[]> {
  const base = process.env.BACKEND_API_URL ?? "http://localhost:5001/api";
  try {
    const res = await fetch(`${base}/mentors?career=${encodeURIComponent(careerTitle)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { mentors?: (BackendMentorRow & { fullName?: string })[] };
    return (json.mentors ?? []).map((m) => ({
      id: m.id,
      name: m.fullName ?? "Mentor",
      title: m.title ?? "Mentor",
      company: m.company ?? "",
      match: 75,
      expertise: m.expertiseTags ?? [],
      bio: m.bio ?? "",
      avatar: "",
    }));
  } catch {
    return []; // backend not running / unreachable -> enrichment proceeds with zero mentors
  }
}

/** ---- 5. LIVE COURSES + COMPANIES (Tavily, via the backend) --------------- */

/** Fetches real, currently-indexed courses for this career title from the
 *  backend's Tavily-backed /api/discover/courses. Returns null if
 *  BACKEND_API_URL is unreachable, TAVILY_API_KEY isn't configured, or
 *  nothing relevant was found — callers keep whatever content they already
 *  have (LLM-generated or curated) in that case. */
async function fetchLiveCourses(title: string): Promise<Course[] | null> {
  const base = process.env.BACKEND_API_URL ?? "http://localhost:5001/api";
  try {
    const res = await fetch(`${base}/discover/courses?title=${encodeURIComponent(title)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      live?: boolean;
      courses?: { id: string; title: string; provider: string; url: string }[];
    };
    if (!json.live || !json.courses?.length) return null;
    return json.courses.map((c) => ({
      id: c.id,
      title: c.title,
      provider: c.provider,
      duration: "See course page",
      level: "Beginner" as const,
      reason: "Live result from web search — verify details on the course page.",
      url: c.url,
    }));
  } catch {
    return null;
  }
}

/** Fetches real companies currently hiring for this role from the backend's
 *  Tavily-backed /api/discover/companies. Returns null on the same
 *  not-configured / no-results conditions as fetchLiveCourses(). */
async function fetchLiveCompanies(title: string): Promise<Company[] | null> {
  const base = process.env.BACKEND_API_URL ?? "http://localhost:5001/api";
  try {
    const res = await fetch(`${base}/discover/companies?role=${encodeURIComponent(title)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      live?: boolean;
      companies?: { name: string; role: string }[];
    };
    if (!json.live || !json.companies?.length) return null;
    return json.companies.map((c, i) => ({
      name: c.name,
      role: c.role,
      // We don't have a real open-roles count or package figure from search
      // results, so these stay honest/illustrative rather than fabricated —
      // the per-company JobOpenings widget on the career page does the real
      // live job-count lookup for whichever company the student clicks into.
      openRoles: 0,
      location: "India / Remote",
      packageRange: "Varies by experience & location",
      logoHue: (i * 90 + c.name.length * 7) % 360,
    }));
  } catch {
    return null;
  }
}

type EnrichmentResult = {
  aiSummary: string;
  path: CareerPrediction["path"];
  skillGaps: CareerPrediction["skillGaps"];
  companies: CareerPrediction["companies"];
  courses: CareerPrediction["courses"];
  mentorIds: string[]; // ids chosen from the real list — never full objects
};

/**
 * Generates the full rich content for one predicted career in a single LLM call:
 * narrative summary, a 5-step career path, skill gaps, realistic target
 * companies + typical package bands, real courses/certifications, and a
 * shortlist of mentors — the last of which is grounded in your own mentor
 * directory (`availableMentors`) so the model can only pick an id that is
 * actually in that list, never invent a person.
 *
 * The companies/courses this produces are a fallback layer: runPrediction()
 * tries to replace them with real, live Tavily search results afterwards
 * (see fetchLiveCourses/fetchLiveCompanies above), and only keeps what's
 * generated here if that live lookup isn't configured or comes up empty.
 *
 * Returns null (caller keeps existing curated/generic content) if the LLM
 * isn't configured or the response doesn't parse as valid JSON.
 */
export async function enrichCareerFully(
  career: Pick<CareerPrediction, "title" | "confidence" | "skillGaps">,
  profile: Partial<StudentProfile>,
  answers: AssessmentAnswer[],
  availableMentors: Mentor[],
): Promise<EnrichmentResult | null> {
  const system = [
    "You are CareerAI, a career-guidance content generator for C-DAC Bangalore engineering",
    "students. You output ONLY strict JSON matching the schema given — no markdown code",
    "fences, no commentary before or after.",
    "",
    "Honesty rules you must follow:",
    '- "companies": name 4 REAL, well-known companies that plausibly hire for this exact',
    '  role in India. "packageRange" must be phrased as a typical/illustrative band (e.g.',
    '  "₹12L – ₹22L"), since you do not have live job-board data — never imply it is a',
    '  current live listing, and never invent an exact "X open roles" count beyond a',
    "  reasonable illustrative small integer.",
    '- "courses": name REAL, existing courses or certifications (Coursera, NPTEL, Udemy,',
    "  edX, official vendor certifications, etc.) with the correct provider name. If you are",
    "  not fully certain a URL is exact, use that provider's search/course-listing domain",
    "  root instead of guessing a deep link.",
    '- "mentorIds": choose ONLY from the `availableMentors` list given to you, by id. If',
    "  none of them are a good fit, or the list is empty, return an empty array — do NOT",
    "  invent a mentor or use a mentor from your own knowledge.",
  ].join("\n");

  const schema = `{
  "aiSummary": "3-4 sentences, plain prose, no markdown",
  "path": [
    { "phase": "Phase 1", "title": "...", "detail": "...", "status": "in-progress" },
    { "phase": "Phase 2", "title": "...", "detail": "...", "status": "upcoming" },
    { "phase": "Phase 3", "title": "...", "detail": "...", "status": "upcoming" },
    { "phase": "Phase 4", "title": "...", "detail": "...", "status": "upcoming" },
    { "phase": "Phase 5", "title": "...", "detail": "...", "status": "goal" }
  ],
  "skillGaps": [ { "skill": "...", "match": 0-100, "note": "..." }, ... 3 items ],
  "companies": [
    { "name": "...", "role": "...", "openRoles": 1-30, "location": "...", "packageRange": "₹XL – ₹YL" }, ... 4 items
  ],
  "courses": [
    { "id": "kebab-case-id", "title": "...", "provider": "...", "duration": "...", "level": "Beginner|Intermediate|Advanced", "reason": "...", "url": "https://..." }, ... 3 items
  ],
  "mentorIds": ["<id from availableMentors, or omit entirely if none fit>"]
}`;

  const user = [
    `Student: ${profile.name ?? "Student"} — ${profile.branch ?? "Computer Science"}, ${profile.year ?? "final year"}.`,
    `Predicted career: ${career.title} at ${career.confidence}% model confidence.`,
    `Detected skill gaps so far: ${career.skillGaps.map((g) => `${g.skill} (${g.match}%)`).join(", ") || "none yet"}.`,
    answers.length
      ? `Interview highlights:\n${answers
          .slice(0, 6)
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n")}`
      : "",
    `availableMentors (JSON — pick zero or more ids from here ONLY):\n${JSON.stringify(
      availableMentors.map((m) => ({
        id: m.id,
        name: m.name,
        title: m.title,
        expertise: m.expertise,
      })),
    )}`,
    `Respond with JSON matching exactly this shape:\n${schema}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await callLlm(system, user);
  if (!raw) return null;

  try {
    const cleaned = raw.replace(/^```json\s*|^```\s*|```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<EnrichmentResult> & { mentorIds?: string[] };
    if (!parsed.aiSummary || !Array.isArray(parsed.path) || !Array.isArray(parsed.companies)) {
      throw new Error("missing required fields");
    }
    return {
      aiSummary: parsed.aiSummary,
      path: parsed.path as CareerPrediction["path"],
      skillGaps: (parsed.skillGaps as CareerPrediction["skillGaps"]) ?? career.skillGaps,
      companies: (parsed.companies as CareerPrediction["companies"]) ?? [],
      courses: (parsed.courses as CareerPrediction["courses"]) ?? [],
      mentorIds: Array.isArray(parsed.mentorIds) ? parsed.mentorIds : [],
    };
  } catch (err) {
    console.error(
      "[enrichCareerFully] could not parse LLM response, keeping fallback content:",
      err,
    );
    return null;
  }
}

/** Resolve a model prediction id onto the rich catalogue entry, or build
 *  generic (never mismatched) guidance if this career isn't curated yet. */
function hydrate(raw: RawPrediction, index: number): CareerPrediction {
  const id = raw.career_id ?? (raw.title ? slug(raw.title) : `career-${index}`);
  const confidence =
    raw.confidence > 1 ? Math.round(raw.confidence) : Math.round(raw.confidence * 100);
  const curated = FALLBACK_CAREERS.find((c) => c.id === id);
  if (curated) {
    return { ...curated, title: raw.title ?? curated.title, confidence };
  }
  return buildGenericCareer(raw.title ?? id, id, confidence);
}

export async function runPrediction(
  profile: Partial<StudentProfile>,
  answers: AssessmentAnswer[],
): Promise<CareerPrediction[]> {
  // 1. Turn the free-text interview into structured ML features, constrained
  //    to the model's real trained vocabulary. Marks/CGPA need no LLM step —
  //    they're exact numbers already sitting on `profile`.
  const vocab = await fetchModelVocab();
  const extracted = await extractStructuredSignals(profile, answers, vocab);
  const modelProfile = toModelProfile(profile, extracted);

  const raw = await callCareerModel(modelProfile, answers);
  const careers = raw?.length ? raw.map(hydrate) : FALLBACK_CAREERS.map((c) => ({ ...c }));

  const enriched = await Promise.all(
    careers.slice(0, 3).map(async (career) => {
      const availableMentors = await fetchRealMentors(career.title);
      const rich = await enrichCareerFully(career, profile, answers, availableMentors);

      // Real, currently-live search results take priority over the LLM's
      // general-knowledge companies/courses when Tavily has something —
      // falls back to whatever `rich` (or the curated/generic career) had.
      const [liveCourses, liveCompanies] = await Promise.all([
        fetchLiveCourses(career.title),
        fetchLiveCompanies(career.title),
      ]);

      if (!rich) {
        return {
          ...career,
          courses: liveCourses ?? career.courses,
          companies: liveCompanies ?? career.companies,
        };
      }

      const mentors = rich.mentorIds
        .map((id) => availableMentors.find((m) => m.id === id))
        .filter((m): m is Mentor => !!m);

      return {
        ...career,
        aiSummary: rich.aiSummary,
        path: rich.path,
        skillGaps: rich.skillGaps,
        companies: liveCompanies ?? rich.companies,
        courses: liveCourses ?? rich.courses,
        // Only replace mentors if the LLM actually matched someone real; otherwise
        // keep whatever curated/generic mentor content the career already had.
        mentors: mentors.length ? mentors : career.mentors,
      };
    }),
  );

  return enriched.sort((a, b) => b.confidence - a.confidence);
}

export async function runAssistantReply(
  history: { role: "user" | "assistant"; content: string }[],
  nextQuestion: string | null,
): Promise<string> {
  const llm = await callLlm(
    "You are CareerAI, an interviewer assessing an engineering student's career fit. Acknowledge their answer in one short sentence, then ask the next question verbatim. Keep it warm and under 60 words.",
    [
      history
        .slice(-6)
        .map((m) => `${m.role === "user" ? "Student" : "CareerAI"}: ${m.content}`)
        .join("\n"),
      nextQuestion
        ? `Next question to ask verbatim: "${nextQuestion}"`
        : "The interview is complete. Tell the student you're now analysing their responses.",
    ].join("\n\n"),
  );
  if (llm) return llm;

  // Fallback interviewer (works with zero configuration)
  if (!nextQuestion) {
    return "That's everything I need — thank you. I'm handing your responses to the prediction model now.";
  }
  const ack = [
    "Got it, that's useful context.",
    "Thanks — noted.",
    "That tells me a lot about how you work.",
    "Understood, I've logged that.",
  ][history.length % 4];
  return `${ack} ${nextQuestion}`;
}
