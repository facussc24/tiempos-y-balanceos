import os
os.environ["HF_HUB_DISABLE_SYMLINKS"]="1"
os.environ["HF_HUB_DISABLE_XET"]="1"
from faster_whisper import WhisperModel
print("bajando large-v3-turbo...", flush=True)
m = WhisperModel("large-v3-turbo", device="cpu", compute_type="int8")
print("MODELO OK", flush=True)
