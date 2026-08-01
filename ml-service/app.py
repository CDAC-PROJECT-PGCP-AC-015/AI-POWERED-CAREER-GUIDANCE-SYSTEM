"""
AI Powered Career Guidance System — ML Microservice
====================================================
Loads the trained `career_xgboost_model.pkl` (produced by the Step 10 save
cell in career_guidance_model.ipynb) and exposes it as a single POST /predict
endpoint.

The artifact is plain data (no pickled custom classes) — see the notebook's
Step 10 for how it's built. Expected keys:
  booster_json      - the trained XGBoost model, in XGBoost's own native
                       JSON format (via Booster.save_model)
  feature_names     - full ordered list of feature-vector column names
  numeric_cols      - names of the numeric columns (subset of feature_names)
  categorical_cols  - names of the one-hot categorical fields
  multilabel_cols   - names of the multi-hot fields (skills/interests/certs)
  cat_vocabs        - {field: [known values]} for categorical_cols
  multilabel_vocabs - {field: [known values]} for multilabel_cols
  career_classes    - career names, in class-index order
  class_min         - per-class margin minimum (training set), for scaling
  class_max         - per-class margin maximum (training set), for scaling

This is the exact service the frontend's src/lib/career-engine.server.ts is
already built to call — set CAREER_MODEL_URL to wherever this runs
(e.g. http://localhost:8000/predict) and no frontend code needs to change.

Request body   : { "profile": {...}, "answers": [{ "question", "answer" }, ...] }
Response body  : { "predictions": [ { "career_id": "data-scientist", "confidence": 0.91 }, ... ] }

Note: "confidence" here is each career's independent 0-1 fit score (margin,
min-max scaled per class) — NOT a softmax probability, so the three returned
scores do NOT need to sum to 1. That's intentional (see notebook Step 7).

Run locally:
    pip install -r requirements.txt
    export MODEL_PATH=./career_xgboost_model.pkl
    uvicorn app:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import os
import re
import tempfile
import time
from collections import deque
from typing import Any

import numpy as np
import pandas as pd
import xgboost as xgb
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_PATH = os.environ.get("MODEL_PATH", "career_xgboost_model.pkl")
API_KEY = os.environ.get("CAREER_MODEL_KEY")  # optional bearer token, matches CAREER_MODEL_KEY

app = FastAPI(title="Career Guidance ML Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your Node server's origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 1. Load the model artifact once at startup
# ---------------------------------------------------------------------------
_artifact: dict[str, Any] | None = None
_booster: xgb.Booster | None = None
_inference_log: deque = deque(maxlen=200)  # in-memory ring buffer for /logs

REQUIRED_KEYS = {
    "booster_json", "feature_names", "numeric_cols", "categorical_cols",
    "multilabel_cols", "cat_vocabs", "multilabel_vocabs", "career_classes",
    "class_min", "class_max",
}


def load_artifact() -> dict[str, Any]:
    global _artifact, _booster
    if _artifact is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError(
                f"Model file not found at '{MODEL_PATH}'. Set MODEL_PATH env var "
                "to point at your downloaded career_xgboost_model.pkl."
            )
        _artifact = joblib.load(MODEL_PATH)

        missing = REQUIRED_KEYS - set(_artifact.keys())
        if missing:
            raise RuntimeError(f"Model file is missing expected keys: {missing}")

        # Reconstruct the booster from its native-format JSON. We write it to
        # a temp file because Booster.load_model is most reliably compatible
        # across xgboost versions when given a file path.
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w") as tmp:
            tmp.write(_artifact["booster_json"])
            tmp_path = tmp.name
        booster = xgb.Booster()
        booster.load_model(tmp_path)
        os.remove(tmp_path)
        _booster = booster

        # class_min / class_max come back from joblib as lists — make them
        # numpy arrays once, up front, since predict() uses them per-request.
        _artifact["class_min"] = np.array(_artifact["class_min"], dtype=float)
        _artifact["class_max"] = np.array(_artifact["class_max"], dtype=float)
    return _artifact


def get_booster() -> xgb.Booster:
    load_artifact()
    assert _booster is not None
    return _booster


@app.on_event("startup")
def _startup() -> None:
    try:
        load_artifact()
        print(f"[ml-service] loaded model from {MODEL_PATH}")
    except Exception as exc:  # noqa: BLE001
        # Don't crash the process — /health will report the problem clearly,
        # which is much easier to debug than a container that won't start.
        print(f"[ml-service] WARNING: model did not load: {exc}")


# ---------------------------------------------------------------------------
# 2. Request/response schema — matches career-engine.server.ts exactly
# ---------------------------------------------------------------------------
class AssessmentAnswer(BaseModel):
    question: str
    answer: str


class Profile(BaseModel):
    """
    Superset of what the frontend can send. Everything is optional because
    the demo UI only collects `stream`/`year`/`branch`/`interests`/`strengths`
    today — see build_profile_dict() below for how missing rich fields
    (marks, CGPA, skills, certifications...) are inferred or defaulted.
    """

    name: str | None = None
    email: str | None = None
    role: str | None = None
    stream: str | None = None
    year: str | None = None
    branch: str | None = None
    interests: list[str] = Field(default_factory=list)
    strengths: dict[str, float] = Field(default_factory=dict)

    # Rich fields — send these directly once your LLM/interview layer
    # extracts a full structured profile (SDD §6.1 / student_profiles table).
    # Field names below match the raw profile dict shape the notebook's
    # FeatureEncoder was trained on.
    education_level: str | None = None
    specialization: str | None = None
    marks_10th_percent: float | None = None
    marks_12th_percent: float | None = None
    graduation_cgpa: float | None = None
    postgrad_cgpa: float | None = None
    skills_tech: list[str] = Field(default_factory=list)
    skills_soft: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    has_internship: bool | None = None
    internship_domain: str | None = None
    internship_duration_months: float | None = None
    avg_tech_skill_rating: float | None = None
    avg_soft_skill_rating: float | None = None

    class Config:
        extra = "allow"  # tolerate any additional fields the LLM extracts


class PredictRequest(BaseModel):
    profile: Profile = Field(default_factory=Profile)
    answers: list[AssessmentAnswer] = Field(default_factory=list)


class RawPrediction(BaseModel):
    career_id: str
    title: str
    confidence: float  # independent 0..1 fit score (NOT softmax — see module docstring)


class PredictResponse(BaseModel):
    predictions: list[RawPrediction]


# ---------------------------------------------------------------------------
# 3. Profile -> raw profile dict -> feature row
#    (mirrors FeatureEncoder.transform() in the notebook exactly)
# ---------------------------------------------------------------------------
def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower().strip()).strip("-")


def infer_from_text(text: str, vocab: list[str]) -> list[str]:
    """Keyword-match a vocabulary list against free text.

    The demo frontend doesn't always collect structured skills/certs — the
    LLM interview transcript (answers[]) is the closest thing we have. This
    scans that text for any of the model's known vocabulary terms so the
    feature row is populated with *something* meaningful instead of zeros.
    Once you wire a real LLM extraction step, send skills_tech/skills_soft/
    interests/certifications directly on `profile` and this fallback is
    skipped for that field.
    """
    hits = []
    lowered = text.lower()
    for term in vocab:
        needle = term.replace("_", " ").lower()
        if needle and needle in lowered:
            hits.append(term)
    return hits


def build_profile_dict(profile: Profile, answers: list[AssessmentAnswer], artifact: dict) -> dict:
    """Profile (+ interview transcript) -> raw profile dict, in the exact
    shape the notebook's FeatureEncoder was trained on."""
    multilabel_vocabs = artifact["multilabel_vocabs"]

    transcript = " ".join(f"{a.question} {a.answer}" for a in answers)
    combined_text = " ".join(filter(None, [
        profile.branch, profile.stream, " ".join(profile.interests), transcript,
    ]))

    skills_tech = profile.skills_tech or infer_from_text(combined_text, multilabel_vocabs.get("skills_tech", []))
    skills_soft = profile.skills_soft or infer_from_text(combined_text, multilabel_vocabs.get("skills_soft", []))
    interests = profile.interests or infer_from_text(combined_text, multilabel_vocabs.get("interests", []))
    certifications = profile.certifications or infer_from_text(combined_text, multilabel_vocabs.get("certifications", []))

    has_internship = profile.has_internship
    if has_internship is None:
        has_internship = "intern" in combined_text.lower()

    avg_tech = profile.avg_tech_skill_rating
    if avg_tech is None:
        avg_tech = (sum(profile.strengths.values()) / len(profile.strengths) / 10) if profile.strengths else 6.5
    avg_soft = profile.avg_soft_skill_rating if profile.avg_soft_skill_rating is not None else 6.5

    return {
        "education_level": profile.education_level or "B.Tech",
        "specialization": profile.specialization or profile.branch,
        "marks_10th_percent": profile.marks_10th_percent or 75.0,
        "marks_12th_percent": profile.marks_12th_percent or 75.0,
        "graduation_cgpa": profile.graduation_cgpa or 7.5,
        "postgrad_cgpa": profile.postgrad_cgpa,
        "skills_tech": skills_tech,
        "skills_soft": skills_soft,
        "interests": interests,
        "certifications": certifications,
        "has_internship": 1 if has_internship else 0,
        "internship_domain": profile.internship_domain,
        "internship_duration_months": profile.internship_duration_months or 0,
        "avg_tech_skill_rating": avg_tech,
        "avg_soft_skill_rating": avg_soft,
    }


