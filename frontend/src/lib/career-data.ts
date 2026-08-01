/**
 * Shared career domain types + the built-in fallback catalogue.
 * Client-safe (no secrets, no server-only imports).
 */

export type Company = {
  name: string;
  role: string;
  openRoles: number;
  location: string;
  /** Typical/illustrative package band, e.g. "₹18L – ₹30L" — not a live job-board figure. */
  packageRange: string;
  logoHue: number;
};

/**
 * Real, always-valid "current openings" links for a company + role — built
 * as job-board SEARCH deep links rather than trying to fetch/guess a
 * specific posting URL. A specific job-posting link (via an LLM or a
 * scraper) goes stale within days and job boards actively block scraping,
 * so a fabricated "exact" link is worse than no link — it either 404s or,
 * worse, an LLM hallucinates one that never existed. A search link is
 * guaranteed to load and always shows whatever is currently open.
 */
export function jobSearchLinks(company: string, role: string): { label: string; url: string }[] {
  const q = encodeURIComponent(`${role} ${company}`);
  const roleOnly = encodeURIComponent(role);
  const companySlug = encodeURIComponent(company);
  return [
    { label: "LinkedIn", url: `https://www.linkedin.com/jobs/search/?keywords=${q}` },
    { label: "Naukri", url: `https://www.naukri.com/${encodeURIComponent(role.toLowerCase().replace(/\s+/g, "-"))}-jobs-in-${encodeURIComponent(company.toLowerCase().replace(/\s+/g, "-"))}?k=${roleOnly}&l=${companySlug}` },
    { label: "Indeed", url: `https://www.indeed.com/jobs?q=${q}` },
  ];
}

export type Mentor = {
  id: string;
  name: string;
  title: string;
  company: string;
  match: number;
  expertise: string[];
  bio: string;
  avatar: string;
};

export type Course = {
  id: string;
  title: string;
  provider: string;
  duration: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  reason: string;
  url: string;
};

export type PathStage = {
  phase: string;
  title: string;
  detail: string;
  status: "completed" | "in-progress" | "upcoming" | "goal";
};

export type SkillGap = {
  skill: string;
  match: number;
  note: string;
};

export type CareerPrediction = {
  id: string;
  title: string;
  confidence: number;
  blurb: string;
  salaryRange: string;
  demand: string;
  /** Filled by the LLM (or the built-in fallback text). */
  aiSummary: string;
  companies: Company[];
  mentors: Mentor[];
  courses: Course[];
  path: PathStage[];
  skillGaps: SkillGap[];
};

export type AssessmentAnswer = { question: string; answer: string };

export type StudentProfile = {
  name: string;
  email: string;
  role: "student" | "mentor" | "admin";
  stream: string;
  year: string;
  branch: string;
  interests: string[];
  strengths: Record<string, number>;
  // Academic fields — collected at onboarding, editable later in Settings.
  // Optional because older accounts / mentors / admins won't have these.
  // Sent straight through to the ML model (see career-engine.server.ts)
  // since they're exact numbers already, no LLM extraction needed for them.
  marks10thPercent?: number;
  marks12thPercent?: number;
  graduationCgpa?: number;
  postgradCgpa?: number;
};

export const ASSESSMENT_AREAS = [
  { id: "academic", label: "Academic Background", questions: 3 },
  { id: "interests", label: "Core Interests", questions: 3 },
  { id: "technical", label: "Technical Skills", questions: 4 },
  { id: "soft", label: "Soft Skills", questions: 3 },
  { id: "goals", label: "Career Goals", questions: 2 },
] as const;

