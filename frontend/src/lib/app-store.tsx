import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, getToken, setToken } from "./api-client";
import {
  DEFAULT_STRENGTHS,
  FALLBACK_CAREERS,
  resolveCareerPrediction,
  type AssessmentAnswer,
  type CareerPrediction,
  type StudentProfile,
} from "./career-data";

export type ActivityItem = {
  id: string;
  kind: "assessment" | "session" | "course" | "system";
  title: string;
  detail: string;
  at: string;
  progress?: number;
};

export type SessionStatus =
  "pending" | "accepted" | "reschedule_proposed" | "declined" | "cancelled";

/** Mirrors the backend's `connections` row shape (see server/src/db/schema.ts). */
export type SessionRequest = {
  id: string;
  mentorId: string;
  mentorName: string;
  studentName?: string;
  topic: string | null;
  slot: string | null;
  proposedSlot?: string | null;
  status: SessionStatus;
  requestedAt: string;
};

/** A mentor's own editable public listing — mirrors the backend's `mentors` row. */
export type MentorProfile = {
  title: string;
  company: string;
  expertiseTags: string[];
  bio: string;
  linkedinUrl: string;
  availability: boolean;
  slots: string[];
};

const DEFAULT_MENTOR_PROFILE: MentorProfile = {
  title: "",
  company: "",
  expertiseTags: [],
  bio: "",
  linkedinUrl: "",
  availability: true,
  slots: [],
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: "student" | "mentor" | "admin";
};

type AppState = {
  authUser: AuthUser | null;
  profile: StudentProfile | null;
  onboarded: boolean;
  answers: AssessmentAnswer[];
  predictions: CareerPrediction[] | null;
  activity: ActivityItem[];
  sessions: SessionRequest[];
  savedCourses: string[];
  completedSteps: string[];
  mentorProfile: MentorProfile;
  assessmentId: string | null;
};

const EMPTY: AppState = {
  authUser: null,
  profile: null,
  onboarded: false,
  answers: [],
  predictions: null,
  activity: [],
  sessions: [],
  savedCourses: [],
  completedSteps: [],
  mentorProfile: DEFAULT_MENTOR_PROFILE,
  assessmentId: null,
};

const KEY = "careerai-state-v2";

type Ctx = AppState & {
  hydrated: boolean;
  authed: boolean;
  authError: string | null;
  // Returns the real, just-fetched account role + onboarding status (or
  // null on failure) so the caller (routes/auth.tsx) can navigate off of
  // fresh data instead of `useApp()` state read via a stale closure — that
  // state only updates on the *next* render, which is too late for code
  // still running inside the same async submit handler that triggered it.
  register: (p: {
    name: string;
    email: string;
    password: string;
    role: AuthUser["role"];
  }) => Promise<{ user: AuthUser; onboarded: boolean } | null>;
  login: (p: {
    email: string;
    password: string;
  }) => Promise<{ user: AuthUser; onboarded: boolean } | null>;
  signOut: () => void;
  completeOnboarding: (p: {
    stream: string;
    year: string;
    branch: string;
    interests: string[];
    marks10thPercent?: number;
    marks12thPercent?: number;
    graduationCgpa?: number;
    postgradCgpa?: number;
  }) => void;
  setAnswers: (a: AssessmentAnswer[]) => void;
  setPredictions: (p: CareerPrediction[]) => void;
  logActivity: (a: Omit<ActivityItem, "id" | "at">) => void;

  // Assessment persistence (server/src/routes/assessments.ts)
  ensureAssessment: () => Promise<string | null>;
  postMessage: (role: "user" | "assistant", content: string) => Promise<void>;
  completeAssessment: () => Promise<void>;
  saveResults: (
    results: { title: string; confidence: number; narrative?: string }[],
  ) => Promise<void>;

  // Mentors & sessions (server/src/routes/{mentors,connections}.ts)
  loadSessions: () => Promise<void>;
  requestSession: (
    mentorId: string,
    mentorName: string,
    topic: string,
    slot: string,
  ) => Promise<void>;
  confirmSession: (id: string) => Promise<void>;
  declineSession: (id: string) => Promise<void>;
  cancelSession: (id: string) => Promise<void>;
  proposeReschedule: (id: string, proposedSlot: string) => Promise<void>;
  respondToReschedule: (id: string, accept: boolean) => Promise<void>;

  loadMentorProfile: () => Promise<void>;
  updateMentorProfile: (p: Partial<Omit<MentorProfile, "slots">>) => Promise<void>;
  addAvailabilitySlot: (slot: string) => Promise<void>;
  removeAvailabilitySlot: (slot: string) => Promise<void>;

  toggleCourse: (id: string, title: string) => void;
  toggleStep: (id: string) => void;
  resetJourney: () => void;
};

