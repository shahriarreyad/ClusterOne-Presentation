#!/usr/bin/env bash
# Usage: bash containers/tests/run_tests.sh <pytorch|tensorflow> <docker|apptainer> [--require-gpu]
# --require-gpu enables GPU passthrough (--gpus all / --nv) and fails if no GPU is found.
set -euo pipefail

ENV_NAME="${1:?env name required (pytorch|tensorflow)}"
RUNTIME="${2:?runtime required (docker|apptainer)}"
EXTRA="${3:-}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TESTS="${ROOT}/containers/tests"

case "${RUNTIME}" in
  docker)
    GPU_FLAG=()
    [ "${EXTRA}" = "--require-gpu" ] && GPU_FLAG=(--gpus all)
    docker run --rm "${GPU_FLAG[@]}" -v "${TESTS}:/tests:ro" \
      "clusterone/${ENV_NAME}:latest" python /tests/test_gpu.py ${EXTRA}
    ;;
  apptainer)
    NV_FLAG=()
    [ "${EXTRA}" = "--require-gpu" ] && NV_FLAG=(--nv)
    apptainer exec "${NV_FLAG[@]}" --bind "${TESTS}:/tests:ro" \
      "${ROOT}/containers/${ENV_NAME}.sif" python /tests/test_gpu.py ${EXTRA}
    ;;
  *)
    echo "Unknown runtime: ${RUNTIME}" >&2
    exit 2
    ;;
esac
