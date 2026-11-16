FROM tensorflow/tensorflow:2.16.1-gpu

# TF 2.16 needs NumPy 1.x; newer OpenCV releases require NumPy 2, so pin both.
RUN pip install --no-cache-dir "numpy<2" "opencv-python-headless<4.12"

WORKDIR /workspace