def transform_profile(p: dict, artifact: dict) -> pd.DataFrame:
    """Re-implementation of FeatureEncoder.transform() for a single profile,
    driven entirely by the saved vocabularies — no custom class needed."""
    numeric_cols: list[str] = artifact["numeric_cols"]
    categorical_cols: list[str] = artifact["categorical_cols"]
    multilabel_cols: list[str] = artifact["multilabel_cols"]
    cat_vocabs: dict = artifact["cat_vocabs"]
    multilabel_vocabs: dict = artifact["multilabel_vocabs"]
    feature_names: list[str] = artifact["feature_names"]

    row: dict[str, float] = {}

    # numeric (must match FeatureEncoder.transform's field handling exactly)
    row["marks_10th_percent"] = p.get("marks_10th_percent") or 0.0
    row["marks_12th_percent"] = p.get("marks_12th_percent") or 0.0
    row["graduation_cgpa"] = p.get("graduation_cgpa") or 0.0
    pg = p.get("postgrad_cgpa")
    row["postgrad_cgpa"] = pg if pg else 0.0
    row["has_postgrad"] = 1 if pg else 0
    row["has_internship"] = int(p.get("has_internship") or 0)
    row["internship_duration_months"] = p.get("internship_duration_months") or 0
    row["avg_tech_skill_rating"] = p.get("avg_tech_skill_rating") or 0.0
    row["avg_soft_skill_rating"] = p.get("avg_soft_skill_rating") or 0.0

    # one-hot categorical, with an "Other" bucket for unseen values
    for col in categorical_cols:
        v = p.get(col)
        known = cat_vocabs.get(col, [])
        for val in known:
            row[f"{col}__{val}"] = 1 if v == val else 0
        row[f"{col}__Other"] = 1 if (v and v not in known) else 0

    # multi-hot
    for col in multilabel_cols:
        vals = set(p.get(col) or [])
        for val in multilabel_vocabs.get(col, []):
            row[f"{col}__{val}"] = 1 if val in vals else 0

    ordered = {name: row.get(name, 0.0) for name in feature_names}
    return pd.DataFrame([ordered], columns=feature_names)


