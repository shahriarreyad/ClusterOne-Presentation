# ClusterOne Containers

Reproducible AI environments for ClusterOne. Each environment is a Dockerfile
(source of truth) that is converted to an Apptainer `.sif` image for Slurm.

```
Dockerfile -> Docker image -> Apptainer .sif -> Slurm job -> GPU
```

## Layout

```
containers/
  build.sh              # Docker build + convert to .sif
  pytorch/Dockerfile    # PyTorch 2.4 + CUDA 12.4
  tensorflow/Dockerfile # TensorFlow 2.16.1 (GPU build)
  tests/
    test_gpu.py         # CPU sanity check, GPU check with --require-gpu
    run_tests.sh        # runs test_gpu.py inside Docker or Apptainer
  examples/
    train_mnist.py      # small training example
    slurm_pytorch.sbatch
```

## Platform support

| Platform | How to run | GPU |
|---|---|---|
| Windows (first target) | WSL2 Ubuntu + Docker Desktop + Apptainer | NVIDIA via WSL2 |
| Linux (cluster nodes) | Apptainer natively, `--nv` | NVIDIA |
| macOS | Docker (Desktop or Colima); Apptainer only inside a Linux VM | None (CPU only) |

Apptainer runs only on Linux, so Windows needs WSL2 and macOS needs a VM.
macOS has not been tested yet.

## Setup on Windows (WSL2)

1. Install WSL2 and Ubuntu: `wsl --install -d Ubuntu`, then restart.
2. Install Docker Desktop, enable WSL integration for Ubuntu.
3. In Ubuntu, install Apptainer:
```bash
   sudo apt update && sudo apt install -y software-properties-common git
   sudo add-apt-repository -y ppa:apptainer/ppa
   sudo apt update && sudo apt install -y apptainer
```
4. Clone the repo **inside the WSL home folder** (`~`), not under `/mnt/c`.
5. For GPU use, install the NVIDIA driver on Windows only (not inside WSL).

## Build

```bash
bash containers/build.sh pytorch
bash containers/build.sh tensorflow
```

Set a temp folder on a disk with space before building (Apptainer unpacks
large images there):

```bash
export APPTAINER_TMPDIR=$HOME/.apptainer-tmp
export APPTAINER_CACHEDIR=$HOME/.apptainer-cache
mkdir -p "$APPTAINER_TMPDIR" "$APPTAINER_CACHEDIR"
```

Plan for 25-30 GB of free disk space. `.sif` files are git-ignored.

## Test

```bash
# CPU (works without a GPU)
bash containers/tests/run_tests.sh pytorch docker
bash containers/tests/run_tests.sh pytorch apptainer

# GPU (requires an NVIDIA GPU; fails if none is found)
bash containers/tests/run_tests.sh pytorch docker --require-gpu
bash containers/tests/run_tests.sh pytorch apptainer --require-gpu
```

Expected last line: `RESULT: PASS (CPU-only mode)` or `RESULT: PASS (GPU)`.

## Run on the cluster

```bash
mkdir -p logs
SIF=/shared/containers/pytorch.sif sbatch containers/examples/slurm_pytorch.sbatch
```

## Test status

| Test | PyTorch | TensorFlow |
|---|---|---|
| Docker, CPU | pass | pass |
| Apptainer, CPU | pass | pass |
| Docker, GPU | not yet run | not yet run |
| Apptainer `--nv`, GPU | not yet run | not yet run |

## Known issues

- **`no space left on device` during `.sif` conversion:** set `APPTAINER_TMPDIR`
  (see Build) and free disk space on the Windows C: drive. The WSL disk grows
  on demand but is limited by C:.
- **PC freezes during a build (WSL):** limit WSL memory in `%USERPROFILE%\.wslconfig`
  (for example `memory=6GB`, `swap=8GB`), then run `wsl --shutdown`.
- **`$'\r': command not found` in scripts:** Windows line endings. Run
  `dos2unix containers/build.sh containers/tests/*.sh`. `.gitattributes` forces LF.
- **`*:Zone.Identifier` files:** created when files are downloaded through Windows.
  Delete them: `find . -name '*:Zone.Identifier' -delete`.
- **TensorFlow fails with a NumPy error:** TF 2.16 needs NumPy 1.x. The TensorFlow
  Dockerfile pins `numpy<2`; keep it pinned when adding packages.
