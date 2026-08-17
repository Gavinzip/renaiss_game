import {
  ARENA_SHIELD_REVIEW_EXAMPLE,
  ARENA_STATUS_DEFINITIONS,
  ARENA_STATUS_REVIEW_EXAMPLES,
  CLASS_META,
  getArenaCatalogSkill,
  getArenaCatalogSkillDetail,
  getArenaStatusTone,
  type ArenaLoadoutSlot,
  type ArenaStatusId,
  type ArenaStatusReviewExample,
  type ArenaStatusState,
  type ArenaStatusTone
} from "@renaiss-game/shared";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getStatusAuraRow, STATUS_AURA_FRAME_COUNT, STATUS_AURA_SOURCE_ROWS } from "../game/assets/crops";
import { generatedAssetPath } from "../game/assets/generatedAssets";
import {
  getArenaSkillPackageEntry,
  getArenaSkillPackagePreview
} from "../game/assets/arenaSkillPackageCatalog";
import {
  ARENA_STATUS_PALETTE,
  formatArenaStatusLabel
} from "../game/render/arenaStatusPresentation";
import {
  ARENA_SHIELD_PRESENTATION,
  getArenaStatusPresentation
} from "../game/render/arenaStatusVisualPolicy";
import { ARENA_LANGUAGES, useArenaI18n } from "../i18n/arena";
import { useHudStore } from "../state/hudStore";
import { ArenaCatalogSkillIcon } from "./ArenaSkillIcon";
import { ArenaSkillPreviewMedia } from "./ArenaSkillPreviewMedia";
import { ClassPortrait } from "./ClassPortrait";

export type ArenaStatusReviewKey = ArenaStatusId | "shield";

const STATUS_IDS = Object.keys(ARENA_STATUS_DEFINITIONS) as ArenaStatusId[];
const REVIEW_KEYS: ArenaStatusReviewKey[] = [...STATUS_IDS, "shield"];

const REVIEW_COPY: Record<
  ArenaStatusReviewKey,
  { trigger: string; live: string; note: string }
