import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Download, Pause, Play } from "lucide-react";

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const WAVE_BARS = Array.from({ length: 56 }, (_, index) => {
  const wave = Math.abs(Math.sin(index * 0.72)) * 0.68 + Math.abs(Math.cos(index * 0.27)) * 0.32;
  return Math.round(22 + wave * 78);
});

interface AudioPlayerProps {
  src: string | null;
  detail: string | null;
  title: string;
  busy: boolean;
}

export function AudioPlayer({ src, detail, title, busy }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState("");

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const activeBars = useMemo(() => Math.floor(progress * WAVE_BARS.length), [progress]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioError("");
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMetadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setAudioError("音频加载失败，请重新生成");
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMetadata);
    audio.addEventListener("durationchange", onMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onPause);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMetadata);
      audio.removeEventListener("durationchange", onMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onPause);
      audio.removeEventListener("error", onError);
    };
  }, [src]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setAudioError("浏览器拦截了播放，请再点一次播放按钮");
      }
      return;
    }
    audio.pause();
  }

  function seek(nextTime: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  if (!src) {
    return (
      <div className={busy ? "audio-empty is-busy" : "audio-empty"}>
        <span className="audio-empty-icon">
          <span className="audio-ring ring-one" />
          <span className="audio-ring ring-two" />
          <AudioLines size={23} />
        </span>
        <div>
          <span className="audio-eyebrow">AI PODCAST</span>
          <h3>{busy ? "正在为这段文字合成声音" : "生成的播客会在这里播放"}</h3>
          <p>{busy ? "执行完成后，点击播放即可试听。" : "输入测试文字并运行工作流，几秒后回来听。"}</p>
        </div>
        <div className="audio-empty-wave" aria-hidden="true">
          {WAVE_BARS.slice(0, 28).map((height, index) => (
            <i key={index} style={{ height: `${Math.max(14, height * 0.55)}%` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="audio-player-card">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="audio-player-top">
        <span className="audio-eyebrow">AI PODCAST · READY</span>
        <span className="audio-detail">{detail || "Edge Neural"}</span>
      </div>
      <div className="audio-player-main">
        <button
          type="button"
          className="audio-play-button"
          onClick={() => void togglePlay()}
          aria-label={playing ? "暂停播客" : "播放播客"}
        >
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <div className="audio-track">
          <div className="audio-track-title">
            <strong>{title}</strong>
            <span>
              {formatClock(currentTime)} / {formatClock(duration)}
            </span>
          </div>
          <div className="audio-wave" aria-hidden="true">
            {WAVE_BARS.map((height, index) => (
              <i
                key={index}
                className={index < activeBars ? "is-active" : ""}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <input
            className="audio-seek"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            aria-label="播放进度"
            disabled={duration <= 0}
            onChange={(event) => seek(Number(event.target.value))}
          />
        </div>
        <a className="audio-download" href={src} download="paiagent-podcast.mp3" title="下载音频">
          <Download size={17} />
        </a>
      </div>
      {audioError ? <p className="audio-error">{audioError}</p> : null}
    </div>
  );
}
