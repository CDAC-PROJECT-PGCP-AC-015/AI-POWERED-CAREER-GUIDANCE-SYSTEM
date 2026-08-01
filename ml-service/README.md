# Career Guidance ML Service

Wraps your downloaded `career_xgboost_model.pkl` in a small FastAPI service
that speaks the exact contract `src/lib/career-engine.server.ts` already
expects — so wiring it in is a **3-step, zero-frontend-code-change** job.

## 1. Drop your model in

Copy your `.pkl` file into this folder (or anywhere else — just point
`MODEL_PATH` at it):

```bash
cp /path/to/your/career_xgboost_model.pkl ./career_xgboost_model.pkl
```

The service expects the pickle to be a **dict** with these keys (this is
exactly what your training notebook already saves, per SDD §8.2 — "Table:
career_xgboost_model.pkl"):

| Key | Type | What it is |
|---|---|---|
| `model` | `XGBClassifier` | the trained classifier |
| `career_le` | `LabelEncoder` | 35 career names ↔ class indices |
| `edu_le`, `spec_le`, `intern_le` | `LabelEncoder` | categorical encoders |
| `feature_names` | `list[str]` | the exact ~266-column order used at train time |
| `all_tech`, `all_soft`, `all_int`, `all_cert` | `list[str]` | the fixed vocab lists behind the one-hot columns |
| `numeric_cols` | `list[str]` | names of the 13 plain-number columns |
| `accuracy`, `f1_weighted` | `float` | optional, shown on `/health` |

If your pickle isn't a dict shaped like this (e.g. it's *just* the raw
`XGBClassifier`), tell me the actual structure and I'll adjust
`build_feature_row()` in `app.py` — that function is the only place that
needs to change.

## 2. Run it

```bash
pip install -r requirements.txt
export MODEL_PATH=./career_xgboost_model.pkl
uvicorn app:app --host 0.0.0.0 --port 8000
```

Sanity-check it loaded correctly:

```bash
curl http://localhost:8000/health
# {"status":"ok","n_classes":35,"n_features":266,"accuracy":0.9945,...}
```

Send it a test prediction (this is exactly the payload the Node server sends):

```bash
curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" -d '{
  "profile": {"branch":"Computer Science","interests":["Data Science"],"strengths":{"Machine Learning":80}},
  "answers": [{"question":"What languages do you know?","answer":"Python, TensorFlow, SQL"}]
}'
```

## 3. Point the frontend at it

In the main app's environment (`.env` / your host's secret manager):

```
CAREER_MODEL_URL=http://localhost:8000/predict
# CAREER_MODEL_KEY=some-shared-secret     (optional — only if you set API_KEY below)
```

That's it — `callCareerModel()` in `career-engine.server.ts` already POSTs
`{ profile, answers }` here and reads back `{ predictions: [...] }`. Nothing
else in the frontend needs to change. If the service is unreachable or
errors, the app silently falls back to the built-in demo data — it never
crashes the UI.

## GET /vocab

Returns the exact controlled vocabulary this model was trained on:

```bash
curl http://localhost:8000/vocab
# { "education_level": [...], "specialization": [...], "internship_domain": [...],
#   "skills_tech": [...], "skills_soft": [...], "interests": [...], "certifications": [...] }
```

`career-engine.server.ts` fetches this automatically (derived from
`CAREER_MODEL_URL`, no extra config needed) and feeds it to the LLM
extraction step so the free-text interview gets turned into values that
actually match real feature columns, instead of the LLM guessing plausible
strings that silently don't match anything.

## Notes on feature-building

Onboarding collects marks (10th/12th %, graduation CGPA) directly as exact
numbers and sends them straight through — no LLM needed for those. Everything
else rich (`skills_tech[]`, `skills_soft[]`, `certifications[]`, internship
details, `specialization`) is extracted from the conversational assessment by
one LLM call (`extractStructuredSignals()` in `career-engine.server.ts`),
constrained to the vocabulary from `/vocab` above.

`build_feature_row()` still has a fallback for when the LLM extraction isn't
configured or fails: it scans the interview transcript (`answers[]`) plus
`branch`/`stream`/`interests` for any of the model's known vocabulary terms
and fills in reasonable numeric defaults (75% marks, 7.5 CGPA, etc.) for
anything it can't infer — so predictions still work with zero LLM
configuration, just less precisely.

## Deploying

Any host that runs a Python ASGI app works (Render, Railway, Fly.io, a
plain VM). A `Dockerfile` is included:

```bash
docker build -t career-ml-service .
docker run -p 8000:8000 -e MODEL_PATH=/app/career_xgboost_model.pkl \
  -v $(pwd)/career_xgboost_model.pkl:/app/career_xgboost_model.pkl \
  career-ml-service
```

Then set `CAREER_MODEL_URL` to that deployment's `/predict` URL.

## Updating the model later

Drop a new `.pkl` in and call `POST /reload` (or just restart the process)
— no code changes needed as long as the artifact shape stays the same.