> = {
  stunned: {
    trigger: "盾面接觸近距離敵人後，目標暈眩 0.45 秒。",
    live: "準星對準右側木樁，靠近後按 Q。",
    note: "唯一同時使用共用素材與紅字的狀態：星星在角色頭頂，文字再疊在星星上方。"
  },
  silenced: {
    trigger: "禁言符起手完成後，目標沉默 2 秒。",
    live: "準星對準右側木樁，按 Q；等起手結束看目標頭頂。",
    note: "技能本身保留禁術封印；共用狀態層只有紅字，不另加沉默素材。"
  },
  rooted: {
    trigger: "根縛範圍碰到敵人後，目標定身 2 秒。",
    live: "準星放在右側木樁腳下，按 E。",
    note: "根脈是根縛技能自己的特效；角色狀態層只顯示紅字。"
  },
  dash_locked: {
    trigger: "砲台射出的破陣鉤彈命中後，封鎖衝刺與翻滾 0.8 秒。",
    live: "先按 F 部署機械砲台，再按 E 讓鉤彈命中右側木樁。",
    note: "這是操作限制，不等於定身；因此獨立顯示「禁移」。"
  },
  vulnerable: {
    trigger: "裂甲斬命中後，目標承受傷害提高 15%，持續 3.5 秒。",
    live: "準星對準右側木樁，靠近後按 Q。",
    note: "裂紋是招式命中特效；共用狀態層只顯示紅字。"
  },
  marked: {
    trigger: "追獵標記指定敵人後，等待下一次命中觸發額外傷害。",
    live: "準星對準右側木樁，按 Q。",
    note: "標記持續 5 秒；共用狀態層只顯示紅字。"
  },
  poisoned: {
    trigger: "毒針咒命中後，目標承受 4 次持續傷害。",
    live: "準星對準右側木樁，按 Q，等毒針命中。",
    note: "酸綠毒針與命中瞬間屬於這個技能；持續狀態層只顯示紅色「中毒」。"
  },
  slowed: {
    trigger: "虛空球命中後，目標移速降低 50%，持續 2 秒。",
    live: "準星對準右側木樁，按 Q，等虛空球命中。",
    note: "虛空球的收束是技能特效；共用狀態層只顯示紅字。"
  },
  duel: {
    trigger: "死鬥宣言指定敵人後，雙方進入死鬥領域 5 秒。",
    live: "準星對準右側木樁，按 R。",
    note: "雙方都會顯示紅色「死鬥」，領域畫面仍屬招式本身。"
  },
  counter: {
    trigger: "反擊姿態施放後立即進入 1.2 秒反擊窗口。",
    live: "按 E，查看自己頭頂。",
    note: "架盾動作是招式特效；共用狀態層只顯示綠字。"
  },
  engineer_support: {
    trigger: "場上已有己方砲台時，支撐砲架讓工程師與砲台進入支撐狀態。",
    live: "先按 F 部署機械砲台，再按 E，查看自己頭頂。",
    note: "沒有砲台時招式會拒絕施放，這是實際前置條件。"
  },
  dodging: {
    trigger: "風切步位移期間進入 0.56 秒閃避。",
    live: "把準星移到空地後按 Q，查看自己頭頂。",
    note: "已依 server 真正位移時長統一為 0.56 秒。"
  },
  concealed: {
    trigger: "隱形施放後持續 2 秒。",
    live: "按 Q，查看自己頭頂；對手端會完全看不到角色。",
    note: "自己端角色淡化並顯示淡青輪廓與綠色「隱形」；其他玩家端完全不顯示角色。"
  },
  enchanted_attacks: {
    trigger: "斬鋒附魔施放後儲存 3 次強化普攻。",
    live: "按 Q，查看自己頭頂；每次有效普攻會扣一層。",
    note: "會以「附魔 ×3」顯示剩餘層數，仍然只有文字。"
  },
  steady_aim: {
    trigger: "穩心瞄準蓄力 1 秒完成後，保存下一發強化箭。",
    live: "按 E，等 1 秒後查看自己頭頂。",
    note: "蓄力動畫是技能特效；狀態準備完成後只顯示綠字。"
  },
  focus_lens: {
    trigger: "聚焦透鏡起手完成後，保存 5 秒並強化下一個成功施放的 Q。",
    live: "按 E，等起手完成後查看自己頭頂。",
    note: "透鏡動畫是技能特效；共用狀態層只顯示綠字。"
  },
  attack_boost: {
    trigger: "戰陣號令施放後，自身與附近隊友傷害提高 12%，持續 4 秒。",
    live: "按 E，查看自己頭頂。",
    note: "移除舊的共用增傷光效後，只保留戰陣號令自己的技能動畫與綠字。"
  },
  speed_boost: {
    trigger: "烈焰狂行施放後，移速提高 25%，持續 5 秒。",
    live: "按 Q，查看自己頭頂。",
    note: "環身烈焰是這招自己的特效；共用狀態層只顯示綠字。"
  },
  shield: {
    trigger: "和平護盾施放後，自身減傷 50%，持續 3 秒。",
    live: "按 E，查看角色周圍的護盾素材。",
    note: "護盾是唯一不顯示頭頂文字的既有正面效果。"
  }
};

const RECIPIENT_LABEL = {
  self: "自己頭頂",
  enemy: "敵人頭頂",
  both: "雙方頭頂"
} as const;

const TONE_LABEL: Record<ArenaStatusTone, string> = {
  positive: "正面／綠字",
  negative: "負面／紅字"
};

function getReviewExample(key: ArenaStatusReviewKey): ArenaStatusReviewExample {
  return key === "shield"
    ? ARENA_SHIELD_REVIEW_EXAMPLE
    : ARENA_STATUS_REVIEW_EXAMPLES[key];
}

export function isArenaStatusReviewKey(value: string | null): value is ArenaStatusReviewKey {
  return value !== null && REVIEW_KEYS.includes(value as ArenaStatusReviewKey);
}

function slotForSkill(skillId: ArenaStatusReviewExample["skillId"]): ArenaLoadoutSlot {
  const skill = getArenaCatalogSkill(skillId);
  if (!skill || skill.tier === "core") {
    throw new Error(`Arena status review skill ${skillId} must use a loadout slot.`);
  }
  if (skill.tier === "basic") return "skillQ";
  if (skill.tier === "intermediate") return "skillE";
  return "skillR";
}