const AppContext = createContext<Ctx | null>(null);

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

/** Shape returned by server/src/routes/connections.ts */
type BackendConnection = {
  id: string;
  mentorId: string;
  mentorName?: string;
  studentName?: string;
  topic: string | null;
  slot: string | null;
  proposedSlot?: string | null;
  status: SessionStatus;
  requestedAt: string;
};

/** Shape returned by server/src/routes/mentors.ts */
type BackendMentor = {
  id: string;
  title: string | null;
  company: string | null;
  expertiseTags: string[];
  bio: string | null;
  linkedinUrl: string | null;
  availability: boolean;
  slots: string[];
};

/** Shape returned by server/src/routes/profile.ts */
type BackendProfile = {
  educationLevel: string | null;
  specialization: string | null;
  interests: string[];
  roadmapProgress: Record<string, boolean>;
  savedCourseIds: string[];
  // Decimal columns come back from Postgres/drizzle as strings.
  marks10thPercent: string | null;
  marks12thPercent: string | null;
  graduationCgpa: string | null;
  postgradCgpa: string | null;
} | null;

/** Shape returned by server/src/routes/assessments.ts GET / */
type BackendAssessment = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  results: {
    rank: number;
    predictedCareer: string;
    fitScore: string;
    narrativeReport: string | null;
  }[];
};