export const ASSESSMENT_QUESTIONS: { area: string; text: string }[] = [
  {
    area: "academic",
    text: "Tell me about your favourite subjects and which topics inside them engaged you most.",
  },
  {
    area: "academic",
    text: "Which academic project are you proudest of, and what was your exact contribution?",
  },
  {
    area: "academic",
    text: "How do you usually prepare for a difficult technical exam or evaluation?",
  },
  {
    area: "interests",
    text: "When you have free study time, what do you naturally gravitate towards building or reading?",
  },
  {
    area: "interests",
    text: "Do you prefer working close to data, close to systems, or close to users? Why?",
  },
  {
    area: "interests",
    text: "Name a product or tool you admire and explain what you'd change about it.",
  },
  {
    area: "technical",
    text: "Which programming languages are you most fluent in, and what have you shipped with them?",
  },
  {
    area: "technical",
    text: "How comfortable are you with data structures and algorithmic problem solving?",
  },
  {
    area: "technical",
    text: "Describe your experience with databases, APIs, or cloud infrastructure.",
  },
  {
    area: "technical",
    text: "Have you worked with machine learning, statistics, or data analysis? Give an example.",
  },
  {
    area: "soft",
    text: "Describe a time you had to explain something technical to a non-technical person.",
  },
  { area: "soft", text: "How do you handle disagreement inside a project team?" },
  { area: "soft", text: "What does a productive week look like for you?" },
  {
    area: "goals",
    text: "Where would you like to be professionally three years after graduating?",
  },
  {
    area: "goals",
    text: "What kind of company culture do you want — startup speed, or large-scale depth?",
  },
];

/**
 * Academic-stream options shown at onboarding, mapped 1:1 to the exact
 * strings the ML model was trained on (see ml-service's `/vocab` ->
 * education_level). Using anything else (e.g. the old "B.Tech / B.E."
 * combined option) means the model's one-hot encoder can't match it and
 * the whole field silently falls into an "Other" bucket, losing signal —
 * so `value` here must stay exactly in sync with the model's vocabulary.
 * Post-graduate options (M.Tech, MBA, ...) are intentionally not offered:
 * every career this model predicts targets UG-entry roles.
 */
export const EDUCATION_LEVELS: { value: string; label: string }[] = [
  { value: "B.Tech", label: "B.Tech" },
  { value: "B.E", label: "B.E." },
  { value: "BCA", label: "BCA" },
  { value: "MCA", label: "MCA" },
  { value: "Diploma", label: "Diploma (Engineering)" },
];

/**
 * Suggestions (not a hard restriction) for the free-text "Specialization /
 * Branch" field, taken from the model's trained specialization vocabulary.
 * Shown via a <datalist> so typing something that matches exactly gives the
 * model a real feature to use, while anyone whose branch isn't listed can
 * still type freely — career-engine.server.ts's LLM extraction step also
 * tries to normalise whatever was typed onto this same list as a backstop.
 */
export const SPECIALIZATION_SUGGESTIONS = [
  "Computer Science",
  "Information Technology",
  "Electronics & Communication",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Data Science",
  "Artificial Intelligence",
  "Computer Applications",
  "Robotics",
  "Design",
  "Game Design",
  "Product Management",
  "Business Administration",
  "Finance",
  "Accounting",
  "Economics",
  "Mass Communication",
  "English",
];

const MENTORS: Record<string, Mentor[]> = {
  "software-engineer": [
    {
      id: "m1",
      name: "Priya Menon",
      title: "Senior Software Engineer",
      company: "Google",
      match: 95,
      expertise: ["System Design", "Distributed Systems", "Java"],
      bio: "I've interviewed 200+ candidates for SDE roles. I help students turn academic projects into portfolio-grade systems.",
      avatar: "PM",
    },
    {
      id: "m2",
      name: "Rahul Iyer",
      title: "Staff Engineer",
      company: "Atlassian",
      match: 88,
      expertise: ["Backend", "Kubernetes", "Go"],
      bio: "Ex-C-DAC. Happy to review resumes, do mock system design rounds and talk about scaling backends.",
      avatar: "RI",
    },
  ],
  "data-scientist": [
    {
      id: "m3",
      name: "Dr. Ananya Rao",
      title: "Lead Data Scientist",
      company: "Flipkart",
      match: 92,
      expertise: ["Statistics", "Forecasting", "Python"],
      bio: "I focus on the applied-statistics gap most students carry. Bring your notebooks and we'll dissect them.",
      avatar: "AR",
    },
    {
      id: "m4",
      name: "Vikram Shetty",
      title: "Analytics Manager",
      company: "Swiggy",
      match: 84,
      expertise: ["SQL", "Experimentation", "Product Analytics"],
      bio: "Analytics hiring manager. I coach on case rounds and metric-thinking for data roles.",
      avatar: "VS",
    },
  ],
  "ml-engineer": [
    {
      id: "m5",
      name: "Sarah Jenkins",
      title: "Senior Machine Learning Engineer",
      company: "Tech Innovations Inc.",
      match: 93,
      expertise: ["Machine Learning", "Python", "Data Architecture"],
      bio: "I specialize in scaling ML models for enterprise applications. Always happy to review resumes or run mock technical interviews.",
      avatar: "SJ",
    },
    {
      id: "m6",
      name: "Karthik Nair",
      title: "MLOps Engineer",
      company: "Nvidia",
      match: 86,
      expertise: ["MLOps", "CUDA", "Model Serving"],
      bio: "From notebook to production. I mentor on deployment, monitoring and inference optimisation.",
      avatar: "KN",
    },
  ],
};

