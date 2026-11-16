"""ClusterOne container smoke test (PyTorch or TensorFlow).

Default: CPU sanity check must pass; missing GPU is only a warning.
--require-gpu: exit 1 if no GPU is visible inside the container.
"""
import argparse
import sys

parser = argparse.ArgumentParser()
parser.add_argument("--require-gpu", action="store_true")
args = parser.parse_args()


def check_torch():
    import torch

    cuda = torch.cuda.is_available()
    print(f"PyTorch {torch.__version__} | CUDA available: {cuda}")
    x = torch.rand(1000, 1000)
    print("CPU matmul OK:", tuple((x @ x).shape))
    if cuda:
        print("GPU:", torch.cuda.get_device_name(0))
        xg = x.cuda()
        print("GPU matmul OK:", tuple((xg @ xg).shape))
    return cuda


def check_tf():
    import tensorflow as tf

    gpus = tf.config.list_physical_devices("GPU")
    print(f"TensorFlow {tf.__version__} | GPUs: {gpus}")
    x = tf.random.uniform((1000, 1000))
    print("CPU matmul OK:", tuple(tf.matmul(x, x).shape))
    if gpus:
        with tf.device("/GPU:0"):
            print("GPU matmul OK:", tuple(tf.matmul(x, x).shape))
    return bool(gpus)


import importlib.util

if importlib.util.find_spec("torch") is not None:
    has_gpu = check_torch()
else:
    has_gpu = check_tf()

if has_gpu:
    print("RESULT: PASS (GPU)")
elif args.require_gpu:
    print("RESULT: FAIL (GPU required but not found)")
    sys.exit(1)
else:
    print("RESULT: PASS (CPU-only mode)")
