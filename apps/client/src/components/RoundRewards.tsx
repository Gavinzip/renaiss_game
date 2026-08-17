import type { RoundState } from "@renaiss-game/shared";
import { useEffect, useState } from "react";
import { staticAssetUrl } from "../game/assets/staticAssets";
import { useArenaI18n } from "../i18n/arena";

export const ROUND_REWARDS = [
  { id: "round-reward-1", src: staticAssetUrl("/assets/rewards/round-reward-1.webp") },
  { id: "round-reward-2", src: staticAssetUrl("/assets/rewards/round-reward-2.webp") },
  { id: "round-reward-3", src: staticAssetUrl("/assets/rewards/round-reward-3.webp") },
  { id: "round-reward-4", src: staticAssetUrl("/assets/rewards/round-reward-4.webp") }
] as const;

interface RoundRewardsProps {
  round: RoundState;
}

function getRoundRewardIndex(round: RoundState) {
  const roundNumber = Math.max(1, round.roundNumber || 1);
  return (roundNumber - 1) % ROUND_REWARDS.length;
}

export function RoundRewards({ round }: RoundRewardsProps) {
  const { t } = useArenaI18n();
  const [expanded, setExpanded] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const activeIndex = getRoundRewardIndex(round);
  const activeReward = ROUND_REWARDS[activeIndex];
  const activeLabel = t.ui.roundRewardLabel(activeIndex + 1);

  useEffect(() => {
    setExpanded(false);
    setPeeking(false);
  }, [round.roundNumber]);

  const showingDetails = expanded || peeking;

  return (
    <section
      className={`round-rewards ${showingDetails ? "is-expanded" : "is-collapsed"}`}
      aria-label={t.ui.roundRewards}
      onPointerEnter={() => setPeeking(true)}
      onPointerLeave={() => setPeeking(false)}
      onFocus={() => setPeeking(true)}
      onBlur={() => setPeeking(false)}
    >
      <button
        type="button"
        className="round-reward-toggle"
        aria-expanded={showingDetails}
        title={`${t.ui.roundRewards} · ${activeLabel}`}
        onClick={() => setExpanded((current) => !current)}
      >
        <img className="round-reward-icon" src={activeReward.src} alt="" />
        <div className="round-reward-copy">
          <span>{t.ui.roundRewards}</span>
          <b>{activeLabel}</b>
          <small>{t.ui.highScoreWins}</small>
        </div>
        <div className="round-reward-pips" aria-label={t.ui.rewardPool}>
          {ROUND_REWARDS.map((reward, index) => (
            <i
              key={reward.id}
              className={index === activeIndex ? "is-active" : ""}
              title={t.ui.roundRewardLabel(index + 1)}
              aria-hidden="true"
            />
          ))}
        </div>
      </button>
    </section>
  );
}
