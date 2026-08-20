import { memo } from "react";
import { useArenaI18n } from "../i18n/arena";
import { useHudStore } from "../state/hudStore";

type NetworkQuality = "pending" | "good" | "fair" | "poor";

export const NetworkPingIndicator = memo(function NetworkPingIndicator() {
  const { language } = useArenaI18n();
  const latencyMs = useHudStore((state) => state.networkLatencyMs);
  const quality = networkQuality(latencyMs);
  const qualityLabel = networkQualityLabel(language, quality);
  const value = latencyMs === null ? "--" : String(latencyMs);
  const ariaLabel = language === "zh"
    ? `網路延遲 ${value} 毫秒，${qualityLabel}`
    : language === "ko"
      ? `네트워크 지연 ${value}밀리초, ${qualityLabel}`
      : `Network latency ${value} milliseconds, ${qualityLabel}`;

  return (
    <section
      className="network-ping-indicator"
      data-quality={quality}
      role="status"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <i className="network-ping-bars" aria-hidden="true">
        <b />
        <b />
        <b />
      </i>
      <span>PING</span>
      <strong>{value}<small>ms</small></strong>
    </section>
  );
});

function networkQuality(latencyMs: number | null): NetworkQuality {
  if (latencyMs === null) return "pending";
  if (latencyMs <= 80) return "good";
  if (latencyMs <= 160) return "fair";
  return "poor";
}

function networkQualityLabel(language: "zh" | "en" | "ko", quality: NetworkQuality) {
  if (language === "zh") {
    if (quality === "good") return "連線良好";
    if (quality === "fair") return "連線普通";
    if (quality === "poor") return "連線不穩";
    return "正在量測";
  }
  if (language === "ko") {
    if (quality === "good") return "연결 좋음";
    if (quality === "fair") return "연결 보통";
    if (quality === "poor") return "연결 불안정";
    return "측정 중";
  }
  if (quality === "good") return "good connection";
  if (quality === "fair") return "fair connection";
  if (quality === "poor") return "unstable connection";
  return "measuring";
}