export const FALLBACK_CAREERS: CareerPrediction[] = [
  {
    id: "software-engineer",
    title: "Software Engineer",
    confidence: 87,
    blurb: "High alignment with your core algorithmic skills and recent project work.",
    salaryRange: "₹8L – ₹24L",
    demand: "Very High",
    aiSummary:
      "Your profile shows top-tier analytical reasoning and systematic problem solving, with strong data structures and language fluency. Backend systems and data infrastructure are your natural entry points. The single highest-leverage move is closing your system design and cloud deployment gap — that is what separates SDE-1 offers from SDE-2 trajectories.",
    companies: [
      {
        name: "Google",
        role: "Software Engineer L3",
        openRoles: 12,
        location: "Bangalore",
        packageRange: "₹28L – ₹45L",
        logoHue: 220,
      },
      {
        name: "Microsoft",
        role: "SDE 1",
        openRoles: 8,
        location: "Hyderabad",
        packageRange: "₹18L – ₹30L",
        logoHue: 200,
      },
      {
        name: "Atlassian",
        role: "Backend Engineer",
        openRoles: 5,
        location: "Bangalore",
        packageRange: "₹22L – ₹38L",
        logoHue: 250,
      },
      {
        name: "Zoho",
        role: "Member Technical Staff",
        openRoles: 20,
        location: "Chennai",
        packageRange: "₹10L – ₹18L",
        logoHue: 10,
      },
    ],
    mentors: MENTORS["software-engineer"],
    courses: [
      {
        id: "c1",
        title: "AWS Cloud Practitioner",
        provider: "AWS Skill Builder",
        duration: "6 Weeks",
        level: "Beginner",
        reason: "Improve your Cloud Architecture fundamentals.",
        url: "https://aws.amazon.com/training/",
      },
      {
        id: "c2",
        title: "Grokking System Design",
        provider: "DesignGurus",
        duration: "8 Weeks",
        level: "Intermediate",
        reason: "Directly targets your largest detected skill gap.",
        url: "https://www.designgurus.io/",
      },
      {
        id: "c3",
        title: "CI/CD with GitHub Actions",
        provider: "GitHub Learn",
        duration: "2 Weeks",
        level: "Beginner",
        reason: "Shows shipping discipline on your portfolio projects.",
        url: "https://docs.github.com/actions",
      },
    ],
    path: [
      {
        phase: "Phase 1",
        title: "Strengthen DSA",
        detail: "Completed LeetCode Blind 75 list.",
        status: "completed",
      },
      {
        phase: "Phase 2",
        title: "Build 2 Portfolio Projects",
        detail: "Focus on full-stack web applications with React and Node.",
        status: "in-progress",
      },
      {
        phase: "Phase 3",
        title: "AWS/GCP Certification",
        detail: "Prepare for AWS Cloud Practitioner.",
        status: "upcoming",
      },
      {
        phase: "Phase 4",
        title: "Apply to Mid-tier",
        detail: "Target startups and mid-sized tech companies for interview practice.",
        status: "upcoming",
      },
      {
        phase: "Phase 5",
        title: "Target FAANG",
        detail: "Final interview preparation and referrals.",
        status: "goal",
      },
    ],
    skillGaps: [
      { skill: "Data Structures", match: 80, note: "High demand" },
      { skill: "System Design", match: 45, note: "Critical for target roles" },
      { skill: "Cloud Architecture", match: 20, note: "Good to have" },
    ],
  },
  {
    id: "data-scientist",
    title: "Data Scientist",
    confidence: 76,
    blurb: "Strong potential, requires further development in advanced statistical modelling.",
    salaryRange: "₹9L – ₹28L",
    demand: "High",
    aiSummary:
      "You bring quantitative comfort and clean logical structure, which maps well onto data science. The gap is applied statistics: you reason well about code but less about uncertainty. Prioritise inferential statistics and experiment design, then convert two existing projects into end-to-end analyses with a written conclusion.",
    companies: [
      {
        name: "Flipkart",
        role: "Data Scientist I",
        openRoles: 6,
        location: "Bangalore",
        packageRange: "₹15L – ₹28L",
        logoHue: 45,
      },
      {
        name: "Swiggy",
        role: "Analytics Scientist",
        openRoles: 4,
        location: "Bangalore",
        packageRange: "₹14L – ₹24L",
        logoHue: 30,
      },
      {
        name: "Fractal",
        role: "Junior Data Scientist",
        openRoles: 15,
        location: "Mumbai",
        packageRange: "₹9L – ₹16L",
        logoHue: 280,
      },
      {
        name: "Mu Sigma",
        role: "Decision Scientist",
        openRoles: 25,
        location: "Bangalore",
        packageRange: "₹8L – ₹14L",
        logoHue: 190,
      },
    ],
    mentors: MENTORS["data-scientist"],
    courses: [
      {
        id: "c4",
        title: "Advanced Statistics for ML",
        provider: "Stanford Online",
        duration: "4 Weeks",
        level: "Intermediate",
        reason: "Bridge your knowledge gap for Data Scientist roles.",
        url: "https://online.stanford.edu/",
      },
      {
        id: "c5",
        title: "SQL for Data Analysis",
        provider: "Mode Analytics",
        duration: "3 Weeks",
        level: "Beginner",
        reason: "Every data interview starts with SQL screening.",
        url: "https://mode.com/sql-tutorial/",
      },
      {
        id: "c6",
        title: "Applied Machine Learning in Python",
        provider: "Coursera",
        duration: "6 Weeks",
        level: "Intermediate",
        reason: "Turns theory into deployable notebooks.",
        url: "https://www.coursera.org/",
      },
    ],
    path: [
      {
        phase: "Phase 1",
        title: "Python + Pandas Fluency",
        detail: "Daily data-wrangling reps on public datasets.",
        status: "completed",
      },
      {
        phase: "Phase 2",
        title: "Statistics Foundation",
        detail: "Hypothesis testing, regression, and confidence intervals.",
        status: "in-progress",
      },
      {
        phase: "Phase 3",
        title: "End-to-End Case Study",
        detail: "Ship one analysis with a written business recommendation.",
        status: "upcoming",
      },
      {
        phase: "Phase 4",
        title: "Kaggle Competition",
        detail: "Top 20% finish on a tabular competition.",
        status: "upcoming",
      },
      {
        phase: "Phase 5",
        title: "Data Scientist Offer",
        detail: "Product-analytics and case interview rounds.",
        status: "goal",
      },
    ],
    skillGaps: [
      { skill: "Python & Pandas", match: 78, note: "Solid base" },
      { skill: "Applied Statistics", match: 42, note: "Critical for target roles" },
      { skill: "Experiment Design", match: 25, note: "Frequently interviewed" },
    ],
  },
  {
    id: "ml-engineer",
    title: "ML Engineer",
    confidence: 61,
    blurb: "Emerging fit — strong engineering base, limited production ML exposure.",
    salaryRange: "₹12L – ₹35L",
    demand: "High",
    aiSummary:
      "ML engineering rewards people who can both train and ship. Your engineering fundamentals are the hard part and you already have them; the missing half is model lifecycle work — serving, monitoring and evaluation. One deployed model with a live endpoint and a metrics dashboard will move this match band significantly.",
    companies: [
      {
        name: "Nvidia",
        role: "ML Engineer",
        openRoles: 3,
        location: "Pune",
        packageRange: "₹20L – ₹40L",
        logoHue: 130,
      },
      {
        name: "Amazon",
        role: "Applied Scientist I",
        openRoles: 7,
        location: "Bangalore",
        packageRange: "₹24L – ₹42L",
        logoHue: 40,
      },
      {
        name: "Sarvam AI",
        role: "ML Engineer",
        openRoles: 2,
        location: "Bangalore",
        packageRange: "₹15L – ₹26L",
        logoHue: 300,
      },
      {
        name: "Tredence",
        role: "ML Engineer",
        openRoles: 9,
        location: "Bangalore",
        packageRange: "₹12L – ₹20L",
        logoHue: 170,
      },
    ],
    mentors: MENTORS["ml-engineer"],
    courses: [
      {
        id: "c7",
        title: "Machine Learning Engineering for Production",
        provider: "DeepLearning.AI",
        duration: "8 Weeks",
        level: "Advanced",
        reason: "Covers the exact MLOps gap detected in your profile.",
        url: "https://www.deeplearning.ai/",
      },
      {
        id: "c8",
        title: "Docker & Kubernetes Essentials",
        provider: "Linux Foundation",
        duration: "4 Weeks",
        level: "Intermediate",
        reason: "Model serving requires container fluency.",
        url: "https://training.linuxfoundation.org/",
      },
      {
        id: "c9",
        title: "Deep Learning Specialization",
        provider: "Coursera",
        duration: "12 Weeks",
        level: "Advanced",
        reason: "Deepens the modelling half of the role.",
        url: "https://www.coursera.org/",
      },
    ],
    path: [
      {
        phase: "Phase 1",
        title: "Core ML Theory",
        detail: "Supervised learning, evaluation metrics, regularisation.",
        status: "completed",
      },
      {
        phase: "Phase 2",
        title: "Train & Version a Model",
        detail: "Use MLflow or Weights & Biases for tracking.",
        status: "in-progress",
      },
      {
        phase: "Phase 3",
        title: "Deploy an Inference API",
        detail: "FastAPI + Docker + a managed GPU or CPU endpoint.",
        status: "upcoming",
      },
      {
        phase: "Phase 4",
        title: "Monitoring & Drift",
        detail: "Add latency, accuracy and drift dashboards.",
        status: "upcoming",
      },
      {
        phase: "Phase 5",
        title: "ML Engineer Offer",
        detail: "Coding + ML system design interview loop.",
        status: "goal",
      },
    ],
    skillGaps: [
      { skill: "Model Training", match: 65, note: "Developing well" },
      { skill: "MLOps & Serving", match: 30, note: "Critical for target roles" },
      { skill: "Deep Learning", match: 38, note: "High demand" },
    ],
  },
];

