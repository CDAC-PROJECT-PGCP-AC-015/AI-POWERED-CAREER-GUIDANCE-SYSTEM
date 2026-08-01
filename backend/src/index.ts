import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { adminRouter } from "./routes/admin.js";
import { assessmentRouter } from "./routes/assessments.js";
import { authRouter } from "./routes/auth.js";
import { connectionRouter } from "./routes/connections.js";
import { courseRouter } from "./routes/courses.js";
import { discoverRouter } from "./routes/discover.js";
import { jobsRouter } from "./routes/jobs.js";
import { mentorRouter } from "./routes/mentors.js";
import { messageRouter } from "./routes/messages.js";
import { predictRouter } from "./routes/predict.js";
import { profileRouter } from "./routes/profile.js";
import { reportRouter } from "./routes/reports.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
// Every /api response is dynamic (user-specific or frequently-changing admin
// data) — explicitly disallow caching so a browser/proxy never serves a
// stale list (this was silently making newly-registered students appear
// missing from /api/admin/students until a hard refresh).
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/assessments", assessmentRouter);
app.use("/api/predict", predictRouter);
app.use("/api/mentors", mentorRouter);
app.use("/api/courses", courseRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/discover", discoverRouter);
app.use("/api/connections", connectionRouter);
app.use("/api/connections", messageRouter);
app.use("/api/reports", reportRouter);
app.use("/api/admin", adminRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT) || 5001;
app.listen(port, () => {
  console.log(`[server] AI Career Guidance API listening on :${port}`);
});