function mapMentor(row: BackendConnection): { id: string; name: string } {
  return { id: row.mentorId, name: row.mentorName ?? "Mentor" };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const serverHydratedFor = useRef<string | null>(null);

  // "Latest state" ref (the useLatest pattern). Action callbacks below read
  // from this instead of closing over `state` directly, which is what lets
  // every action be wrapped in useCallback with an EMPTY dependency array —
  // i.e. genuinely stable function identities across renders.
  //
  // This matters a lot: previously every action (loadSessions, toggleStep,
  // updateMentorProfile, ...) was recreated on every `state` change *anywhere
  // in the app*, because they all lived inside one big `useMemo(..., [state])`.
  // Any page with `useEffect(() => loadX(), [loadX])` — e.g. the mentor
  // portal's `useEffect(() => { loadMentorProfile(); loadSessions(); },
  // [loadMentorProfile, loadSessions])` — would then re-run every time
  // *anything* touched global state, which called setState again, which
  // produced new function identities again... an effectively endless refetch
  // loop that keeps overwriting local component state (e.g. the mentor
  // profile edit form's `draft`) with whatever was just fetched, making it
  // look like you can't type into the form at all.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppState>;
        setState({
          ...EMPTY,
          ...parsed,
          mentorProfile: { ...DEFAULT_MENTOR_PROFILE, ...parsed.mentorProfile },
          authUser: getToken() ? (parsed.authUser ?? null) : null,
        });
      }
    } catch {
      /* ignore corrupt state */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const push = useCallback((a: Omit<ActivityItem, "id" | "at">) => {
    setState((s) => ({
      ...s,
      activity: [{ ...a, id: uid(), at: now() }, ...s.activity].slice(0, 40),
    }));
  }, []);

  /**
   * Restores everything the backend already knows for this student —
   * onboarding status, predictions, checked roadmap milestones and saved
   * courses — so logging back out and in never re-asks onboarding
   * questions or re-runs the assessment for someone who already finished
   * it. The backend (student_profiles + assessments/career_results) is the
   * source of truth here; localStorage is only a same-tab fast-paint cache.
   */
  const hydrateFromServer = useCallback(async (user: AuthUser): Promise<boolean> => {
    if (user.role !== "student") return false;
    try {
      const [profileRes, assessmentsRes] = await Promise.all([
        api.get<{ profile: BackendProfile }>("/profile/me"),
        api.get<{ assessments: BackendAssessment[] }>("/assessments"),
      ]);

      const profile = profileRes.profile;
      const latestCompleted = assessmentsRes.assessments
        .filter((a) => a.status === "completed" && a.results.length > 0)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

      const predictions = latestCompleted
        ? latestCompleted.results
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .map((r) =>
              resolveCareerPrediction(r.predictedCareer, Number(r.fitScore), r.narrativeReport),
            )
        : null;

      const roadmap = profile?.roadmapProgress ?? {};
      const completedSteps = Object.keys(roadmap).filter((k) => roadmap[k]);
      const isOnboarded = !!profile?.specialization || !!latestCompleted;
      const num = (v: string | null | undefined) => (v != null && v !== "" ? Number(v) : undefined);

      setState((s) => ({
        ...s,
        onboarded: s.onboarded || isOnboarded,
        profile: s.profile
          ? {
              ...s.profile,
              branch: profile?.specialization ?? s.profile.branch,
              stream: profile?.educationLevel ?? s.profile.stream,
              interests: profile?.interests?.length ? profile.interests : s.profile.interests,
              marks10thPercent: num(profile?.marks10thPercent) ?? s.profile.marks10thPercent,
              marks12thPercent: num(profile?.marks12thPercent) ?? s.profile.marks12thPercent,
              graduationCgpa: num(profile?.graduationCgpa) ?? s.profile.graduationCgpa,
              postgradCgpa: num(profile?.postgradCgpa) ?? s.profile.postgradCgpa,
            }
          : s.profile,
        predictions: predictions ?? s.predictions,
        assessmentId: latestCompleted?.id ?? s.assessmentId,
        completedSteps: completedSteps.length ? completedSteps : s.completedSteps,
        savedCourses: profile?.savedCourseIds?.length ? profile.savedCourseIds : s.savedCourses,
      }));
      return isOnboarded;
    } catch (err) {
      console.warn("[session restore] could not hydrate from backend:", err);
      return false;
    }
  }, []);

  // Whenever we have a signed-in student (fresh login, or a page refresh
  // that restored the token from localStorage), pull their real state from
  // the backend exactly once per session so refresh/relogin never regresses
  // them back to onboarding.
  useEffect(() => {
    if (!hydrated) return;
    const user = state.authUser;
    if (!user || !getToken()) return;
    if (serverHydratedFor.current === user.id) return;
    serverHydratedFor.current = user.id;
    void hydrateFromServer(user);
  }, [hydrated, state.authUser, hydrateFromServer]);

  // ---------------------------------------------------------------------
  // Actions. Every one of these is wrapped in useCallback with a stable
  // (empty, or only-other-stable-callbacks) dependency array — see the
  // stateRef comment above for why that matters. Reads of "current" state
  // go through stateRef.current; writes always use the functional
  // setState(s => ...) form so they never need `state` as a dependency.
  // ---------------------------------------------------------------------

  const register = useCallback<Ctx["register"]>(async ({ name, email, password, role }) => {
    setAuthError(null);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>("/auth/register", {
        fullName: name,
        email,
        password,
        role,
      });
      setToken(res.token);
      setState((s) => ({
        ...s,
        authUser: res.user,
        profile: {
          name: res.user.fullName,
          email: res.user.email,
          role: res.user.role,
          stream: s.profile?.stream ?? "",
          year: s.profile?.year ?? "",
          branch: s.profile?.branch ?? "",
          interests: s.profile?.interests ?? [],
          strengths: s.profile?.strengths ?? DEFAULT_STRENGTHS,
        },
      }));
      serverHydratedFor.current = res.user.id;
      // A brand new account is never onboarded yet, by definition.
      return { user: res.user, onboarded: false };
    } catch (err) {
      setAuthError(
        err instanceof ApiError
          ? err.message
          : "Could not reach the server. Is the backend running?",
      );
      return null;
    }
  }, []);

  const login = useCallback<Ctx["login"]>(
    async ({ email, password }) => {
      setAuthError(null);
      try {
        const res = await api.post<{ token: string; user: AuthUser }>("/auth/login", {
          email,
          password,
        });
        setToken(res.token);
        setState((s) => ({
          ...s,
          authUser: res.user,
          profile: {
            name: res.user.fullName,
            email: res.user.email,
            role: res.user.role,
            stream: s.profile?.stream ?? "",
            year: s.profile?.year ?? "",
            branch: s.profile?.branch ?? "",
            interests: s.profile?.interests ?? [],
            strengths: s.profile?.strengths ?? DEFAULT_STRENGTHS,
          },
        }));
        // Pull real onboarding/prediction/progress state and hand the result
        // straight back to the caller — routes/auth.tsx uses THIS return
        // value (not useApp() state) to decide where to navigate, since
        // context state from this render is stale until the next render.
        const onboarded = await hydrateFromServer(res.user);
        serverHydratedFor.current = res.user.id;
        return { user: res.user, onboarded };
      } catch (err) {
        setAuthError(
          err instanceof ApiError
            ? err.message
            : "Could not reach the server. Is the backend running?",
        );
        return null;
      }
    },
    [hydrateFromServer],
  );

  const signOut = useCallback(() => {
    setToken(null);
    serverHydratedFor.current = null;
    setState(EMPTY);
  }, []);

  const completeOnboarding = useCallback<Ctx["completeOnboarding"]>((p) => {
    setState((s) => ({
      ...s,
      onboarded: true,
      profile: s.profile
        ? { ...s.profile, ...p }
        : { name: "Student", email: "", role: "student", strengths: DEFAULT_STRENGTHS, ...p },
    }));
    api
      .put("/profile/me", {
        specialization: p.branch,
        educationLevel: p.stream || p.year,
        interests: p.interests,
        ...(p.marks10thPercent != null ? { marks10thPercent: p.marks10thPercent } : {}),
        ...(p.marks12thPercent != null ? { marks12thPercent: p.marks12thPercent } : {}),
        ...(p.graduationCgpa != null ? { graduationCgpa: p.graduationCgpa } : {}),
        ...(p.postgradCgpa != null ? { postgradCgpa: p.postgradCgpa } : {}),
      })
      .catch((err) => console.warn("[profile sync] skipped:", err));
  }, []);

  const setAnswers = useCallback(
    (answers: AssessmentAnswer[]) => setState((s) => ({ ...s, answers })),
    [],
  );
  const setPredictions = useCallback(
    (predictions: CareerPrediction[]) => setState((s) => ({ ...s, predictions })),
    [],
  );

  const ensureAssessment = useCallback<Ctx["ensureAssessment"]>(async () => {
    if (stateRef.current.assessmentId) return stateRef.current.assessmentId;
    try {
      const res = await api.post<{ assessment: { id: string } }>("/assessments/start");
      setState((s) => ({ ...s, assessmentId: res.assessment.id }));
      return res.assessment.id;
    } catch (err) {
      console.warn("[assessment] could not start on backend:", err);
      return null;
    }
  }, []);

  const postMessage = useCallback<Ctx["postMessage"]>(async (role, content) => {
    const id = stateRef.current.assessmentId;
    if (!id) return;
    try {
      await api.post(`/assessments/${id}/message`, { role, content });
    } catch (err) {
      console.warn("[assessment] message not persisted:", err);
    }
  }, []);

  const completeAssessment = useCallback<Ctx["completeAssessment"]>(async () => {
    const id = stateRef.current.assessmentId;
    if (!id) return;
    try {
      await api.post(`/assessments/${id}/complete`);
    } catch (err) {
      console.warn("[assessment] complete not persisted:", err);
    }
  }, []);

  const saveResults = useCallback<Ctx["saveResults"]>(async (results) => {
    const id = stateRef.current.assessmentId;
    if (!id) return;
    try {
      await api.post(`/assessments/${id}/results`, { results });
    } catch (err) {
      console.warn("[assessment] results not persisted:", err);
    }
  }, []);

  const loadSessions = useCallback<Ctx["loadSessions"]>(async () => {
    try {
      const res = await api.get<{ connections: BackendConnection[] }>("/connections");
      setState((s) => ({
        ...s,
        sessions: res.connections.map((c) => ({
          id: c.id,
          mentorId: c.mentorId,
          mentorName: c.mentorName ?? mapMentor(c).name,
          studentName: c.studentName,
          topic: c.topic ?? "Mentorship session",
          slot: c.slot ?? "",
          proposedSlot: c.proposedSlot,
          status: c.status,
          requestedAt: c.requestedAt,
        })),
      }));
    } catch (err) {
      console.warn("[sessions] could not load:", err);
    }
  }, []);

  const requestSession = useCallback<Ctx["requestSession"]>(
    async (mentorId, mentorName, topic, slot) => {
      try {
        const res = await api.post<{ connection: BackendConnection }>("/connections", {
          mentorId,
          topic,
          slot,
        });
        setState((s) => ({ ...s, sessions: [{ ...res.connection, mentorName }, ...s.sessions] }));
        push({
          kind: "session",
          title: `Session requested with ${mentorName}`,
          detail: `${topic} — ${slot}`,
        });
      } catch (err) {
        console.warn("[sessions] request failed:", err);
      }
    },
    [push],
  );

  const confirmSession = useCallback<Ctx["confirmSession"]>(async (id) => {
    const res = await api.post<{ connection: BackendConnection }>(`/connections/${id}/confirm`);
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...res.connection } : x)),
    }));
  }, []);
  const declineSession = useCallback<Ctx["declineSession"]>(async (id) => {
    const res = await api.post<{ connection: BackendConnection }>(`/connections/${id}/decline`);
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...res.connection } : x)),
    }));
  }, []);
  const cancelSession = useCallback<Ctx["cancelSession"]>(async (id) => {
    const res = await api.post<{ connection: BackendConnection }>(`/connections/${id}/cancel`);
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...res.connection } : x)),
    }));
  }, []);
  const proposeReschedule = useCallback<Ctx["proposeReschedule"]>(async (id, proposedSlot) => {
    const res = await api.post<{ connection: BackendConnection }>(
      `/connections/${id}/propose-reschedule`,
      {
        proposedSlot,
      },
    );
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...res.connection } : x)),
    }));
  }, []);
  const respondToReschedule = useCallback<Ctx["respondToReschedule"]>(async (id, accept) => {
    const res = await api.post<{ connection: BackendConnection }>(
      `/connections/${id}/respond-reschedule`,
      {
        accept,
      },
    );
    setState((s) => ({
      ...s,
      sessions: s.sessions.map((x) => (x.id === id ? { ...x, ...res.connection } : x)),
    }));
  }, []);

  const loadMentorProfile = useCallback<Ctx["loadMentorProfile"]>(async () => {
    try {
      const res = await api.get<{ mentor: BackendMentor | null }>("/mentors/me");
      const mentor = res.mentor;
      if (mentor) {
        setState((s) => ({
          ...s,
          mentorProfile: {
            title: mentor.title ?? "",
            company: mentor.company ?? "",
            expertiseTags: mentor.expertiseTags ?? [],
            bio: mentor.bio ?? "",
            linkedinUrl: mentor.linkedinUrl ?? "",
            availability: mentor.availability ?? true,
            slots: mentor.slots ?? [],
          },
        }));
      }
    } catch (err) {
      console.warn("[mentor profile] could not load:", err);
    }
  }, []);

  const updateMentorProfile = useCallback<Ctx["updateMentorProfile"]>(async (p) => {
    const res = await api.put<{ mentor: BackendMentor }>("/mentors/me", p);
    setState((s) => ({
      ...s,
      mentorProfile: {
        ...s.mentorProfile,
        ...p,
        expertiseTags: res.mentor.expertiseTags ?? s.mentorProfile.expertiseTags,
      },
    }));
  }, []);
  const addAvailabilitySlot = useCallback<Ctx["addAvailabilitySlot"]>(async (slot) => {
    const current = stateRef.current.mentorProfile.slots;
    const next = current.includes(slot) ? current : [...current, slot];
    const res = await api.put<{ mentor: BackendMentor }>("/mentors/me/slots", { slots: next });
    setState((s) => ({
      ...s,
      mentorProfile: { ...s.mentorProfile, slots: res.mentor.slots ?? next },
    }));
  }, []);
  const removeAvailabilitySlot = useCallback<Ctx["removeAvailabilitySlot"]>(async (slot) => {
    const next = stateRef.current.mentorProfile.slots.filter((s) => s !== slot);
    const res = await api.put<{ mentor: BackendMentor }>("/mentors/me/slots", { slots: next });
    setState((s) => ({
      ...s,
      mentorProfile: { ...s.mentorProfile, slots: res.mentor.slots ?? next },
    }));
  }, []);

  const toggleCourse = useCallback<Ctx["toggleCourse"]>(
    (id, title) => {
      setState((s) => {
        const has = s.savedCourses.includes(id);
        if (!has) {
          queueMicrotask(() =>
            push({
              kind: "course",
              title: `Enrolled in ${title}`,
              detail: "Added to your Skill Lab plan.",
              progress: 0,
            }),
          );
        }
        const savedCourses = has ? s.savedCourses.filter((c) => c !== id) : [...s.savedCourses, id];
        api
          .put("/profile/me", { savedCourseIds: savedCourses })
          .catch((err) => console.warn("[skill lab] progress not persisted:", err));
        return { ...s, savedCourses };
      });
    },
    [push],
  );

  const toggleStep = useCallback<Ctx["toggleStep"]>((id) => {
    setState((s) => {
      const done = !s.completedSteps.includes(id);
      const completedSteps = done
        ? [...s.completedSteps, id]
        : s.completedSteps.filter((c) => c !== id);
      api
        .put("/profile/me", { roadmapProgress: { [id]: done } })
        .catch((err) => console.warn("[roadmap] progress not persisted:", err));
      return { ...s, completedSteps };
    });
  }, []);

  const resetJourney = useCallback(() => {
    setState((s) => ({
      ...s,
      answers: [],
      predictions: null,
      completedSteps: [],
      assessmentId: null,
    }));
  }, []);

  const authed = !!state.authUser && !!getToken();

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      hydrated,
      authed,
      authError,
      register,
      login,
      signOut,
      completeOnboarding,
      setAnswers,
      setPredictions,
      logActivity: push,
      ensureAssessment,
      postMessage,
      completeAssessment,
      saveResults,
      loadSessions,
      requestSession,
      confirmSession,
      declineSession,
      cancelSession,
      proposeReschedule,
      respondToReschedule,
      loadMentorProfile,
      updateMentorProfile,
      addAvailabilitySlot,
      removeAvailabilitySlot,
      toggleCourse,
      toggleStep,
      resetJourney,
    }),
    [
      state,
      hydrated,
      authed,
      authError,
      register,
      login,
      signOut,
      completeOnboarding,
      setAnswers,
      setPredictions,
      push,
      ensureAssessment,
      postMessage,
      completeAssessment,
      saveResults,
      loadSessions,
      requestSession,
      confirmSession,
      declineSession,
      cancelSession,
      proposeReschedule,
      respondToReschedule,
      loadMentorProfile,
      updateMentorProfile,
      addAvailabilitySlot,
      removeAvailabilitySlot,
      toggleCourse,
      toggleStep,
      resetJourney,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

/** Predictions with a safe demo default so every screen renders. */
export function useCareers(): CareerPrediction[] {
  const { predictions } = useApp();
  return predictions ?? FALLBACK_CAREERS;
}