export const DEFAULT_STRENGTHS: Record<string, number> = {
  "Core Programming": 92,
  "System Design": 85,
  "Machine Learning": 70,
  "Cloud Architecture": 55,
};

/**
 * The actual 31-class career taxonomy the trained career_xgboost_model.pkl
 * predicts over (see ml-service/app.py / career_guidance_model.ipynb "Step 10
 * - career_classes"). Every one of these is a technical/IT role by design -
 * that's *why* onboarding only offers technical academic streams (see
 * routes/onboarding.tsx): the model has no signal for, and never predicts,
 * a non-technical career, so asking about non-technical streams there would
 * be collecting data the model can't use.
 *
 * Only 3 of these ("Software Engineer", "Data Scientist", "ML Engineer")
 * have hand-curated companies/mentors/courses in FALLBACK_CAREERS above -
 * the rest resolve through `buildGenericCareer()` in career-engine.server.ts
 * so a real model prediction never gets mismatched fallback content.
 * Add more curated entries to FALLBACK_CAREERS over time; anything not
 * listed there still renders correctly, just with generic guidance.
 */
export const CAREER_TAXONOMY = [
  "Backend Developer",
  "Blockchain Developer",
  "Business Analyst",
  "Cloud Architect",
  "Computer Vision Engineer",
  "Cybersecurity Analyst",
  "Data Analyst",
  "Data Engineer",
  "Data Scientist",
  "Database Administrator",
  "DevOps Engineer",
  "Embedded Systems Engineer",
  "Financial Analyst",
  "Frontend Developer",
  "Full Stack Developer",
  "Game Developer",
  "IT Project Manager",
  "IT Support Engineer",
  "Machine Learning Engineer",
  "Mobile App Developer",
  "NLP Engineer",
  "Network Engineer",
  "Penetration Tester",
  "Product Manager",
  "QA Engineer",
  "Robotics Engineer",
  "Site Reliability Engineer",
  "Solutions Architect",
  "Systems Administrator",
  "Technical Writer",
  "UI/UX Designer",
] as const;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-");

