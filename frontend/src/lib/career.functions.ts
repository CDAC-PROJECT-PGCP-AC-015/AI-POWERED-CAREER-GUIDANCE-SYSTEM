import { createServerFn } from "@tanstack/react-start";
import { runAssistantReply, runPrediction } from "./career-engine.server";
import type { AssessmentAnswer, StudentProfile } from "./career-data";

export const predictCareers = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { profile: Partial<StudentProfile>; answers: AssessmentAnswer[] }) => data,
  )
  .handler(async ({ data }) => runPrediction(data.profile, data.answers));

export const assistantReply = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      history: { role: "user" | "assistant"; content: string }[];
      nextQuestion: string | null;
    }) => data,
  )
  .handler(async ({ data }) => ({
    message: await runAssistantReply(data.history, data.nextQuestion),
  }));
