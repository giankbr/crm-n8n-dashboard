#!/usr/bin/env bash
set -euo pipefail

WORKFLOW_ID="${WORKFLOW_ID:-wV29HWpUVO3UBekr}"
WORKFLOW_FILE="${WORKFLOW_FILE:-n8n/workflows/core_router.json}"
N8N_SERVICE="${N8N_SERVICE:-n8n}"
WEBHOOK_NAME="${WEBHOOK_NAME:-WA Webhook}"

echo "[deploy] validating workflow json: ${WORKFLOW_FILE}"
python3 - <<'PY' "$WORKFLOW_FILE" "$WEBHOOK_NAME"
import json, sys
path, webhook_name = sys.argv[1], sys.argv[2]
data = json.load(open(path))
nodes = data.get("nodes", [])
target = next((n for n in nodes if n.get("name")==webhook_name), None)
if not target:
    raise SystemExit(f"Missing node: {webhook_name}")
if not target.get("webhookId"):
    raise SystemExit(f"Node {webhook_name} missing webhookId")
print("[deploy] workflow validation passed")
PY

echo "[deploy] copying workflow into ${N8N_SERVICE}"
docker compose exec -T "${N8N_SERVICE}" n8n export:workflow --id="${WORKFLOW_ID}" --output=/tmp/current-workflow.json >/dev/null
docker compose cp "${N8N_SERVICE}:/tmp/current-workflow.json" ./n8n_data/current-workflow.json >/dev/null
cp "${WORKFLOW_FILE}" ./n8n_data/repo-workflow.json

python3 - <<'PY'
import json
from pathlib import Path
current_path = Path("n8n_data/current-workflow.json")
repo_path = Path("n8n_data/repo-workflow.json")
current = json.loads(current_path.read_text())[0]
repo = json.loads(repo_path.read_text())
current["nodes"] = repo["nodes"]
current["connections"] = repo["connections"]
current["settings"] = repo.get("settings", current.get("settings", {}))
Path("n8n_data/deploy-workflow.json").write_text(json.dumps([current]))
print("[deploy] merged repo workflow into current workflow entity")
PY

docker compose cp ./n8n_data/deploy-workflow.json "${N8N_SERVICE}:/tmp/deploy-workflow.json" >/dev/null
echo "[deploy] importing workflow"
docker compose exec -T "${N8N_SERVICE}" n8n import:workflow --input=/tmp/deploy-workflow.json

echo "[deploy] publishing workflow"
docker compose exec -T "${N8N_SERVICE}" n8n publish:workflow --id="${WORKFLOW_ID}"

echo "[deploy] activating workflow"
docker compose exec -T "${N8N_SERVICE}" n8n update:workflow --id="${WORKFLOW_ID}" --active=true

echo "[deploy] restarting ${N8N_SERVICE}"
docker compose restart "${N8N_SERVICE}" >/dev/null

echo "[deploy] health check n8n + backend"
for i in {1..20}; do
  if curl -fsS http://localhost:5678/healthz >/dev/null; then
    break
  fi
  sleep 1
done
curl -fsS http://localhost:5678/healthz >/dev/null
curl -fsS http://localhost:4000/api/health >/dev/null
echo "[deploy] done"