/**
 * Real, well-known employers per career (client-safe mirror of the same
 * list backend/src/seed/seed.ts uses to seed mentors) — gives every one of
 * the 31 model-predicted careers a handful of real companies to show
 * (with live job-search links) even without a full hand-curated
 * FALLBACK_CAREERS entry. Package bands are illustrative ranges, not a
 * live/scraped figure — same convention as the 3 hand-curated careers above.
 */
export const CAREER_COMPANY_HINTS: Record<string, { companies: string[]; packageRange: string }> = {
  "Backend Developer": { companies: ["Amazon", "Flipkart", "Razorpay"], packageRange: "₹10L – ₹24L" },
  "Blockchain Developer": { companies: ["Polygon", "CoinDCX", "Consensys"], packageRange: "₹12L – ₹28L" },
  "Business Analyst": { companies: ["Deloitte", "Accenture", "TCS"], packageRange: "₹7L – ₹16L" },
  "Cloud Architect": { companies: ["AWS", "Google Cloud", "Microsoft"], packageRange: "₹20L – ₹45L" },
  "Computer Vision Engineer": { companies: ["Nvidia", "Qualcomm", "Samsung R&D"], packageRange: "₹15L – ₹32L" },
  "Cybersecurity Analyst": { companies: ["Palo Alto Networks", "TCS", "Wipro"], packageRange: "₹8L – ₹20L" },
  "Data Analyst": { companies: ["Deloitte", "Myntra", "PhonePe"], packageRange: "₹6L – ₹14L" },
  "Data Engineer": { companies: ["Uber", "Swiggy", "Grab"], packageRange: "₹12L – ₹26L" },
  "Database Administrator": { companies: ["Oracle", "IBM", "TCS"], packageRange: "₹7L – ₹16L" },
  "DevOps Engineer": { companies: ["Microsoft", "Atlassian", "Freshworks"], packageRange: "₹10L – ₹24L" },
  "Embedded Systems Engineer": { companies: ["Bosch", "Texas Instruments", "Qualcomm"], packageRange: "₹8L – ₹18L" },
  "Financial Analyst": { companies: ["Goldman Sachs", "JPMorgan", "ICICI Bank"], packageRange: "₹8L – ₹18L" },
  "Frontend Developer": { companies: ["Zomato", "Meesho", "CRED"], packageRange: "₹9L – ₹20L" },
  "Full Stack Developer": { companies: ["Razorpay", "Zerodha", "Postman"], packageRange: "₹10L – ₹24L" },
  "Game Developer": { companies: ["Nazara", "Zynga", "Ubisoft"], packageRange: "₹6L – ₹16L" },
  "IT Project Manager": { companies: ["Infosys", "Capgemini", "Cognizant"], packageRange: "₹10L – ₹22L" },
  "IT Support Engineer": { companies: ["TCS", "Wipro", "HCL"], packageRange: "₹4L – ₹9L" },
  "Machine Learning Engineer": { companies: ["Google", "Microsoft", "Meta"], packageRange: "₹15L – ₹35L" },
  "Mobile App Developer": { companies: ["Paytm", "PhonePe", "Ola"], packageRange: "₹9L – ₹20L" },
  "NLP Engineer": { companies: ["Google", "Haptik", "Yellow.ai"], packageRange: "₹14L – ₹30L" },
  "Network Engineer": { companies: ["Cisco", "Airtel", "Jio"], packageRange: "₹6L – ₹14L" },
  "Penetration Tester": { companies: ["Deloitte", "EY", "TCS"], packageRange: "₹9L – ₹20L" },
  "Product Manager": { companies: ["Flipkart", "Swiggy", "CRED"], packageRange: "₹18L – ₹38L" },
  "QA Engineer": { companies: ["Infosys", "Zoho", "Freshworks"], packageRange: "₹5L – ₹12L" },
  "Robotics Engineer": { companies: ["Bosch", "Tata Elxsi", "ISRO"], packageRange: "₹8L – ₹18L" },
  "Site Reliability Engineer": { companies: ["Google", "Netflix", "Freshworks"], packageRange: "₹16L – ₹34L" },
  "Solutions Architect": { companies: ["AWS", "IBM", "Accenture"], packageRange: "₹22L – ₹45L" },
  "Systems Administrator": { companies: ["TCS", "Wipro", "HCL"], packageRange: "₹5L – ₹11L" },
  "Technical Writer": { companies: ["Atlassian", "Postman", "Zoho"], packageRange: "₹5L – ₹12L" },
  "UI/UX Designer": { companies: ["Swiggy", "CRED", "Zomato"], packageRange: "₹7L – ₹16L" },
};

