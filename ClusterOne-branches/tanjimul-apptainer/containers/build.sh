#!/usr/bin/env bash
# Usage: bash containers/build.sh <pytorch|tensorflow>
# Builds the Docker image, then converts it to an Apptainer .sif file.
set -euo pipefail
export APPTAINER_TMPDIR="${APPTAINER_TMPDIR:-$HOME/.apptainer-tmp}"
mkdir -p "$APPTAINER_TMPDIR"

ENV_NAME="${1:-pytorch}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="clusterone/${ENV_NAME}:latest"
SIF="${ROOT}/containers/${ENV_NAME}.sif"

echo ">> Building Docker image ${IMAGE}"
docker build -t "${IMAGE}" "${ROOT}/containers/${ENV_NAME}"

echo ">> Converting to ${SIF}"
apptainer build --force "${SIF}" "docker-daemon://${IMAGE}"

echo ">> Done: ${SIF}"
