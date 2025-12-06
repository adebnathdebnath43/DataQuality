# DataQuality

Full-stack app (FastAPI + React/Vite) that scans S3 documents with AWS Bedrock LLMs/embeddings, generates quality scores, and flags near-duplicates. Includes cosine-similarity reporting for multi-file runs.

## Features
- FastAPI backend with Bedrock (analysis + Titan v2 embeddings) and S3 integration.
- Duplicate detection: metadata gate (doc type + topics/key_terms) then cosine on embeddings; also exposes all similarity pairs for UI.
- Timeliness adjustment using S3 upload dates; 17 standardized quality dimensions.
- React UI with protected routes and dashboard for results.

## Prerequisites
- Node 18+ and npm
- Python 3.8+ with venv support
- AWS credentials with access to:
	- `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` for chosen regions (Titan v2 embedding: `amazon.titan-embed-text-v2:0`; Mistral/Claude per policy)
	- S3 read/write for target buckets (list/get/put)
- Recommended regions for Titan v2: `us-east-1` or `us-west-2`.

## Quick Start
```bash
# 1) Install frontend deps
npm install

# 2) Create Python venv and install backend deps
python -m venv .venv
.\.venv\Scripts\activate   # PowerShell on Windows
pip install -r backend/requirements.txt

# 3) Configure environment
copy backend\.env.example backend\.env   # if you have an example; otherwise create manually

# 4) Run backend (FastAPI uvicorn)
powershell -File start-backend.ps1

# 5) Run frontend (Vite)
npm run dev
```
Frontend runs on `http://localhost:5173`; backend on `http://localhost:8003` (per scripts/config).

## Backend Configuration
`backend/app/config.py` uses environment variables via Pydantic settings. Key values:
- `AWS_REGION` (maps to `settings.aws_region`, default `us-east-1`)
- `BEDROCK_MODEL_ID` (LLM for analysis, e.g., `mistral.mistral-large-2402-v1:0`)
- `S3_METADATA_PREFIX` (default `metadata/`)
- CORS origins for local dev

Bedrock client is created from provided S3 connection creds (access/secret; role support placeholder). Embeddings use `amazon.titan-embed-text-v2:0` with JSON body `{ "inputText": "..." }`.

## Duplicate Detection Logic
1) Gate on metadata similarity (doc type exact match + Jaccard on topics/key_terms), require >= 0.7.
2) Cosine similarity on embeddings:
	 - Prefer full-document embedding; fall back to summary embedding; final fallback is bag-of-words with aligned vocab.
	 - Duplicate threshold: cosine >= 0.95 recorded in `potential_duplicates` and `duplicate_pairs`.
3) All meta-gated pairs (even below 0.95) are returned in `similarity_pairs` with `file_1`, `file_2`, `similarity`, and `metadata_similarity` so the UI can always display matches when many files are selected.

## Outputs
- Per-file JSON written to S3: `<original_key>.json` with analysis, dimensions, embeddings.
- Consolidated JSON written to `output_folder/quality_check_results_<timestamp>.json` and also stored locally under `backend/data/results/`.
- Consolidated payload fields:
	- `files`: full analyses, `potential_duplicates`, and `similarity_pairs` on each item
	- `duplicate_pairs`: unique pairs above the 0.95 threshold
	- `similarity_pairs`: all gated cosine pairs (descending)

## Frontend
- Located in `src/` (React + Vite). Entry `src/main.jsx`, app shell `src/App.jsx`, pages under `src/pages/`.
- Auth context in `src/context/AuthContext.jsx`; protected routes in `src/components/ProtectedRoute.jsx`.
- Styles in `src/App.css`, `src/index.css`, and component-level CSS files.

## Running with Docker
Provided `Dockerfile` builds the full stack; adjust env vars at runtime for AWS creds/region. Example build/run:
```bash
docker build -t dataquality .
docker run -p 5173:5173 -p 8003:8003 --env-file backend/.env dataquality
```

## Common Troubleshooting
- Empty embeddings: verify region is `us-east-1` or `us-west-2` and IAM allows `amazon.titan-embed-text-v2:0`; ensure `contentType/accept` are `application/json`.
- No duplicates flagged on large selections: read `similarity_pairs` in consolidated JSON; UI should surface these even if threshold not met.
- S3 write errors: ensure `s3:PutObject` on the bucket for the configured credentials.

## Key Scripts
- `start-backend.ps1`: launches FastAPI/uvicorn with backend app.
- `start-frontend.ps1`: runs `npm install` (if needed) and `npm run dev`.

## Testing
- Backend sample test: `backend/test_embedding.py` exercises embedding generation.
- Use your preferred runner (pytest recommended) within the venv.

## Repository Structure (partial)
- `backend/app/services/bedrock.py` — Bedrock client, analysis, embeddings
- `backend/app/services/metadata.py` — S3 ingestion, quality scoring, duplicate detection
- `src/` — React UI
- `public/` — static assets
- `backend/data/results/` — local consolidated results history

## Security Notes
- Do not commit real AWS keys. Use environment variables or AWS profiles/roles.
- Restrict Bedrock and S3 policies to required actions and regions.
