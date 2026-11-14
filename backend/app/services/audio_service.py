"""Audio acoustic analysis & local Whisper transcription service."""

from datetime import datetime, timezone
import json
from pathlib import Path
import re
from typing import Dict, List, Optional
import uuid

from faster_whisper import WhisperModel
import librosa
import numpy as np
import soundfile as sf

from ..config import AUDIO_THRESHOLDS, DB_PATH, MODELS_DIR, UPLOADS_DIR, WHISPER_MODEL_SIZE
from ..database import db_session
from ..schemas.cognitive import AudioMeasurements, CognitiveAudioResponse


_WHISPER_MODEL: Optional[WhisperModel] = None


def _get_whisper_model() -> Optional[WhisperModel]:
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        whisper_dir = MODELS_DIR / "whisper"
        try:
            _WHISPER_MODEL = WhisperModel(
                WHISPER_MODEL_SIZE,
                device="cpu",
                compute_type="int8",
                download_root=str(whisper_dir),
                local_files_only=True,
            )
        except Exception:
            return None
    return _WHISPER_MODEL


def _compute_word_repetition(transcript: str) -> float:
    words = re.findall(r"[a-zA-Z']+", transcript.lower())
    if len(words) < 4:
        return 0.0
    consecutive_repeats = sum(1 for i in range(1, len(words)) if words[i] == words[i - 1])
    unique_ratio = len(set(words)) / len(words)
    repetition_score = (consecutive_repeats / len(words)) * 100.0 + max(0.0, (0.65 - unique_ratio) * 30.0)
    return round(float(np.clip(repetition_score, 0.0, 100.0)), 2)