/**
 * Rebuilds a full CareerPrediction from a saved career_results row
 * ({ title, confidence, narrative }) - used to restore a student's last
 * predictions on login without re-running the assessment. Prefers a
 * hand-curated FALLBACK_CAREERS entry (matched by title); otherwise builds
 * a minimal-but-honest generic card so nothing renders blank.
 */
export function resolveCareerPrediction(
  title: string,
  confidence: number,
  narrative?: string | null,
): CareerPrediction {
  const id = slugify(title);
  const curated = FALLBACK_CAREERS.find(
    (c) => c.id === id || c.title.toLowerCase() === title.toLowerCase(),
  );
  if (curated) {
    return { ...curated, confidence, aiSummary: narrative || curated.aiSummary };
  }

  const query = encodeURIComponent(title);
  const hint = CAREER_COMPANY_HINTS[title];
  const companies: Company[] = hint
    ? hint.companies.map((name, i) => ({
        name,
        role: title,
        openRoles: 3 + ((i * 2 + title.length) % 6), // small illustrative spread, not a live count
        location: "Bengaluru / Remote",
        packageRange: hint.packageRange,
        logoHue: (i * 90 + title.length * 7) % 360,
      }))
    : [];

  return {
    id,
    title,
    confidence,
    blurb: "A curated deep-dive for this career is still being built - here's general guidance in the meantime.",
    salaryRange: hint?.packageRange ?? "Varies by experience & location",
    demand: confidence >= 70 ? "High" : confidence >= 45 ? "Moderate" : "Emerging",
    aiSummary:
      narrative ||
      `${title} was predicted as a strong fit based on your assessment responses. Use the links below ` +
        `to research real openings and courses, and connect with a mentor through the Mentorship page.`,
    companies,
    mentors: [],
    courses: [
      {
        id: `${id}-coursera`,
        title: `${title} courses on Coursera`,
        provider: "Coursera",
        duration: "Varies",
        level: "Beginner",
        reason: "No course is curated for this career yet - search results for the role.",
        url: `https://www.coursera.org/search?query=${query}`,
      },
    ],
    path: [
      { phase: "Phase 1", title: "Research the role", detail: `Read 3-5 real job descriptions for ${title}.`, status: "in-progress" },
      { phase: "Phase 2", title: "Build foundational skills", detail: "Identify the 2-3 skills that show up most often.", status: "upcoming" },
      { phase: "Phase 3", title: "Build a portfolio piece", detail: "Ship one project that demonstrates those skills.", status: "upcoming" },
    ],
    skillGaps: [],
  };
}