function keyForSlot(slot: ArenaLoadoutSlot) {
  if (slot === "skillQ") return "Q";
  if (slot === "skillE") return "E";
  return "R";
}

function liveReviewUrl(key: ArenaStatusReviewKey) {
  const example = getReviewExample(key);
  const melee = example.skillId === "warrior_05" || example.skillId === "warrior_06";
  const spawnX = 4700;
  const spawnY = 3200;
  const targetX = spawnX + (melee ? 104 : 400);
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("arena", "1");
  url.searchParams.set("reviewStatus", key);
  url.searchParams.set("reviewBots", "1");
  url.searchParams.set("reviewBotCount", "1");
  url.searchParams.set("reviewBotHealth", "10000");
  url.searchParams.set("reviewFreezeBots", "1");
  url.searchParams.set("reviewInvulnerable", "1");
  url.searchParams.set("reviewSpawn", "fixed");
  url.searchParams.set("reviewSpawnX", String(spawnX));
  url.searchParams.set("reviewSpawnY", String(spawnY));
  url.searchParams.set("reviewTargetX", String(targetX));
  url.searchParams.set("reviewTargetY", String(spawnY));
  return url.toString();
}

function StatusMaterial({ type }: { type: "shield" | "stun" }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % STATUS_AURA_FRAME_COUNT);
    }, 90);
    return () => window.clearInterval(timer);
  }, []);

  const row = getStatusAuraRow(type);
  const style = {
    "--status-material-image": `url("${generatedAssetPath("status-effects")}")`,
    "--status-material-x": `${(frame / (STATUS_AURA_FRAME_COUNT - 1)) * 100}%`,
    "--status-material-y": `${(row / (STATUS_AURA_SOURCE_ROWS - 1)) * 100}%`,
    "--status-material-size-x": `${STATUS_AURA_FRAME_COUNT * 100}%`,
    "--status-material-size-y": `${STATUS_AURA_SOURCE_ROWS * 100}%`
  } as CSSProperties;

  return <i className={`arena-status-material is-${type}`} style={style} aria-hidden="true" />;
}

function StatusRecipientPreview({
  reviewKey,
  example
}: {
  reviewKey: ArenaStatusReviewKey;
  example: ArenaStatusReviewExample;
}) {
  const { language } = useArenaI18n();
  const skill = getArenaCatalogSkill(example.skillId);
  if (!skill) return null;

  const statusState: ArenaStatusState | null =
    reviewKey === "shield"
      ? null
      : { id: reviewKey, endsAt: null, stacks: example.stacks };
  const tone = statusState ? getArenaStatusTone(statusState.id) : null;
  const palette = tone ? ARENA_STATUS_PALETTE[tone] : null;
  const presentation = statusState
    ? getArenaStatusPresentation(statusState.id)
    : ARENA_SHIELD_PRESENTATION;
  const recipientClass = example.recipient === "enemy" ? "warrior" : skill.classId;

  return (
    <section className="arena-status-recipient-preview" aria-label="角色狀態顯示規則示意">
      <header>
        <span>02</span>
        <div>
          <small>顯示規則示意</small>
          <strong>{RECIPIENT_LABEL[example.recipient]}</strong>
        </div>
      </header>
      <div className="arena-status-character-stage">
        {presentation.material ? <StatusMaterial type={presentation.material} /> : null}
        <ClassPortrait classId={recipientClass} frame={1} />
        {statusState && palette && presentation.overheadLabel ? (
          <strong
            className={`arena-status-overhead-label is-${tone}`}
            style={{
              "--status-text": palette.text,
              "--status-stroke": palette.stroke
            } as CSSProperties}
          >
            {formatArenaStatusLabel(statusState, language)}
          </strong>
        ) : null}
      </div>
      <footer>
        <span>{reviewKey === "shield" ? "既有護盾素材" : tone ? TONE_LABEL[tone] : ""}</span>
        <small>{reviewKey === "stunned" ? "星星＋紅字" : reviewKey === "shield" ? "只用素材" : "只用文字"}</small>
      </footer>
    </section>
  );
}