def analyze_cognitive_audio(
    astronaut_id: str,
    audio_bytes: bytes,
    filename: str = "recording.wav",
    is_synthetic: bool = False,
    db_path: Path = DB_PATH,
) -> CognitiveAudioResponse:
    """Extract acoustic metrics via Librosa, transcribe locally with Whisper, and compare to baseline."""
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    ext = Path(filename).suffix.lower() or ".wav"
    if ext not in {".wav", ".mp3", ".ogg", ".flac"}:
        raise ValueError("Unsupported audio format. Please upload WAV or MP3 (or use live mic capture).")

    run_id = uuid.uuid4().hex[:10]
    audio_path = UPLOADS_DIR / f"audio_{astronaut_id}_{run_id}{ext}"
    audio_path.write_bytes(audio_bytes)

    with db_session(db_path) as conn:
        row = conn.execute(
            """
            SELECT speech_rate_wpm, pause_duration_sec, voice_energy_rms, voice_variability
            FROM baselines WHERE astronaut_id = ?
            """,
            (astronaut_id,),
        ).fetchone()
        if row is None:
            raise LookupError(f"Astronaut '{astronaut_id}' not found.")
        base_rate = float(row["speech_rate_wpm"])
        base_pause = float(row["pause_duration_sec"])
        base_energy = float(row["voice_energy_rms"])
        base_var = float(row["voice_variability"])

    try:
        y, sr = librosa.load(str(audio_path), sr=16000, mono=True)
    except Exception as exc:
        raise ValueError(f"Could not decode audio stream: {exc}") from exc

    duration_sec = round(float(len(y) / sr), 2) if sr > 0 else 0.0
    if duration_sec < AUDIO_THRESHOLDS["min_duration_sec"]:
        res = CognitiveAudioResponse(
            astronaut_id=astronaut_id,
            timestamp=now_iso,
            status="audio_too_short",
            error_code="audio_too_short",
            error_detail=f"Audio duration ({duration_sec}s) is below minimum {AUDIO_THRESHOLDS['min_duration_sec']}s.",
            data_quality=0.2,
            transcript="",
            transcription_engine="skipped",
            measurements=AudioMeasurements(duration_sec=duration_sec),
            anomalies=["audio_too_short"],
            is_synthetic=is_synthetic,
        )
        _save_audio_row(res, db_path)
        return res

    # Normalize to wav for Whisper compatibility if input was mp3
    wav_for_stt = audio_path
    if ext != ".wav":
        wav_for_stt = UPLOADS_DIR / f"audio_{astronaut_id}_{run_id}_16k.wav"
        sf.write(str(wav_for_stt), y, sr)

    rms_frames = librosa.feature.rms(y=y, frame_length=512, hop_length=256)[0]
    mean_rms = float(np.mean(rms_frames))
    clipping_ratio = float(np.mean(np.abs(y) >= 0.985))

    p90 = float(np.percentile(rms_frames, 90)) + 1e-6
    p15 = float(np.percentile(rms_frames, 15)) + 1e-6
    snr_db = round(float(20.0 * np.log10(p90 / p15)), 2)

    quality_issues: List[str] = []
    if clipping_ratio > AUDIO_THRESHOLDS["max_clipping_ratio"]:
        quality_issues.append(f"signal clipping ({clipping_ratio * 100:.1f}%)")
    if mean_rms < AUDIO_THRESHOLDS["min_rms_energy"]:
        quality_issues.append("microphone signal too quiet")
    if snr_db < 6.0:
        quality_issues.append(f"high background noise floor (est. SNR {snr_db} dB)")

    if quality_issues:
        res = CognitiveAudioResponse(
            astronaut_id=astronaut_id,
            timestamp=now_iso,
            status="noisy_audio",
            error_code="noisy_audio",
            error_detail="Audio quality insufficient for acoustic metrics: " + "; ".join(quality_issues) + ".",
            data_quality=round(float(np.clip(snr_db / 25.0, 0.08, 0.42)), 2),
            transcript="",
            transcription_engine="skipped",
            measurements=AudioMeasurements(
                duration_sec=duration_sec,
                voice_energy_rms=round(mean_rms, 4),
                snr_db_estimate=snr_db,
            ),
            anomalies=["noisy_audio"],
            is_synthetic=is_synthetic,
        )
        _save_audio_row(res, db_path)
        return res

    # Voiced segmentation for pauses
    intervals = librosa.effects.split(y, top_db=24, frame_length=1024, hop_length=256)
    voiced_samples = sum(int(end - start) for start, end in intervals)
    voiced_sec = max(0.4, voiced_samples / sr)
    pause_durations: List[float] = []
    for i in range(1, len(intervals)):
        gap_sec = (intervals[i][0] - intervals[i - 1][1]) / sr
        if gap_sec >= 0.12:
            pause_durations.append(float(gap_sec))
    mean_pause = round(float(np.mean(pause_durations)) if pause_durations else 0.25, 3)
    pause_ratio = round(float(max(0.0, duration_sec - voiced_sec) / max(0.5, duration_sec)), 3)

    # Pitch variability (F0 std in Hz)
    try:
        f0 = librosa.yin(y, fmin=75, fmax=360, sr=sr)
        voiced_f0 = f0[(f0 > 80) & (f0 < 350)]
        voice_var = round(float(np.std(voiced_f0)) if len(voiced_f0) > 8 else 18.0, 2)
    except Exception:
        voice_var = 18.0

    # Local offline transcription
    transcript = ""
    engine = "librosa-onset-fallback"
    model = _get_whisper_model()
    if model is not None:
        try:
            segments, _ = model.transcribe(str(wav_for_stt), beam_size=1, language="en")
            transcript = " ".join(seg.text.strip() for seg in segments).strip()
            engine = f"faster-whisper-{WHISPER_MODEL_SIZE}-offline"
        except Exception:
            transcript = ""

    words = re.findall(r"[a-zA-Z0-9']+", transcript)
    if len(words) >= 2:
        speech_rate_wpm = round(float(len(words) / (voiced_sec / 60.0)), 1)
    else:
        # Onset-based syllable rate fallback
        onsets = librosa.onset.onset_detect(y=y, sr=sr)
        est_words = max(1.0, len(onsets) / 1.6)
        speech_rate_wpm = round(float(est_words / (voiced_sec / 60.0)), 1)
        if not transcript:
            transcript = "[Acoustic speech detected; transcript unavailable]"

    word_rep = _compute_word_repetition(transcript)
    data_quality = round(float(np.clip(0.55 + (snr_db / 40.0) * 0.43, 0.55, 0.98)), 2)

    rate_chg = round(((speech_rate_wpm - base_rate) / max(1.0, base_rate)) * 100.0, 2)
    pause_chg = round(((mean_pause - base_pause) / max(0.05, base_pause)) * 100.0, 2)
    energy_chg = round(((mean_rms - base_energy) / max(0.001, base_energy)) * 100.0, 2)
    var_chg = round(((voice_var - base_var) / max(1.0, base_var)) * 100.0, 2)

    anomalies: List[str] = []
    if abs(rate_chg) >= AUDIO_THRESHOLDS["speech_rate_yellow_pct"]:
        anomalies.append("speech_rate_shift")
    if pause_chg >= AUDIO_THRESHOLDS["pause_yellow_pct"]:
        anomalies.append("pause_duration_increase")
    if word_rep >= 12.0:
        anomalies.append("word_repetition_elevated")

    res = CognitiveAudioResponse(
        astronaut_id=astronaut_id,
        timestamp=now_iso,
        status="ok",
        data_quality=data_quality,
        transcript=transcript,
        transcription_engine=engine,
        measurements=AudioMeasurements(
            duration_sec=duration_sec,
            speech_rate_wpm=speech_rate_wpm,
            pause_duration_sec=mean_pause,
            pause_ratio=pause_ratio,
            voice_energy_rms=round(mean_rms, 4),
            voice_variability=voice_var,
            word_repetition_ratio=word_rep,
            snr_db_estimate=snr_db,
        ),
        baseline_comparison={
            "speech_rate_change_percent": rate_chg,
            "pause_duration_change_percent": pause_chg,
            "voice_energy_change_percent": energy_chg,
            "voice_variability_change_percent": var_chg,
        },
        anomalies=anomalies,
        is_synthetic=is_synthetic,
    )
    res.id = _save_audio_row(res, db_path)
    return res


def _save_audio_row(res: CognitiveAudioResponse, db_path: Path) -> int:
    with db_session(db_path) as conn:
        cur = conn.execute(
            """
            INSERT INTO cognitive_audio_analyses (
                astronaut_id, timestamp, status, error_code, error_detail,
                data_quality, transcript, transcription_engine,
                measurements_json, baseline_comparison_json, anomalies_json, is_synthetic
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                res.astronaut_id,
                res.timestamp,
                res.status,
                res.error_code,
                res.error_detail,
                res.data_quality,
                res.transcript,
                res.transcription_engine,
                res.measurements.model_dump_json(),
                json.dumps(res.baseline_comparison),
                json.dumps(res.anomalies),
                1 if res.is_synthetic else 0,
            ),
        )
        conn.execute(
            """
            INSERT INTO offline_sync_queue (astronaut_id, module, payload_summary, status, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                res.astronaut_id,
                "cognitive_audio",
                f"status={res.status}, quality={res.data_quality}, duration={res.measurements.duration_sec}s",
                "queued_offline",
                res.timestamp,
            ),
        )
        return int(cur.lastrowid)