def predict_fit_scores(profile: Profile, answers: list[AssessmentAnswer], artifact: dict, top_k: int = 3):
    """Mirrors CareerFitPredictor.predict(): raw margins, independent
    per-class min-max scaling — NOT softmax."""
    p = build_profile_dict(profile, answers, artifact)
    X = transform_profile(p, artifact)

    booster = get_booster()
    dmat = xgb.DMatrix(X, feature_names=list(X.columns))
    margin = booster.predict(dmat, output_margin=True)[0]

    class_min = artifact["class_min"]
    class_max = artifact["class_max"]
    span = np.clip(class_max - class_min, 1e-6, None)
    fit_scores = (margin - class_min) / span
    fit_scores = np.clip(fit_scores, 0, 1)  # 0..1, NOT *100 — API returns a 0..1 "confidence"

    order = np.argsort(fit_scores)[::-1][:top_k]
    career_classes: list[str] = artifact["career_classes"]
    return [(career_classes[i], float(fit_scores[i])) for i in order]


# ---------------------------------------------------------------------------
# 4. Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    try:
        artifact = load_artifact()
        return {
            "status": "ok",
            "model_path": MODEL_PATH,
            "n_classes": len(artifact["career_classes"]),
            "n_features": len(artifact["feature_names"]),
        }
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "detail": str(exc)}