export function ArenaStatusEffectReview() {
  const { language, setLanguage, t } = useArenaI18n();
  const initialKey = new URLSearchParams(window.location.search).get("status");
  const [selectedKey, setSelectedKey] = useState<ArenaStatusReviewKey>(
    isArenaStatusReviewKey(initialKey) ? initialKey : "poisoned"
  );
  const example = getReviewExample(selectedKey);
  const skill = getArenaCatalogSkill(example.skillId);
  const detail = getArenaCatalogSkillDetail(example.skillId);
  const preview = getArenaSkillPackagePreview(example.skillId);
  const packageEntry = getArenaSkillPackageEntry(example.skillId);
  const tone = selectedKey === "shield" ? null : getArenaStatusTone(selectedKey);
  const selectedSlot = slotForSkill(example.skillId);
  const groupedKeys = useMemo(
    () => ({
      negative: STATUS_IDS.filter((key) => getArenaStatusTone(key) === "negative"),
      positive: STATUS_IDS.filter((key) => getArenaStatusTone(key) === "positive"),
      special: ["shield"] as ArenaStatusReviewKey[]
    }),
    []
  );

  if (!skill || !detail || !preview || !packageEntry) {
    throw new Error(`Arena status review package is incomplete for ${example.skillId}.`);
  }

  const selectStatus = (key: ArenaStatusReviewKey) => {
    setSelectedKey(key);
    const url = new URL(window.location.href);
    url.searchParams.set("status", key);
    window.history.replaceState(null, "", url);
  };

  return (
    <main className="arena-status-review-page">
      <header className="arena-status-review-header">
        <div>
          <span>ARENA · STATUS LAB</span>
          <h1>競技場狀態實例</h1>
          <p>每一項都綁定真正會觸發該狀態的技能；本頁對照正式技能素材與文字規則，實際觸發請進入競技場。</p>
        </div>
        <div className="arena-status-review-header-actions">
          <div className="arena-status-review-language" aria-label={t.ui.language}>
            {ARENA_LANGUAGES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={language === option.id ? "is-active" : ""}
                aria-pressed={language === option.id}
                onClick={() => setLanguage(option.id)}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
          <a href="?arena=1">回競技場</a>
        </div>
      </header>

      <section className="arena-status-review-rule-strip">
        <span><i className="is-negative" />負面狀態：紅字</span>
        <span><i className="is-positive" />正面狀態：綠字</span>
        <span><i className="is-stun" />暈眩：星星＋紅字</span>
        <span><i className="is-shield" />護盾：既有素材、無文字</span>
      </section>

      <div className="arena-status-review-layout">
        <aside className="arena-status-review-index">
          {([
            ["negative", "負面效果"],
            ["positive", "正面效果"],
            ["special", "既有效果"]
          ] as const).map(([group, label]) => (
            <section key={group}>
              <header>
                <span>{label}</span>
                <b>{groupedKeys[group].length}</b>
              </header>
              <div>
                {groupedKeys[group].map((key) => {
                  const itemExample = getReviewExample(key);
                  const itemSkill = getArenaCatalogSkill(itemExample.skillId);
                  const itemTone = key === "shield" ? "special" : getArenaStatusTone(key);
                  const itemStatus = key === "shield"
                    ? "護盾"
                    : formatArenaStatusLabel({ id: key, endsAt: null, stacks: itemExample.stacks }, language);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`is-${itemTone} ${selectedKey === key ? "is-selected" : ""}`}
                      aria-pressed={selectedKey === key}
                      onClick={() => selectStatus(key)}
                    >
                      <ArenaCatalogSkillIcon skillId={itemExample.skillId} />
                      <span>
                        <strong>{itemStatus}</strong>
                        <small>{itemSkill?.name}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </aside>

        <article className="arena-status-review-detail" style={{ "--class-accent": CLASS_META[skill.classId].accent } as CSSProperties}>
          <header className="arena-status-review-skill-heading">
            <ArenaCatalogSkillIcon skillId={skill.id} />
            <div>
              <span>{t.classes[skill.classId].label} · {keyForSlot(selectedSlot)} · {skill.id}</span>
              <h2>{skill.name}</h2>
              <p>{detail.effect}</p>
            </div>
            <strong className={tone ? `is-${tone}` : "is-special"}>
              {selectedKey === "shield"
                ? "護盾／無文字"
                : `${formatArenaStatusLabel({ id: selectedKey, endsAt: null, stacks: example.stacks }, language)} · ${TONE_LABEL[tone!]}`}
            </strong>
          </header>

          <div className="arena-status-review-visual-row">
            <figure className="arena-status-skill-preview">
              <header>
                <span>01</span>
                <div>
                  <small>正式技能包素材示意</small>
                  <strong>{skill.name} 素材預覽</strong>
                </div>
              </header>
              {packageEntry.visualContract?.enabled === false ? (
                <div className="arena-status-skill-preview-disabled">
                  <ClassPortrait classId={skill.classId} frame={1} />
                  <span>目前未設定獨立技能特效</span>
                  <strong>角色狀態只由頭頂文字呈現</strong>
                </div>
              ) : (
                <ArenaSkillPreviewMedia
                  key={skill.id}
                  skillId={skill.id}
                  label={`${skill.name} 技能素材預覽`}
                />
              )}
              <figcaption>
                <span>{preview.file.split("/").slice(-3, -2)[0]}</span>
                <code>{preview.sha256.slice(0, 12)}</code>
              </figcaption>
              <div className="arena-status-source-state">
                <span className={packageEntry.visualContract?.enabled === false ? "is-off" : "is-on"}>
                  技能 VFX 設定：{packageEntry.visualContract?.enabled === false ? "停用" : "啟用"}
                </span>
                <span className={packageEntry.acceptedAnimationId ? "is-on" : "is-warning"}>
                  {packageEntry.acceptedAnimationId ? "驗收 ID 已記錄" : "驗收 ID 待補"}
                </span>
              </div>
            </figure>

            <StatusRecipientPreview reviewKey={selectedKey} example={example} />
          </div>

          <section className="arena-status-review-behavior">
            <div>
              <span>觸發條件</span>
              <strong>{REVIEW_COPY[selectedKey].trigger}</strong>
            </div>
            <div>
              <span>顯示規則</span>
              <strong>{REVIEW_COPY[selectedKey].note}</strong>
            </div>
            <dl>
              <div><dt>傷害</dt><dd>{detail.damage ?? "0"}</dd></div>
              <div><dt>冷卻</dt><dd>{detail.cooldown ?? "—"}</dd></div>
              <div><dt>持續</dt><dd>{detail.duration ?? "瞬間"}</dd></div>
            </dl>
          </section>

          <footer className="arena-status-review-live-cta">
            <div>
              <span>03 · 實際競技場觸發</span>
              <strong>{REVIEW_COPY[selectedKey].live}</strong>
              <small>會裝備這個真實技能，配置一名靜止高血量木樁；狀態仍由 server 的正常技能流程產生。</small>
            </div>
            <a href={liveReviewUrl(selectedKey)}>進入實機示範</a>
          </footer>
        </article>
      </div>
    </main>
  );
}

export function ArenaStatusLiveReviewBanner({ reviewKey }: { reviewKey: ArenaStatusReviewKey }) {
  const { language } = useArenaI18n();
  const example = getReviewExample(reviewKey);
  const skill = getArenaCatalogSkill(example.skillId);
  const slot = slotForSkill(example.skillId);

  useEffect(() => {
    if (!skill) return;
    const store = useHudStore.getState();
    store.setSelectedClass(skill.classId);
    store.setCatalogLoadoutSkill(skill.classId, slot, skill.id);
    if (skill.classId === "engineer") {
      store.setEngineerTurretKind("mechanical");
    }
  }, [skill, slot]);

  if (!skill) return null;
  const label = reviewKey === "shield"
    ? "護盾／無文字"
    : formatArenaStatusLabel({ id: reviewKey, endsAt: null, stacks: example.stacks }, language);
  const tone = reviewKey === "shield" ? "special" : getArenaStatusTone(reviewKey);

  return (
    <aside className={`arena-status-live-banner is-${tone}`}>
      <span>狀態實機示範</span>
      <ArenaCatalogSkillIcon skillId={skill.id} />
      <div>
        <strong>{label} · {skill.name} · {keyForSlot(slot)}</strong>
        <small>{REVIEW_COPY[reviewKey].live}</small>
      </div>
      <a href={`?arena=1&statusReview=1&status=${reviewKey}`}>返回全部效果</a>
    </aside>
  );
}
