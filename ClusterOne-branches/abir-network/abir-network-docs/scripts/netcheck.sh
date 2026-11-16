#!/usr/bin/env bash
# Moved: the maintained version lives in infrastructure/networking/scripts/ (needs its lib.sh).
exec "$(cd "$(dirname "$0")" && pwd)/../../infrastructure/networking/scripts/netcheck.sh" "$@"