@app.get("/logs")
def logs():
    """Recent inference calls — handy to wire into the Admin ML Inference Log panel."""
    return {"logs": list(_inference_log)}


@app.get("/vocab")
def vocab():
    """
    Exposes the exact controlled vocabulary this model was trained on for
    every categorical/multilabel field (education_level, specialization,
    internship_domain, skills_tech, skills_soft, interests, certifications).

    Why this exists: the frontend's LLM extraction step (career-engine.server.ts
    -> extractStructuredSignals()) turns the free-text interview transcript into
    structured profile fields before calling /predict. If the LLM invents a
    value that isn't in this vocabulary (e.g. "React.js" instead of the
    trained "React"), transform_profile() silently drops it into an "Other"
    bucket or ignores it entirely — no crash, but wasted signal. Feeding the
    LLM this exact list up front means its output actually lands on real
    feature columns, which is what makes the extra structured fields worth
    sending in the first place.

    Always reflects whatever .pkl is currently loaded, so it never drifts out
    of sync with the deployed model even after a /reload.
    """
    artifact = load_artifact()
    return {
        "education_level": artifact["cat_vocabs"].get("education_level", []),
        "specialization": artifact["cat_vocabs"].get("specialization", []),
        "internship_domain": artifact["cat_vocabs"].get("internship_domain", []),
        "skills_tech": artifact["multilabel_vocabs"].get("skills_tech", []),
        "skills_soft": artifact["multilabel_vocabs"].get("skills_soft", []),
        "interests": artifact["multilabel_vocabs"].get("interests", []),
        "certifications": artifact["multilabel_vocabs"].get("certifications", []),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest, x_api_key: str | None = None):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")

    artifact = load_artifact()
    started = time.time()

    top3 = predict_fit_scores(req.profile, req.answers, artifact, top_k=3)
    predictions = [
        RawPrediction(career_id=slugify(name), title=name, confidence=score)
        for name, score in top3
    ]

    _inference_log.appendleft({
        "at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "latency_ms": round((time.time() - started) * 1000, 1),
        "top_prediction": predictions[0].title if predictions else None,
        "confidence": round(predictions[0].confidence, 3) if predictions else None,
    })

    return PredictResponse(predictions=predictions)


@app.post("/reload")
def reload_model():
    """Force a reload after you drop in a newer .pkl without restarting the process."""
    global _artifact, _booster
    _artifact = None
    _booster = None
    artifact = load_artifact()
    return {"status": "reloaded", "n_classes": len(artifact["career_classes"])}