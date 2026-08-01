FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
# Mount or copy your career_xgboost_model.pkl into /app at deploy time.

ENV MODEL_PATH=/app/career_xgboost_model.pkl
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
