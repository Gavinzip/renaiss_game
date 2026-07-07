import type { RoundState } from "@renaiss-game/shared";
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
  const roundNumberSeed = Math.floor(round.startedAt / Math.max(1, round.durationMs));
  return Math.abs(roundNumberSeed) % ROUND_REWARDS.length;
}

export function RoundRewards({ round }: RoundRewardsProps) {
  const { t } = useArenaI18n();
  const activeIndex = getRoundRewardIndex(round);
  const activeReward = ROUND_REWARDS[activeIndex];
  const activeLabel = t.ui.roundRewardLabel(activeIndex + 1);

  return (
    <section className="round-rewards" aria-label={t.ui.roundRewards}>
      <header>
        <span>{t.ui.roundRewards}</span>
        <strong>{t.ui.highScoreWins}</strong>
      </header>
      <div className="round-reward-stage">
        <img src={activeReward.src} alt={activeLabel} />
        <div>
          <b>{activeLabel}</b>
          <small>{t.ui.highScoreWins}</small>
        </div>
      </div>
      <div className="round-reward-strip" aria-label={t.ui.rewardPool}>
        {ROUND_REWARDS.map((reward, index) => (
          <img
            key={reward.id}
            className={index === activeIndex ? "is-active" : ""}
            src={reward.src}
            alt={t.ui.roundRewardLabel(index + 1)}
          />
        ))}
      </div>
    </section>
  );
}
