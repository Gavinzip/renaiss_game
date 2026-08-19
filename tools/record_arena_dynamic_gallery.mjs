import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = readOption("--base-url") ?? "http://127.0.0.1:5173";
const PHASE = readOption("--phase") ?? "dynamic-gameplay-20260805";
const GALLERY_SET = readOption("--set") ?? "curated";
const REQUESTED_ASSET_VARIANT = readOption("--asset-variant");
const ASSET_VARIANT = "canonical";
const RANDOM_SEED = Number(readOption("--seed") ?? "20260805");
const CLEAN_CANVAS_ONLY = process.argv.includes("--clean-canvas-only");
const DESIRED_DISTANCE_OVERRIDE = readOption("--desired-distance");
const ARCHER_MOVING_DRAW_ATLAS_OVERRIDE = readOption(
  "--archer-moving-draw-atlas"
);
const ARCHER_ACTION_BODY_ATLAS_OVERRIDE = readOption(
  "--archer-action-body-atlas"
);
const ARCHER_ACTION_BODY_SKILL_ID = readOption(
  "--archer-action-body-skill-id"
);
const ENGINEER_SIEGE_IMPACT_OVERRIDE = readOption(
  "--engineer-siege-impact"
);
const ENGINEER_SIEGE_VFX_OVERRIDE = readOption("--engineer-siege-vfx");
const ONLY = readOption("--only")
  ?.split(",")
  .map((value) => value.trim())
  .filter(Boolean) ?? [];
const TELEMETRY_INTERVAL_MS = Math.max(
  16,
  Number(readOption("--telemetry-interval-ms") ?? "50")
);
const RUNTIME_CAPTURE_INTERVAL_MS = Math.max(
  33,
  Number(readOption("--runtime-capture-interval-ms") ?? "100")
);
const HQ_PREVIEW_FPS = Math.max(
  0,
  Number(readOption("--hq-preview-fps") ?? "0")
);
const HQ_PREVIEW_BITRATE = Math.max(
  1_000_000,
  Number(readOption("--hq-preview-bitrate") ?? "16000000")
);
const SKIP_RUNTIME_PNG = process.argv.includes("--skip-runtime-png");
const SKIP_PLAYWRIGHT_VIDEO = process.argv.includes("--skip-playwright-video");
const VIEWPORT = {
  width: Math.max(1280, Number(readOption("--viewport-width") ?? "1280")),
  height: Math.max(720, Number(readOption("--viewport-height") ?? "720"))
};
const REVIEW_CAMERA_ZOOM = Math.max(
  1,
  Number(readOption("--review-camera-zoom") ?? "1")
);
const OUTPUT_DIR = readOption("--output-dir")
  ? path.resolve(ROOT, readOption("--output-dir"))
  : path.join(ROOT, "docs/design/arena-dynamic-gameplay-review", PHASE);
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (REQUESTED_ASSET_VARIANT && REQUESTED_ASSET_VARIANT !== "canonical") {
  throw new Error(
    `Arena skills now have one packaged runtime; --asset-variant ${REQUESTED_ASSET_VARIANT} is no longer selectable.`
  );
}

mkdirSync(OUTPUT_DIR, { recursive: true });

const archerMovingDrawAtlasOverride = ARCHER_MOVING_DRAW_ATLAS_OVERRIDE
  ? loadReviewAssetOverride(ARCHER_MOVING_DRAW_ATLAS_OVERRIDE)
  : null;
if (Boolean(ARCHER_ACTION_BODY_ATLAS_OVERRIDE) !== Boolean(ARCHER_ACTION_BODY_SKILL_ID)) {
  throw new Error(
    "--archer-action-body-atlas and --archer-action-body-skill-id must be provided together."
  );
}
const archerActionBodyAtlasOverride = ARCHER_ACTION_BODY_ATLAS_OVERRIDE
  ? loadArcherActionBodyReviewOverride(
      ARCHER_ACTION_BODY_SKILL_ID,
      ARCHER_ACTION_BODY_ATLAS_OVERRIDE
    )
  : null;
if (Boolean(ENGINEER_SIEGE_IMPACT_OVERRIDE) !== Boolean(ENGINEER_SIEGE_VFX_OVERRIDE)) {
  throw new Error(
    "--engineer-siege-impact and --engineer-siege-vfx must be provided together."
  );
}
if (
  [
    archerMovingDrawAtlasOverride,
    archerActionBodyAtlasOverride,
    ENGINEER_SIEGE_IMPACT_OVERRIDE
  ].filter(Boolean).length > 1
) {
  throw new Error("Only one explicit review asset override may be active per recording.");
}
const engineerSiegeImpactOverride = ENGINEER_SIEGE_IMPACT_OVERRIDE
  ? loadEngineerSiegeReviewOverride(
      ENGINEER_SIEGE_IMPACT_OVERRIDE,
      ENGINEER_SIEGE_VFX_OVERRIDE
    )
  : null;

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_PATH,
  args:
    HQ_PREVIEW_FPS > 0
      ? ["--no-sandbox", "--enable-gpu", "--use-angle=metal"]
      : ["--no-sandbox", "--disable-gpu"]
});

const report = {
  phase: PHASE,
  capturedAt: new Date().toISOString(),
  source: BASE_URL,
  assetVariant: ASSET_VARIANT,
  viewport: VIEWPORT,
  reviewCameraZoom: REVIEW_CAMERA_ZOOM,
  gallerySet: GALLERY_SET,
  randomSeed: GALLERY_SET === "random30" ? RANDOM_SEED : null,
  fallbackUsed: false,
  reviewAssetOverride: archerMovingDrawAtlasOverride
    ? {
        kind: "archer-moving-full-draw-atlas",
        path: archerMovingDrawAtlasOverride.path,
        sha256: archerMovingDrawAtlasOverride.sha256,
        requiredRequestKinds: ["asset"],
        sourceSubstitutionForReview: true,
        fallbackUsed: false
      }
    : archerActionBodyAtlasOverride
    ? {
        kind: "archer-action-body-atlas",
        skillId: archerActionBodyAtlasOverride.skillId,
        assetUrl: archerActionBodyAtlasOverride.assetUrl,
        path: archerActionBodyAtlasOverride.path,
        sha256: archerActionBodyAtlasOverride.sha256,
        requiredRequestKinds: ["asset"],
        generatedReplacement: true,
        formalPromotionPendingUserSelection: true,
        sourceSubstitutionForReview: true,
        fallbackUsed: false
      }
    : engineerSiegeImpactOverride
    ? {
        kind: "engineer-06-topdown-impact-candidate",
        path: engineerSiegeImpactOverride.path,
        sha256: engineerSiegeImpactOverride.sha256,
        vfxPath: engineerSiegeImpactOverride.vfxPath,
        vfxSha256: engineerSiegeImpactOverride.vfxSha256,
        manifestModuleSha256: engineerSiegeImpactOverride.manifestModuleSha256,
        acceptedAnimationId:
          engineerSiegeImpactOverride.acceptedAnimationId,
        semanticAnchor: engineerSiegeImpactOverride.semanticAnchor,
        radiusAspect: engineerSiegeImpactOverride.radiusAspect,
        requiredRequestKinds: ["manifest", "impact"],
        generatedReplacement: true,
        formalPromotionPendingUserSelection: true,
        sourceSubstitutionForReview: true,
        fallbackUsed: false
      }
    : null,
  captureSurface: CLEAN_CANVAS_ONLY ? "game-canvas-only" : "full-gameplay-ui",
  hqPreviewCapture:
    HQ_PREVIEW_FPS > 0
      ? {
          source: "canvas-capture-stream",
          requestedFrameRate: HQ_PREVIEW_FPS,
          requestedBitrate: HQ_PREVIEW_BITRATE,
          viewport: VIEWPORT,
          interpolation: false,
          fallbackUsed: false
        }
      : null,
  scenarios: [],
  retries: [],
  failures: []
};

async function main() {
  try {
    if (GALLERY_SET === "engineerFollowups") {
      await recordEngineerFollowups();
    } else if (GALLERY_SET === "allSkills") {
      await recordAllSkills();
    } else if (GALLERY_SET === "selectable60") {
      await recordAllSelectableSkills();
    } else if (GALLERY_SET === "random30") {
      await recordRandomThirty();
    } else {
      if (shouldRecord("warrior-basic-combo")) await recordWarriorBasicAttack();
      if (shouldRecord("warrior-charge")) await recordWarriorCharge();
      if (shouldRecord("warrior-ground-slam")) await recordWarriorGroundSlam();
      if (shouldRecord("archer-full-draw")) await recordArcherFullDraw();
      if (shouldRecord("archer-forest-roll")) await recordArcherForestRoll();
      if (shouldRecord("engineer-mechanical-turret")) await recordMechanicalTurret();
      if (shouldRecord("engineer-barrier-network")) await recordBarrierNetwork();
      if (shouldRecord("engineer-rapid-detonation")) await recordRapidDetonation();
      if (shouldRecord("engineer-magic-matrix")) await recordMagicMissileMatrix();
      if (shouldRecord("mage-forbidden-astrolabe")) await recordMageForbiddenAstrolabe();
      if (shouldRecord("team-3v3-fight")) await recordTeamFight();
      if (shouldRecord("promo-warrior-role")) await recordPromoWarriorRole();
      if (shouldRecord("promo-archer-role")) await recordPromoArcherRole();
      if (shouldRecord("promo-engineer-role")) await recordPromoEngineerRole();
      if (shouldRecord("promo-mage-role")) await recordPromoMageRole();
    }
  } finally {
    await browser.close();
  }

  report.status = report.failures.length === 0 ? "GREEN" : "RED";
  writeFileSync(
    path.join(OUTPUT_DIR, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(
    JSON.stringify(
      {
        status: report.status,
        outputDir: OUTPUT_DIR,
        scenarios: report.scenarios.map(({ id, label, video, failures }) => ({
          id,
          label,
          video,
          failures
        })),
        failures: report.failures
      },
      null,
      2
    )
  );
  if (report.failures.length > 0) process.exitCode = 1;
}

async function recordEngineerFollowups() {
  const requestedIds = new Set([
    "random-engineer_00-mechanical",
    "random-engineer_06",
    "random-engineer_15"
  ]);
  const selected = RANDOM_SCENE_POOLS.engineer.filter((scene) =>
    requestedIds.has(scene.id)
  );
  await recordSelectedSkills(selected);
  for (const distance of [100, 320]) {
    const id = `engineer-barrier-distance-${distance}`;
    if (shouldRecord(id)) await recordBarrierDistance(distance);
  }
  report.selection = [
    ...report.selection,
    ...[100, 320].map((distance) => ({
      skillId: "engineer_08",
      name: `屏障節點・${distance} 距離`,
      classId: "engineer",
      slot: "skillQ"
    }))
  ];
}

const CLASS_LABELS = {
  warrior: "戰士",
  archer: "射手",
  engineer: "工程師",
  mage: "法師"
};

const DEFAULT_LOADOUTS = {
  warrior: {
    skillQ: "warrior_04",
    skillE: "warrior_08",
    skillR: "warrior_14"
  },
  archer: {
    skillQ: "archer_01",
    skillE: "archer_08",
    skillR: "archer_13"
  },
  engineer: {
    skillQ: "engineer_12",
    skillE: "engineer_14",
    skillR: "engineer_15"
  },
  mage: {
    skillQ: "mage_00",
    skillE: "mage_07",
    skillR: "mage_12"
  }
};

const RANDOM_SCENE_POOLS = {
  warrior: [
    randomScene("warrior_00", "守線橫斬", "skillQ", 390, 1700),
    randomScene("warrior_01", "烈焰狂行", "skillQ", 180, 900, {
      sequence: "warrior-hammer-speed-run"
    }),
    randomScene("warrior_02", "戰環斬", "skillQ", 115, 1700),
    randomScene("warrior_03", "斬鋒附魔", "skillQ", 78, 1000, {
      sequence: "warrior-enchant-hit"
    }),
    randomScene("warrior_04", "正義衝鋒", "skillQ", 330, 1900),
    randomScene("warrior_05", "盾首震擊", "skillQ", 100, 1600),
    randomScene("warrior_06", "裂甲斬", "skillQ", 70, 1800),
    randomScene("warrior_07", "反擊姿態", "skillE", 110, 2100),
    randomScene("warrior_08", "和平護盾", "skillE", 150, 3200),
    randomScene("warrior_09", "戰陣號令", "skillE", 210, 4300),
    randomScene("warrior_10", "獵首突刺", "skillE", 150, 1800),
    randomScene("warrior_11", "裂地震", "skillE", 160, 2100),
    randomScene("warrior_12", "斷城震落", "skillR", 180, 2500),
    randomScene("warrior_13", "死鬥宣言", "skillR", 320, 5300),
    randomScene("warrior_14", "裁決", "skillR", 230, 2400)
  ],
  archer: [
    randomScene("archer_00", "月牙刃", "skillQ", 330, 2400),
    randomScene("archer_01", "森林翻滾", "skillQ", 300, 1800),
    randomScene("archer_02", "穿葉箭", "skillQ", 470, 1800),
    randomScene("archer_03", "荊刺陷阱", "skillQ", 180, 6300),
    randomScene("archer_04", "隱形", "skillQ", 350, 850, {
      sequence: "archer-invisibility"
    }),
    randomScene("archer_05", "追獵標記", "skillQ", 380, 5300),
    randomScene("archer_06", "風切步", "skillQ", 280, 1800),
    randomScene("archer_07", "暗鉤牽引 → 自動隼影處刑", "skillE", 400, 2600, {
      sequence: "archer-hook-execution",
      loadoutOverrides: { skillR: "archer_14" }
    }),
    randomScene("archer_08", "根縛", "skillE", 330, 2600),
    randomScene("archer_09", "穩心瞄準", "skillE", 390, 3200, {
      sequence: "archer-steady-aim-shot"
    }),
    randomScene("archer_10", "藤網收束", "skillE", 260, 2600),
    randomScene("archer_11", "貫穿箭", "skillE", 480, 1900),
    randomScene("archer_12", "星痕狙殺", "skillR", 560, 2500),
    randomScene("archer_13", "種子雨", "skillR", 360, 3600),
    randomScene("archer_14", "隼影處刑", "skillR", 220, 2600)
  ],
  engineer: [
    randomScene("engineer_00", "部署普通砲台", "skillF", 270, 3000, {
      id: "random-engineer_00-mechanical",
      turretKind: "mechanical",
      engineerSetup: "single"
    }),
    randomScene("engineer_00", "部署魔導砲台", "skillF", 270, 3600, {
      id: "random-engineer_00-magic",
      turretKind: "magic_missile",
      engineerSetup: "single"
    }),
    randomScene("engineer_01", "標定彈匣", "skillQ", 330, 5400, {
      turretKind: "mechanical",
      engineerSetup: "single"
    }),
    randomScene("engineer_02", "散射", "skillQ", 300, 2200, {
      turretKind: "mechanical",
      engineerSetup: "single"
    }),
    randomScene("engineer_03", "穿甲鐵芯", "skillQ", 330, 3200, {
      turretKind: "mechanical",
      engineerSetup: "single"
    }),
    randomScene("engineer_04", "壓制掃射", "skillE", 230, 2600, {
      turretKind: "mechanical",
      engineerSetup: "single"
    }),
    randomScene("engineer_05", "鎖定齊射", "skillE", 330, 3200, {
      turretKind: "mechanical",
      engineerSetup: "single",
      sequence: "engineer-marked-volley",
      loadoutOverrides: { skillQ: "engineer_01" }
    }),
    randomScene("engineer_06", "攻城模式", "skillR", 360, 4300, {
      turretKind: "mechanical",
      engineerSetup: "single",
      // Keep the complete 560px impact inside the 1280px review viewport.
      // This changes review framing only; cast distance and runtime geometry
      // remain untouched.
      reviewCameraScrollX: 170
    }),
    randomScene("engineer_07", "震爆彈筒", "skillQ", 150, 2100, {
      turretKind: "mechanical",
      engineerSetup: "single"
    }),
    randomScene("engineer_08", "屏障節點", "skillQ", 260, 4300, {
      turretKind: "mechanical",
      engineerSetup: "double"
    }),
    randomScene("engineer_09", "支撐砲架", "skillE", 250, 4300, {
      turretKind: "mechanical",
      engineerSetup: "single"
    }),
    randomScene("engineer_10", "破陣鉤彈", "skillE", 350, 2400, {
      turretKind: "mechanical",
      engineerSetup: "single"
    }),
    randomScene("engineer_11", "砲台迅爆", "skillR", 210, 2300, {
      turretKind: "mechanical",
      engineerSetup: "double"
    }),
    randomScene("engineer_12", "同步追跡彈", "skillQ", 330, 2600, {
      turretKind: "magic_missile",
      engineerSetup: "single"
    }),
    randomScene("engineer_13", "魔導鎖標", "skillQ", 360, 4300, {
      turretKind: "magic_missile",
      engineerSetup: "single"
    }),
    randomScene("engineer_14", "裂星魔彈", "skillE", 330, 3000, {
      turretKind: "magic_missile",
      engineerSetup: "single"
    }),
    randomScene("engineer_15", "魔導飛彈矩陣", "skillR", 330, 4300, {
      turretKind: "magic_missile",
      engineerSetup: "single"
    })
  ],
  mage: [
    randomScene("mage_00", "日耀光束", "skillQ", 430, 1800),
    randomScene("mage_01", "毒針咒", "skillQ", 390, 5200),
    randomScene("mage_02", "汲魂之手", "skillQ", 350, 2200),
    randomScene("mage_03", "灼光烙印", "skillQ", 380, 4300),
    randomScene("mage_04", "禁言符", "skillQ", 380, 2400),
    randomScene("mage_05", "稜鏡碎裂", "skillQ", 360, 2100),
    randomScene("mage_06", "虛空球", "skillQ", 390, 3500),
    randomScene("mage_07", "復甦爆發", "skillE", 150, 2600),
    randomScene("mage_08", "瘴霧坩堝", "skillE", 280, 4800),
    randomScene("mage_09", "聚焦透鏡", "skillE", 390, 5600),
    randomScene("mage_10", "重力井", "skillE", 270, 3600, {
      // Keep the target just inside the collision edge so the direct runtime
      // capture makes the repeated pull-in behavior legible, rather than
      // placing the target on the well centre where the mechanic is invisible.
      sequence: "mage-gravity-well-pull"
    }),
    randomScene("mage_11", "鎖魂鏈", "skillE", 250, 2800),
    randomScene("mage_12", "淨化風暴", "skillR", 270, 2600),
    randomScene("mage_13", "禁時星盤", "skillR", 270, 3700),
    // Keep recording through the last damage tick and the field despawn. The
    // five-second game duration is measured after the server receives the
    // cast; 5.4s from the harness call cut off its visual tail in live PNG.
    randomScene("mage_14", "血月祭壇", "skillR", 250, 6500)
  ]
};

async function recordAllSkills() {
  const selected = [
    ...RANDOM_SCENE_POOLS.warrior,
    ...RANDOM_SCENE_POOLS.archer,
    ...RANDOM_SCENE_POOLS.engineer,
    ...RANDOM_SCENE_POOLS.mage
  ];
  if (selected.length !== 62) {
    throw new Error(`全技能錄影應有 62 個情境，實際為 ${selected.length}`);
  }
  await recordSelectedSkills(selected);
}

async function recordAllSelectableSkills() {
  const selected = [
    ...RANDOM_SCENE_POOLS.warrior,
    ...RANDOM_SCENE_POOLS.archer,
    ...RANDOM_SCENE_POOLS.engineer.filter((scene) => scene.skillId !== "engineer_00"),
    ...RANDOM_SCENE_POOLS.mage
  ];
  if (selected.length !== 60) {
    throw new Error(`可選 Q/E/R 技能錄影應有 60 個情境，實際為 ${selected.length}`);
  }
  await recordSelectedSkills(selected);
}

async function recordRandomThirty() {
  const selected = [
    ...takeRandom(RANDOM_SCENE_POOLS.warrior, 8, RANDOM_SEED + 11),
    ...takeRandom(RANDOM_SCENE_POOLS.archer, 8, RANDOM_SEED + 23),
    ...takeRandom(RANDOM_SCENE_POOLS.engineer, 7, RANDOM_SEED + 37),
    ...takeRandom(RANDOM_SCENE_POOLS.mage, 7, RANDOM_SEED + 53)
  ];
  await recordSelectedSkills(selected);
}

async function recordSelectedSkills(selected) {
  if (DESIRED_DISTANCE_OVERRIDE !== null && ONLY.length !== 1) {
    throw new Error("--desired-distance requires exactly one --only scenario ID");
  }
  report.selection = selected.map(({ skillId, name, classId, slot }) => ({
    skillId,
    name,
    classId,
    slot
  }));
  for (const [index, config] of selected.entries()) {
    if (!shouldRecord(config.id)) continue;
    console.log(
      `[${index + 1}/${selected.length}] 錄製 ${config.classId} ${config.skillId} ${config.name}`
    );
    const firstAttempt = await recordRandomSkill(config);
    if (firstAttempt.failures.length === 0) {
      console.log(`[${index + 1}/${selected.length}] 通過 ${config.skillId}`);
      continue;
    }

    const stableVideoFile = firstAttempt.video ?? `${config.id}.webm`;
    const stableVideoPath = path.join(OUTPUT_DIR, stableVideoFile);
    const rejectedVideoPath = path.join(
      OUTPUT_DIR,
      stableVideoFile.replace(/\.webm$/i, "-attempt-1-rejected.webm")
    );
    if (existsSync(stableVideoPath)) {
      renameSync(stableVideoPath, rejectedVideoPath);
      firstAttempt.video = path.relative(OUTPUT_DIR, rejectedVideoPath);
    }
    report.retries.push({
      id: config.id,
      label: firstAttempt.label,
      reason: "First isolated recording attempt failed its runtime gate.",
      rejectedAttempt: firstAttempt
    });
    removeScenarioFromFinalReport(firstAttempt);
    console.log(
      `[${index + 1}/${selected.length}] 首次失敗，保留證據後重錄 ${config.skillId}`
    );
    const finalAttempt = await recordRandomSkill(config);
    finalAttempt.attempt = 2;
    console.log(
      `[${index + 1}/${selected.length}] ${
        finalAttempt.failures.length === 0 ? "重錄通過" : "重錄仍失敗"
      } ${config.skillId}`
    );
  }
}

async function recordRandomSkill(config) {
  const loadout = {
    ...DEFAULT_LOADOUTS[config.classId],
    ...config.loadoutOverrides,
    ...(config.slot === "skillF" ? {} : { [config.slot]: config.skillId })
  };
  return recordScenario(
    {
      id: config.id,
      label: `${CLASS_LABELS[config.classId]}・${config.name}`,
      classId: config.classId,
      classLabel: CLASS_LABELS[config.classId],
      turretKind: config.turretKind,
      selectedSkill: config.skillId,
      selectedSlot: config.slot,
      sequence: config.sequence,
      loadout
    },
    async (session, scenario) => {
      if (config.classId === "engineer") {
        await runRandomEngineerSkill(session, scenario, config);
        return;
      }
      const approach = await approachNearestEnemy(
        session.page,
        DESIRED_DISTANCE_OVERRIDE === null
          ? config.desiredDistance
          : Number(DESIRED_DISTANCE_OVERRIDE)
      );
      const gravityWell =
        config.sequence === "mage-gravity-well-pull"
          ? await getGravityWellEdgeAim(session.page, approach.targetId)
          : null;
      scenario.runtime = {
        selectedSkill: config.skillId,
        selectedSlot: config.slot,
        targetId: approach.targetId,
        castDistance: approach.distance,
        ...(gravityWell
          ? {
              gravityWell: {
                wellCenter: gravityWell.aim,
                targetAtCast: gravityWell.target,
                targetDistanceFromCenterAtCast: gravityWell.targetDistance
              }
            }
          : {})
      };
      await markActionStart(session, scenario);
      if (config.sequence === "warrior-enchant-hit") {
        await castSkill(session.page, config.slot, approach.aim);
        await waitForCooldownStarted(session.page, config.slot);
        await session.page.waitForTimeout(420);
        for (let hit = 0; hit < 3; hit += 1) {
          await setAim(session.page, approach.aim);
          await pulseInput(session.page, "attack", 220);
          if (hit < 2) await session.page.waitForTimeout(520);
        }
        await session.page.waitForTimeout(config.waitMs);
      } else if (config.sequence === "warrior-hammer-speed-run") {
        await castSkill(session.page, config.slot, approach.aim);
        await waitForCooldownStarted(session.page, config.slot);
        await moveFor(session.page, 1, 0, 4200);
        await session.page.waitForTimeout(config.waitMs);
      } else if (config.sequence === "archer-steady-aim-shot") {
        await castSkill(session.page, config.slot, approach.aim);
        await waitForCooldownStarted(session.page, config.slot);
        await session.page.waitForTimeout(1080);
        // Exercise the exact moving-full-draw counterexamples in the live
        // Arena: west for the pinned rear shoe, then north-east/north-west for
        // diagonal gait readability and apparent scale.
        for (const direction of [
          { moveX: -0.9, moveY: 0 },
          { moveX: 0.64, moveY: -0.64 },
          { moveX: -0.64, moveY: -0.64 }
        ]) {
          const self = await readSelf(session.page);
          await setAim(session.page, {
            x: self.x + direction.moveX * 420,
            y: self.y + direction.moveY * 420
          });
          await setInput(session.page, {
            attack: true,
            moveX: direction.moveX,
            moveY: direction.moveY
          });
          await session.page.waitForTimeout(720);
          await setInput(session.page, { attack: false, moveX: 0, moveY: 0 });
          await session.page.waitForTimeout(420);
        }
        await session.page.waitForTimeout(config.waitMs);
      } else if (config.sequence === "archer-invisibility") {
        await castSkill(session.page, config.slot, approach.aim);
        await waitForCooldownStarted(session.page, config.slot);
        scenario.runtime.concealment = {
          expectedDurationMs: 2000,
          visibility: "self-translucent-outline;others-omitted"
        };
        await moveFor(session.page, -0.72, 0, 1650);
        await session.page.waitForTimeout(config.waitMs);
      } else if (config.sequence === "archer-hook-execution") {
        await castSkill(session.page, config.slot, approach.aim);
        await waitForCooldownStarted(session.page, config.slot);
        const pullEnd = await waitForTargetPull(
          session.page,
          approach.targetId,
          approach.aim,
          180
        );
        await waitForActionSkillStarted(session.page, "archer_14");
        await waitForCooldownStarted(session.page, "skillR");
        scenario.runtime.combo = {
          followupSkill: "archer_14",
          pullEnd,
          expectedSharedDistance: 200,
          triggerMode: "server-auto-on-hook-contact"
        };
        await session.page.waitForTimeout(config.waitMs);
      } else if (config.sequence === "mage-focus-lens-beam") {
        await castSkill(session.page, config.slot, approach.aim);
        await waitForCooldownStarted(session.page, config.slot);
        await session.page.waitForTimeout(420);
        await castSkill(session.page, "skillQ", approach.aim);
        await waitForCooldownStarted(session.page, "skillQ");
        await session.page.waitForTimeout(config.waitMs);
      } else if (config.sequence === "mage-gravity-well-pull") {
        await castSkill(session.page, config.slot, gravityWell.aim);
        await waitForCooldownStarted(session.page, config.slot);
        await session.page.waitForTimeout(config.waitMs);
      } else {
        await castSkill(session.page, config.slot, approach.aim);
        await waitForCooldownStarted(session.page, config.slot);
        await session.page.waitForTimeout(config.waitMs);
      }
    }
  );
}

async function runRandomEngineerSkill(session, scenario, config) {
  const { page } = session;
  const approach = await approachNearestEnemy(page, config.desiredDistance);
  if (config.slot === "skillF") {
    await markActionStart(session, scenario);
  }
  await castSkill(page, "skillF", approach.aim);
  await waitForOwnedTurretCount(page, 1);
  if (config.engineerSetup === "double") {
    await waitForCooldown(page, "skillF");
    await moveFor(page, -1, 0, 1050);
    const secondAim = await nearestEnemyAim(page);
    await castSkill(page, "skillF", secondAim);
    await waitForOwnedTurretCount(page, 2);
  }
  await page.waitForTimeout(650);
  let reviewCamera = null;
  if (config.slot !== "skillF") {
    const aim = await nearestEnemyAim(page);
    reviewCamera = await applyReviewCameraScrollX(
      page,
      config.reviewCameraScrollX
    );
    await markActionStart(session, scenario);
    if (config.sequence === "engineer-marked-volley") {
      await castSkill(page, "skillQ", aim);
      await waitForCooldownStarted(page, "skillQ");
      await page.waitForTimeout(320);
      await castSkill(page, config.slot, aim);
      await waitForCooldownStarted(page, config.slot);
    } else {
      await castSkill(page, config.slot, aim);
      await waitForCooldownStarted(page, config.slot);
    }
  }
  scenario.runtime = {
    ...(await readArenaCounts(page)),
    selectedSkill: config.skillId,
    selectedSlot: config.slot,
    turretKind: config.turretKind,
    engineerSetup: config.engineerSetup,
    reviewCamera: config.reviewCameraScrollX ? reviewCamera : null
  };
  await page.waitForTimeout(config.waitMs);
}

function randomScene(
  skillId,
  name,
  slot,
  desiredDistance,
  waitMs,
  options = {}
) {
  const classId = skillId.split("_")[0];
  return {
    id: options.id ?? `random-${skillId}`,
    skillId,
    name,
    classId,
    slot,
    desiredDistance,
    waitMs,
    turretKind: options.turretKind ?? "mechanical",
    engineerSetup: options.engineerSetup ?? null,
    reviewCameraScrollX: Number(options.reviewCameraScrollX ?? 0),
    sequence: options.sequence ?? null,
    loadoutOverrides: options.loadoutOverrides ?? null
  };
}

async function applyReviewCameraScrollX(page, offset) {
  if (!offset) return null;
  return page.evaluate((scrollOffset) => {
    const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
    const camera = scene?.cameras?.main;
    if (!camera) throw new Error("Arena review camera is unavailable");
    camera.stopFollow();
    const lockedScrollX = camera.scrollX + scrollOffset;
    const lockReviewScroll = () => {
      camera.stopFollow();
      camera.scrollX = lockedScrollX;
    };
    lockReviewScroll();
    // VillageArenaScene updates its camera after the cast setup. Keep this
    // review-only framing lock in postupdate so the full circular field is
    // visible in recorded evidence without changing world or cast geometry.
    scene.events.on("postupdate", lockReviewScroll);
    return {
      mode: "review-only-postupdate-scroll-lock",
      scrollOffsetX: scrollOffset,
      scrollX: lockedScrollX,
      scrollY: camera.scrollY
    };
  }, offset);
}

function takeRandom(pool, count, seed) {
  const values = [...pool];
  const random = seededRandom(seed);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values.slice(0, count);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

async function recordWarriorBasicAttack() {
  await recordScenario(
    {
      id: "warrior-basic-combo",
      label: "戰士・近身普攻連段",
      classId: "warrior",
      classLabel: "戰士",
      loadout: {
        skillQ: "warrior_04",
        skillE: "warrior_08",
        skillR: "warrior_12"
      }
    },
    async (session, scenario) => {
      const approach = await approachNearestEnemy(session.page, 92);
      scenario.runtime = { targetId: approach.targetId, distance: approach.distance };
      await markActionStart(session, scenario);
      await pulseInput(session.page, "attack", 220);
      await session.page.waitForTimeout(280);
      await pulseInput(session.page, "attack", 220);
      await session.page.waitForTimeout(900);
    }
  );
}

async function recordWarriorCharge() {
  await recordScenario(
    {
      id: "warrior-charge",
      label: "戰士・正義衝鋒",
      classId: "warrior",
      classLabel: "戰士",
      loadout: {
        skillQ: "warrior_04",
        skillE: "warrior_08",
        skillR: "warrior_12"
      }
    },
    async (session, scenario) => {
      const approach = await approachNearestEnemy(session.page, 350);
      scenario.runtime = { targetId: approach.targetId, distance: approach.distance };
      await markActionStart(session, scenario);
      await castSkill(session.page, "skillQ", approach.aim);
      await session.page.waitForTimeout(1500);
    }
  );
}

async function recordWarriorGroundSlam() {
  await recordScenario(
    {
      id: "warrior-ground-slam",
      label: "戰士・斷城震落",
      classId: "warrior",
      classLabel: "戰士",
      selectedSkill: "warrior_12",
      selectedSlot: "skillR",
      freezeBots: true,
      reviewBotCount: 6,
      reviewBotHealth: 1200,
      reviewSpawnPoint: { x: 4700, y: 3200 },
      reviewTargetPoint: { x: 5400, y: 3200 },
      promoCombat: { requireDamage: true, minimumVisibleOpponents: 5 },
      loadout: {
        skillQ: "warrior_04",
        skillE: "warrior_08",
        skillR: "warrior_12"
      }
    },
    async (session, scenario) => {
      await markActionStart(session, scenario);
      const approach = await approachNearestEnemy(session.page, 180);
      scenario.runtime = { targetId: approach.targetId, distance: approach.distance };
      await castSkill(session.page, "skillR", approach.aim);
      await session.page.waitForTimeout(2100);
    }
  );
}

async function recordArcherFullDraw() {
  await recordScenario(
    {
      id: "archer-full-draw",
      label: "射手・蓄力普攻",
      classId: "archer",
      classLabel: "射手",
      selectedSlot: "attack",
      reviewActionId: "archer-basic-full-draw",
      freezeBots: true,
      reviewBotCount: 6,
      reviewBotHealth: 1200,
      reviewSpawnPoint: { x: 4700, y: 3200 },
      reviewTargetPoint: { x: 5400, y: 3200 },
      promoCombat: { requireDamage: true, minimumVisibleOpponents: 5 },
      reviewSpec: {
        effect: "站立蓄力時使用目前額外的單幀滿弓 body，放箭後回到普通走路姿勢。",
        damage: "本次實戰滿蓄力 30",
        cooldownLabel: "普通攻擊",
        duration: "約 1.55 秒固定滿弓姿勢"
      },
      loadout: {
        skillQ: "archer_01",
        skillE: "archer_08",
        skillR: "archer_13"
      }
    },
    async (session, scenario) => {
      await markActionStart(session, scenario);
      const approach = await approachNearestEnemy(session.page, 420);
      scenario.runtime = { targetId: approach.targetId, distance: approach.distance };
      await setAim(session.page, approach.aim);
      await setInput(session.page, { attack: true });
      await session.page.waitForTimeout(1250);
      await setInput(session.page, { attack: false });
      await session.page.waitForTimeout(1400);
    }
  );
}

async function recordArcherForestRoll() {
  await recordScenario(
    {
      id: "archer-forest-roll",
      label: "射手・森林翻滾",
      classId: "archer",
      classLabel: "射手",
      loadout: {
        skillQ: "archer_01",
        skillE: "archer_08",
        skillR: "archer_13"
      }
    },
    async (session, scenario) => {
      const approach = await approachNearestEnemy(session.page, 320);
      scenario.runtime = { targetId: approach.targetId, distance: approach.distance };
      await markActionStart(session, scenario);
      await castSkill(session.page, "skillQ", approach.aim);
      await session.page.waitForTimeout(1600);
    }
  );
}

async function recordMechanicalTurret() {
  await recordScenario(
    {
      id: "engineer-mechanical-turret",
      label: "工程師・普通砲台部署與射擊",
      classId: "engineer",
      classLabel: "工程師",
      turretKind: "mechanical",
      loadout: {
        skillQ: "engineer_02",
        skillE: "engineer_04",
        skillR: "engineer_11"
      }
    },
    async (session, scenario) => {
      const approach = await approachNearestEnemy(session.page, 270);
      await markActionStart(session, scenario);
      await castSkill(session.page, "skillF", approach.aim);
      await waitForOwnedTurretCount(session.page, 1);
      scenario.runtime = await readArenaCounts(session.page);
      await session.page.waitForTimeout(3200);
    }
  );
}

async function recordBarrierNetwork() {
  await recordScenario(
    {
      id: "engineer-barrier-network",
      label: "工程師・屏障節點連線",
      classId: "engineer",
      classLabel: "工程師",
      turretKind: "mechanical",
      noBots: true,
      loadout: {
        skillQ: "engineer_08",
        skillE: "engineer_09",
        skillR: "engineer_11"
      }
    },
    async (session, scenario) => {
      await deployTurretAtOffset(session.page, 100, 0, 1);
      await waitForCooldown(session.page, "skillF");
      await moveFor(session.page, -1, 0, 1050);
      await deployTurretAtOffset(session.page, 100, 0, 2);
      await session.page.waitForTimeout(680);
      await waitForCooldown(session.page, "skillQ");
      const center = await readSelf(session.page);
      await markActionStart(session, scenario);
      await castSkill(session.page, "skillQ", { x: center.x + 120, y: center.y });
      await waitForSkillEffect(session.page, "engineer_08");
      scenario.runtime = await readArenaCounts(session.page);
      await session.page.waitForTimeout(2500);
    }
  );
}

async function recordBarrierDistance(requestedDistance) {
  await recordScenario(
    {
      id: `engineer-barrier-distance-${requestedDistance}`,
      label: `工程師・屏障節點 ${requestedDistance} 距離`,
      classId: "engineer",
      classLabel: "工程師",
      selectedSkill: "engineer_08",
      selectedSlot: "skillQ",
      turretKind: "mechanical",
      noBots: true,
      loadout: {
        skillQ: "engineer_08",
        skillE: "engineer_09",
        skillR: "engineer_11"
      }
    },
    async (session, scenario) => {
      const { page } = session;
      const initialSelf = await readSelf(page);
      await deployTurretAtOffset(page, 100, 0, 1);
      await waitForCooldown(page, "skillF");
      const [firstTurret] = await readOwnedTurrets(page);
      if (!firstTurret) throw new Error("第一座普通砲台沒有出現在實戰 snapshot。");

      const deployDistance = Math.hypot(
        firstTurret.x - initialSelf.x,
        firstTurret.y - initialSelf.y
      );
      const placement = await prepareBarrierTurretPlacement(
        page,
        firstTurret,
        requestedDistance,
        deployDistance
      );
      await setAim(page, placement.aim);
      await pulseInput(page, "skillF", 155);
      await waitForOwnedTurretCount(page, 2);
      await page.waitForTimeout(380);

      const turrets = await readOwnedTurrets(page);
      const centerDistance = Math.hypot(
        turrets[1].x - turrets[0].x,
        turrets[1].y - turrets[0].y
      );
      scenario.runtime = {
        ...(await readArenaCounts(page)),
        requestedBarrierCenterDistance: requestedDistance,
        actualBarrierCenterDistance: centerDistance,
        deployDistance,
        placement,
        selectedSkill: "engineer_08",
        selectedSlot: "skillQ",
        turretKind: "mechanical",
        engineerSetup: "double"
      };
      scenario.checks.push({
        name: `barrier-center-distance-${requestedDistance}`,
        status: Math.abs(centerDistance - requestedDistance) <= 2 ? "pass" : "fail",
        expected: requestedDistance,
        actual: centerDistance
      });
      if (Math.abs(centerDistance - requestedDistance) > 2) {
        throw new Error(
          `砲台中心距離誤差過大：預期 ${requestedDistance}，實際 ${centerDistance.toFixed(2)}。`
        );
      }

      await markActionStart(session, scenario);
      const center = await readSelf(page);
      await castSkill(page, "skillQ", { x: center.x + 120, y: center.y });
      await waitForSkillEffect(page, "engineer_08");
      const geometry = await readBarrierGeometry(page);
      scenario.runtime.barrierGeometry = geometry;
      const expectedLineLength = Math.max(0, centerDistance - 54);
      scenario.checks.push({
        name: "barrier-dynamic-edge-to-edge-length",
        status: Math.abs(geometry.lineLength - expectedLineLength) <= 2 ? "pass" : "fail",
        expected: expectedLineLength,
        actual: geometry.lineLength
      });
      if (Math.abs(geometry.lineLength - expectedLineLength) > 2) {
        throw new Error(
          `屏障沒有從兩座砲台邊緣動態連接：預期 ${expectedLineLength.toFixed(2)}，實際 ${geometry.lineLength.toFixed(2)}。`
        );
      }
      // engineer_08 is authoritative for 4 seconds. Record through despawn so
      // the delivered normal-speed movie proves the complete lifecycle.
      await page.waitForTimeout(4300);
    }
  );
}

async function recordRapidDetonation() {
  await recordScenario(
    {
      id: "engineer-rapid-detonation",
      label: "工程師・雙砲台迅爆",
      classId: "engineer",
      classLabel: "工程師",
      turretKind: "mechanical",
      noBots: true,
      loadout: {
        skillQ: "engineer_08",
        skillE: "engineer_09",
        skillR: "engineer_11"
      }
    },
    async (session, scenario) => {
      await deployTurretAtOffset(session.page, 95, -32, 1);
      await waitForCooldown(session.page, "skillF");
      await moveFor(session.page, -1, 0, 1050);
      await deployTurretAtOffset(session.page, 95, 32, 2);
      const self = await readSelf(session.page);
      await markActionStart(session, scenario);
      await castSkill(session.page, "skillR", { x: self.x + 120, y: self.y });
      await waitForSkillEffect(session.page, "engineer_11");
      scenario.runtime = await readArenaCounts(session.page);
      await session.page.waitForTimeout(1900);
    }
  );
}

async function recordMagicMissileMatrix() {
  await recordScenario(
    {
      id: "engineer-magic-matrix",
      label: "工程師・魔導飛彈矩陣",
      classId: "engineer",
      classLabel: "工程師",
      selectedSkill: "engineer_15",
      selectedSlot: "skillR",
      turretKind: "magic_missile",
      freezeBots: true,
      reviewBotCount: 6,
      reviewBotHealth: 1200,
      reviewSpawnPoint: { x: 4700, y: 3200 },
      reviewTargetPoint: { x: 5400, y: 3200 },
      promoCombat: { requireDamage: true, minimumVisibleOpponents: 5 },
      loadout: {
        skillQ: "engineer_12",
        skillE: "engineer_14",
        skillR: "engineer_15"
      }
    },
    async (session, scenario) => {
      await markActionStart(session, scenario);
      const approach = await approachNearestEnemy(session.page, 280);
      await castSkill(session.page, "skillF", approach.aim);
      await waitForOwnedTurretCount(session.page, 1);
      await session.page.waitForTimeout(450);
      await castSkill(session.page, "skillR", approach.aim);
      await waitForProjectileBySkill(session.page, "engineer_15");
      scenario.runtime = await readArenaCounts(session.page);
      await session.page.waitForTimeout(2800);
    }
  );
}

async function recordMageForbiddenAstrolabe() {
  await recordScenario(
    {
      id: "mage-forbidden-astrolabe",
      label: "法師・禁時星盤",
      classId: "mage",
      classLabel: "法師",
      selectedSkill: "mage_13",
      selectedSlot: "skillR",
      freezeBots: true,
      reviewBotCount: 6,
      reviewBotHealth: 1200,
      reviewSpawnPoint: { x: 4700, y: 3200 },
      reviewTargetPoint: { x: 5400, y: 3200 },
      promoCombat: {
        requireDamage: false,
        requiredStatus: "slowed",
        minimumVisibleOpponents: 5
      },
      loadout: {
        skillQ: "mage_00",
        skillE: "mage_08",
        skillR: "mage_13"
      }
    },
    async (session, scenario) => {
      await markActionStart(session, scenario);
      const approach = await approachNearestEnemy(session.page, 280);
      scenario.runtime = { targetId: approach.targetId, distance: approach.distance };
      await castSkill(session.page, "skillR", approach.aim);
      await waitForSkillEffect(session.page, "mage_13");
      scenario.runtime = await readArenaCounts(session.page);
      await session.page.waitForTimeout(3100);
    }
  );
}

async function recordTeamFight() {
  await recordScenario(
    {
      id: "team-3v3-fight",
      label: "3v3・紅藍隊混戰",
      classId: "mage",
      classLabel: "法師",
      mode: "team_3v3",
      freezeBots: false,
      reviewBotCount: 5,
      reviewBotHealth: 650,
      loadout: {
        skillQ: "mage_00",
        skillE: "mage_08",
        skillR: "mage_14"
      }
    },
    async (session, scenario) => {
      const approach = await approachNearestEnemy(session.page, 360);
      await markActionStart(session, scenario);
      await castSkill(session.page, "skillQ", approach.aim);
      await moveFor(session.page, 0.7, 0.7, 900);
      await castSkill(session.page, "skillE", approach.aim);
      await session.page.waitForTimeout(1250);
      await castSkill(session.page, "skillR", approach.aim);
      await session.page.waitForTimeout(4200);
      scenario.runtime = await readArenaCounts(session.page);
    }
  );
}

async function recordPromoWarriorRole() {
  await recordScenario(
    {
      id: "promo-warrior-role",
      label: "戰士・職業實戰連段",
      classId: "warrior",
      classLabel: "戰士",
      freezeBots: false,
      reviewBotCount: 6,
      reviewBotHealth: 1200,
      reviewSpawnPoint: { x: 4700, y: 3200 },
      reviewTargetPoint: { x: 5300, y: 3200 },
      promoRole: {
        requiredSkillIds: ["warrior_04", "warrior_11", "warrior_12"],
        requireBasicAttack: true,
        requireDamage: true,
        minimumVisibleOpponents: 4
      },
      loadout: {
        skillQ: "warrior_04",
        skillE: "warrior_11",
        skillR: "warrior_12"
      }
    },
    async (session, scenario) => {
      await markActionStart(session, scenario);
      let approach = await approachNearestEnemy(session.page, 340);
      await castSkill(session.page, "skillQ", approach.aim);
      await session.page.waitForTimeout(760);
      approach = await approachNearestEnemy(session.page, 105);
      await pulseInput(session.page, "attack", 230);
      await session.page.waitForTimeout(520);
      await pulseInput(session.page, "attack", 230);
      await session.page.waitForTimeout(620);
      approach = await approachNearestEnemy(session.page, 180);
      await castSkill(session.page, "skillE", approach.aim);
      await session.page.waitForTimeout(1100);
      await castSkillUntilCooldown(session.page, "skillR", approach.aim);
      await session.page.waitForTimeout(1900);
      scenario.runtime = await readArenaCounts(session.page);
    }
  );
}

async function recordPromoArcherRole() {
  await recordScenario(
    {
      id: "promo-archer-role",
      label: "射手・職業實戰連段",
      classId: "archer",
      classLabel: "射手",
      freezeBots: false,
      reviewBotCount: 6,
      reviewBotHealth: 1200,
      reviewSpawnPoint: { x: 4700, y: 3200 },
      reviewTargetPoint: { x: 5300, y: 3200 },
      promoRole: {
        requiredSkillIds: ["archer_01", "archer_08", "archer_13"],
        requireBasicAttack: true,
        requireDamage: true,
        minimumVisibleOpponents: 4
      },
      loadout: {
        skillQ: "archer_01",
        skillE: "archer_08",
        skillR: "archer_13"
      }
    },
    async (session, scenario) => {
      await markActionStart(session, scenario);
      let approach = await approachNearestEnemy(session.page, 430);
      await setAim(session.page, approach.aim);
      await setInput(session.page, { attack: true });
      await session.page.waitForTimeout(1250);
      await setInput(session.page, { attack: false });
      await session.page.waitForTimeout(780);
      await castSkill(session.page, "skillQ", approach.aim);
      await session.page.waitForTimeout(720);
      approach = await approachNearestEnemy(session.page, 390);
      await castSkill(session.page, "skillE", approach.aim);
      await session.page.waitForTimeout(900);
      await castSkill(session.page, "skillR", approach.aim);
      await session.page.waitForTimeout(2500);
      scenario.runtime = await readArenaCounts(session.page);
    }
  );
}

async function recordPromoEngineerRole() {
  await recordScenario(
    {
      id: "promo-engineer-role",
      label: "工程師・職業實戰連段",
      classId: "engineer",
      classLabel: "工程師",
      turretKind: "magic_missile",
      freezeBots: false,
      reviewBotCount: 6,
      reviewBotHealth: 1600,
      reviewSpawnPoint: { x: 4700, y: 3200 },
      reviewTargetPoint: { x: 5300, y: 3200 },
      promoRole: {
        requiredSkillIds: ["engineer_12", "engineer_14", "engineer_15"],
        requireTurret: true,
        requireDamage: true,
        minimumVisibleOpponents: 4
      },
      loadout: {
        skillQ: "engineer_12",
        skillE: "engineer_14",
        skillR: "engineer_15"
      }
    },
    async (session, scenario) => {
      await markActionStart(session, scenario);
      let approach = await approachNearestEnemy(session.page, 290);
      await castSkill(session.page, "skillF", approach.aim);
      await waitForOwnedTurretCount(session.page, 1);
      await session.page.waitForTimeout(1150);
      await castSkill(session.page, "skillQ", approach.aim);
      await session.page.waitForTimeout(1050);
      approach = await approachNearestEnemy(session.page, 300);
      await castSkill(session.page, "skillE", approach.aim);
      await session.page.waitForTimeout(1200);
      await castSkill(session.page, "skillR", approach.aim);
      await session.page.waitForTimeout(2700);
      scenario.runtime = await readArenaCounts(session.page);
    }
  );
}

async function recordPromoMageRole() {
  await recordScenario(
    {
      id: "promo-mage-role",
      label: "法師・職業實戰連段",
      classId: "mage",
      classLabel: "法師",
      freezeBots: false,
      reviewBotCount: 6,
      reviewBotHealth: 1600,
      reviewSpawnPoint: { x: 4700, y: 3200 },
      reviewTargetPoint: { x: 5300, y: 3200 },
      promoRole: {
        requiredSkillIds: ["mage_00", "mage_08", "mage_13"],
        requireBasicAttack: true,
        requireDamage: true,
        minimumVisibleOpponents: 4
      },
      loadout: {
        skillQ: "mage_00",
        skillE: "mage_08",
        skillR: "mage_13"
      }
    },
    async (session, scenario) => {
      await markActionStart(session, scenario);
      let approach = await approachNearestEnemy(session.page, 420);
      await pulseInput(session.page, "attack", 230);
      await session.page.waitForTimeout(750);
      await castSkill(session.page, "skillQ", approach.aim);
      await session.page.waitForTimeout(1450);
      approach = await approachNearestEnemy(session.page, 300);
      await castSkill(session.page, "skillE", approach.aim);
      await session.page.waitForTimeout(1450);
      await castSkill(session.page, "skillR", approach.aim);
      await session.page.waitForTimeout(2600);
      scenario.runtime = await readArenaCounts(session.page);
    }
  );
}

async function recordScenario(config, run) {
  const session = await openArena(config);
  const scenario = {
    id: config.id,
    label: config.label,
    classId: config.classId,
    mode: config.mode ?? "free_for_all",
    expectedLoadout: { ...config.loadout },
    selectedSkill: config.selectedSkill ?? null,
    selectedSlot: config.selectedSlot ?? null,
    reviewActionId: config.reviewActionId ?? null,
    reviewSpec: config.reviewSpec ?? null,
    sequence: config.sequence ?? null,
    turretKind: config.turretKind ?? null,
    promoCombat: config.promoCombat ?? null,
    promoRole: config.promoRole ?? null,
    checks: [],
    browser: {
      consoleErrors: session.consoleErrors,
      pageErrors: session.pageErrors,
      failedRequests: session.failedRequests
    },
    failures: []
  };
  if (session.reviewAssetOverride) {
    scenario.reviewAssetOverride = session.reviewAssetOverride;
  }
  report.scenarios.push(scenario);
  try {
    scenario.runtimeAssetVariant = await session.page.evaluate(
      () => window.__renaissArenaSkillRuntimeVariant ?? null
    );
    const expectedVariant = "canonical";
    scenario.checks.push({
      name: "runtime-asset-variant",
      status: scenario.runtimeAssetVariant === expectedVariant ? "pass" : "fail",
      expected: expectedVariant,
      actual: scenario.runtimeAssetVariant
    });
    if (scenario.runtimeAssetVariant !== expectedVariant) {
      throw new Error(
        `Runtime asset variant did not apply: expected=${expectedVariant}, actual=${scenario.runtimeAssetVariant}`
      );
    }
    if (scenario.reviewAssetOverride) {
      const requiredKinds = scenario.reviewAssetOverride.requiredRequestKinds ?? [
        "asset"
      ];
      const requestCounts = scenario.reviewAssetOverride.requestCounts ?? {
        asset: scenario.reviewAssetOverride.requestCount ?? 0
      };
      const overrideLoaded = requiredKinds.every(
        (kind) => (requestCounts[kind] ?? 0) > 0
      );
      scenario.checks.push({
        name: "review-asset-override-loaded-by-5173-runtime",
        status: overrideLoaded ? "pass" : "fail",
        requestCounts,
        requiredRequestKinds: requiredKinds,
        requestedUrls: scenario.reviewAssetOverride.requestedUrls,
        sha256: scenario.reviewAssetOverride.sha256
      });
      if (!overrideLoaded) {
        throw new Error(
          `5173 runtime did not request every review override layer: ${JSON.stringify(
            { requiredKinds, requestCounts }
          )}`
        );
      }
    }
    scenario.loadoutContract = await inspectLoadoutContract(
      session.page,
      config.classId,
      config.loadout
    );
    scenario.checks.push({
      name: "runtime-loadout-and-hud-icons",
      status: scenario.loadoutContract.passed ? "pass" : "fail"
    });
    if (!scenario.loadoutContract.passed) {
      throw new Error(
        `實際裝備或 HUD 圖示不同步：${JSON.stringify(scenario.loadoutContract)}`
      );
    }
    await installControlledInput(session.page, config.turretKind ?? "mechanical");
    await installRuntimeTelemetry(session.page);
    await session.page.waitForTimeout(450);
    scenario.timeline = {
      setupStartSec: Math.max(
        0,
        (Date.now() - session.videoStartedAtMs) / 1000
      )
    };
    await run(session, scenario);
    if (scenario.timeline.actionStartSec == null) {
      scenario.timeline.actionStartSec = scenario.timeline.setupStartSec;
    }
    scenario.timeline.actionEndSec = Math.max(
      scenario.timeline.actionStartSec + 0.5,
      (Date.now() - session.videoStartedAtMs) / 1000
    );
    if (session.liveRuntimeCapture || session.hqVideoCapture) {
      // Playwright's WebM finalization can land a few encoded frames before
      // the wall-clock close time. Keep a visible post-action tail so the
      // delivered movie always extends beyond actionEnd instead of appearing
      // to jump early at the end of the skill.
      await session.page.waitForTimeout(800);
    }
    if (session.liveRuntimeCapture) {
      await stopLiveRuntimeCapture(session, scenario);
      validateLiveRuntimeCapture(scenario);
    }
    if (session.hqVideoCapture) {
      await stopHqVideoCapture(session, scenario);
    }
  } catch (error) {
    fail(scenario, error instanceof Error ? error.message : String(error));
  } finally {
    await stopLiveRuntimeCapture(session, scenario);
    await stopHqVideoCapture(session, scenario);
    await closeSession(session, scenario);
  }
  return scenario;
}

async function inspectLoadoutContract(page, classId, expectedLoadout) {
  await page.waitForFunction(
    ({ expectedClassId, expected }) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      const self = scene?.snapshot?.players?.find(
        (player) => player.id === scene.snapshot.selfId
      );
      if (!self || self.classId !== expectedClassId) return false;
      return ["skillQ", "skillE", "skillR"].every((slot) => {
        const button = document.querySelector(
          `.combat-skill-dock .skill-button.action-${slot}`
        );
        return (
          self.catalogLoadout?.[slot] === expected[slot] &&
          button?.getAttribute("data-skill-id") === expected[slot]
        );
      });
    },
    { expectedClassId: classId, expected: expectedLoadout },
    { timeout: 8_000 }
  );

  return page.evaluate(
    ({ expectedClassId, expected }) => {
      const scene = window.__renaissArenaGame.scene.scenes[0];
      const self = scene.snapshot.players.find(
        (player) => player.id === scene.snapshot.selfId
      );
      const stored = JSON.parse(
        localStorage.getItem("renaiss:arena-catalog-loadouts:v3") ?? "null"
      );
      const hud = Object.fromEntries(
        ["skillQ", "skillE", "skillR"].map((slot) => {
          const button = document.querySelector(
            `.combat-skill-dock .skill-button.action-${slot}`
          );
          const icon = button?.querySelector(".skill-icon");
          const style = icon ? getComputedStyle(icon) : null;
          return [
            slot,
            {
              skillId: button?.getAttribute("data-skill-id") ?? null,
              label: button?.getAttribute("aria-label") ?? null,
              iconX: style?.getPropertyValue("--icon-x").trim() ?? null,
              iconY: style?.getPropertyValue("--icon-y").trim() ?? null,
              iconSheet: style?.getPropertyValue("--skill-icon-sheet").trim() ?? null
            }
          ];
        })
      );
      const passed =
        self?.classId === expectedClassId &&
        ["skillQ", "skillE", "skillR"].every(
          (slot) =>
            stored?.[expectedClassId]?.[slot] === expected[slot] &&
            self?.catalogLoadout?.[slot] === expected[slot] &&
            hud[slot]?.skillId === expected[slot] &&
            Boolean(hud[slot]?.iconSheet)
        );
      return {
        passed,
        expectedClassId,
        actualClassId: self?.classId ?? null,
        expected,
        stored: stored?.[expectedClassId] ?? null,
        runtime: self?.catalogLoadout ?? null,
        hud
      };
    },
    { expectedClassId: classId, expected: expectedLoadout }
  );
}

async function markActionStart(session, scenario) {
  let captureStarted = false;
  if (HQ_PREVIEW_FPS > 0 && !session.hqVideoCapture) {
    session.hqVideoCapture = await startHqVideoCapture(session, scenario);
    captureStarted = true;
  }
  if (!SKIP_RUNTIME_PNG && !session.liveRuntimeCapture) {
    session.liveRuntimeCapture = await startLiveRuntimeCapture(session, scenario);
    captureStarted = true;
  }
  if (captureStarted) {
    // Pixel Debug requires a known stationary baseline before the cast.  Keep
    // the game untouched for two capture ticks, then mark the actual action.
    await session.page.waitForTimeout(220);
  }
  scenario.timeline.actionStartSec = Math.max(
    0,
    (Date.now() - session.videoStartedAtMs) / 1000
  );
}

async function startHqVideoCapture(session, scenario) {
  const startedAtMs = Date.now();
  const metadata = await session.page.evaluate(
    async ({ frameRate, videoBitsPerSecond }) => {
      const canvas = document.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error("Arena canvas is unavailable for HQ preview capture");
      }
      const mimeType = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`Required HQ preview codec is unsupported: ${mimeType}`);
      }
      const stream = canvas.captureStream(frameRate);
      const chunks = [];
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond
      });
      const startPromise = new Promise((resolve, reject) => {
        recorder.addEventListener("start", resolve, { once: true });
        recorder.addEventListener(
          "error",
          (event) => reject(event.error ?? new Error("HQ recorder start failed")),
          { once: true }
        );
      });
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });
      window.__arenaHqPreviewRecorder = { recorder, stream, chunks, mimeType };
      recorder.start(250);
      await startPromise;
      return {
        mimeType,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        requestedFrameRate: frameRate,
        videoBitsPerSecond: recorder.videoBitsPerSecond
      };
    },
    {
      frameRate: HQ_PREVIEW_FPS,
      videoBitsPerSecond: HQ_PREVIEW_BITRATE
    }
  );
  scenario.hqVideoCapture = {
    source: "canvas-capture-stream",
    transport: "html-canvas-media-recorder-vp9",
    captureStartSec: Math.max(0, (startedAtMs - session.videoStartedAtMs) / 1000),
    sourceSize: [metadata.canvasWidth, metadata.canvasHeight],
    requestedFrameRate: metadata.requestedFrameRate,
    requestedBitrate: HQ_PREVIEW_BITRATE,
    actualBitrateSetting: metadata.videoBitsPerSecond,
    mimeType: metadata.mimeType,
    interpolatedFrames: false,
    fallbackUsed: false
  };
  return { startedAtMs, stopped: false };
}

async function stopHqVideoCapture(session, scenario) {
  const controller = session.hqVideoCapture;
  if (!controller || controller.stopped) return;
  controller.stopped = true;
  const fileName = `${scenario.id}-hq.webm`;
  const outputPath = path.join(OUTPUT_DIR, fileName);
  const downloadPromise = session.page.waitForEvent("download", { timeout: 30_000 });
  const stopResultPromise = session.page.evaluate(async (downloadName) => {
    const state = window.__arenaHqPreviewRecorder;
    if (!state) throw new Error("HQ preview recorder state is missing");
    const { recorder, stream, chunks, mimeType } = state;
    if (recorder.state !== "inactive") {
      await new Promise((resolve, reject) => {
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.addEventListener(
          "error",
          (event) => reject(event.error ?? new Error("HQ recorder stop failed")),
          { once: true }
        );
        recorder.stop();
      });
    }
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    stream.getTracks().forEach((track) => track.stop());
    window.__arenaHqPreviewRecorder = null;
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { bytes: blob.size, mimeType };
  }, fileName);
  const [download, stopResult] = await Promise.all([
    downloadPromise,
    stopResultPromise
  ]);
  await download.saveAs(outputPath);
  const capture = scenario.hqVideoCapture;
  capture.captureEndSec = Math.max(
    capture.captureStartSec,
    (Date.now() - session.videoStartedAtMs) / 1000
  );
  capture.durationSec = Math.max(
    0,
    (Date.now() - controller.startedAtMs) / 1000
  );
  capture.file = fileName;
  capture.bytes = stopResult.bytes;
  capture.sha256 = createHash("sha256")
    .update(readFileSync(outputPath))
    .digest("hex");
  if (SKIP_PLAYWRIGHT_VIDEO) {
    scenario.video = fileName;
  }
  session.hqVideoCapture = null;
}

async function startLiveRuntimeCapture(session, scenario) {
  const captureId = `capture-${Date.now()}`;
  const captureRoot = path.join(
    OUTPUT_DIR,
    "live-runtime-frames",
    scenario.id,
    captureId
  );
  mkdirSync(captureRoot, { recursive: true });
  const requestedIntervalMs = RUNTIME_CAPTURE_INTERVAL_MS;
  const samples = [];
  const errors = [];
  const cdp = await session.context.newCDPSession(session.page);
  let lastAcceptedAtMs = Number.NEGATIVE_INFINITY;
  let resolveFirstFrame;
  let rejectFirstFrame;
  const firstFrame = new Promise((resolve, reject) => {
    resolveFirstFrame = resolve;
    rejectFirstFrame = reject;
  });
  const onFrame = (event) => {
    void cdp
      .send("Page.screencastFrameAck", { sessionId: event.sessionId })
      .catch((error) => errors.push(String(error)));
    const sampledAtMs = Date.now();
    if (sampledAtMs - lastAcceptedAtMs < requestedIntervalMs - 8) return;
    lastAcceptedAtMs = sampledAtMs;
    try {
      const frameNumber = samples.length + 1;
      const screenshot = `frame-${String(frameNumber).padStart(4, "0")}.png`;
      writeFileSync(
        path.join(captureRoot, screenshot),
        Buffer.from(event.data, "base64")
      );
      samples.push({
        frameNumber,
        screenshot,
        sampledAtSec: Math.max(
          0,
          (sampledAtMs - session.videoStartedAtMs) / 1000
        ),
        sourceTimestampSec: event.metadata?.timestamp ?? null
      });
      resolveFirstFrame();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      rejectFirstFrame(error);
    }
  };
  cdp.on("Page.screencastFrame", onFrame);
  await cdp.send("Page.startScreencast", {
    format: "png",
    quality: 100,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
    everyNthFrame: 1
  });
  const firstFrameTimeout = setTimeout(
    () => rejectFirstFrame(new Error("Chrome screencast did not emit a PNG frame")),
    2_000
  );
  try {
    await firstFrame;
  } finally {
    clearTimeout(firstFrameTimeout);
  }
  const controller = {
    stopped: false,
    stopPromise: null,
    samples,
    errors,
    cdp,
    onFrame
  };

  scenario.liveFrameCapture = {
    source: "direct-runtime-png",
    transport: "chrome-cdp-screencast",
    directory: path.relative(OUTPUT_DIR, captureRoot),
    requestedIntervalMs,
    frameCount: samples.length,
    baseline: samples[0]?.screenshot ?? null,
    captureStartSec: samples[0]?.sampledAtSec ?? null,
    captureEndSec: samples.at(-1)?.sampledAtSec ?? null,
    samples
  };
  return controller;
}

async function stopLiveRuntimeCapture(session, scenario) {
  const controller = session.liveRuntimeCapture;
  if (!controller) return;
  if (!controller.stopPromise) {
    controller.stopped = true;
    controller.stopPromise = (async () => {
      try {
        await controller.cdp.send("Page.stopScreencast");
      } catch (error) {
        controller.errors.push(
          error instanceof Error ? error.message : String(error)
        );
      }
      controller.cdp.off("Page.screencastFrame", controller.onFrame);
      await controller.cdp.detach().catch((error) => {
        controller.errors.push(
          error instanceof Error ? error.message : String(error)
        );
      });
    })();
  }
  await controller.stopPromise;
  const capture = scenario.liveFrameCapture;
  if (capture) {
    capture.frameCount = controller.samples.length;
    capture.captureStartSec = controller.samples[0]?.sampledAtSec ?? null;
    capture.captureEndSec = controller.samples.at(-1)?.sampledAtSec ?? null;
    const intervals = controller.samples
      .slice(1)
      .map(
        (sample, index) =>
          (sample.sampledAtSec - controller.samples[index].sampledAtSec) * 1000
      );
    capture.actualIntervalMs =
      intervals.length > 0
        ? {
            minimum: Math.min(...intervals),
            maximum: Math.max(...intervals),
            average:
              intervals.reduce((total, value) => total + value, 0) /
              intervals.length
          }
        : null;
    capture.errors = [...controller.errors];
    if (controller.errors.length > 0) {
      fail(
        scenario,
        `Chrome 即時 PNG 串流錯誤：${controller.errors.join(" | ")}`
      );
    }
  }
  session.liveRuntimeCapture = null;
}

function validateLiveRuntimeCapture(scenario) {
  const capture = scenario.liveFrameCapture;
  const actionStartSec = scenario.timeline?.actionStartSec;
  const actionEndSec = scenario.timeline?.actionEndSec;
  const interval = capture?.actualIntervalMs;
  const passed =
    capture?.source === "direct-runtime-png" &&
    capture.errors?.length === 0 &&
    capture.frameCount >= 4 &&
    actionStartSec != null &&
    actionEndSec != null &&
    capture.captureStartSec <= actionStartSec + 0.25 &&
    capture.captureEndSec >= actionEndSec + 0.12 &&
    interval != null &&
    interval.average <= capture.requestedIntervalMs * 1.8 &&
    interval.maximum <= capture.requestedIntervalMs * 3.5;
  scenario.checks.push({
    name: "direct-uncompressed-runtime-png-sequence",
    status: passed ? "pass" : "fail",
    frameCount: capture?.frameCount ?? 0,
    captureStartSec: capture?.captureStartSec ?? null,
    captureEndSec: capture?.captureEndSec ?? null,
    actionStartSec: actionStartSec ?? null,
    actionEndSec: actionEndSec ?? null,
    requestedIntervalMs: capture?.requestedIntervalMs ?? null,
    actualIntervalMs: interval ?? null
  });
  if (!passed) {
    fail(
      scenario,
      `直接 PNG 動態取樣不完整：${JSON.stringify(
        scenario.checks.at(-1)
      )}`
    );
  }
}

async function openArena({
  classId,
  classLabel,
  loadout,
  turretKind = "mechanical",
  mode = "free_for_all",
  noBots = false,
  freezeBots = true,
  reviewBotCount = 2,
  reviewBotHealth = 5000,
  reviewSpawnPoint = { x: 4700, y: 3200 },
  reviewTargetPoint = { x: 5100, y: 3200 }
}) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    ...(SKIP_PLAYWRIGHT_VIDEO
      ? {}
      : { recordVideo: { dir: OUTPUT_DIR, size: VIEWPORT } })
  });
  const reviewAssetOverride = archerMovingDrawAtlasOverride
    ? {
        ...report.reviewAssetOverride,
        requestCount: 0,
        requestCounts: { asset: 0 },
        requestedUrls: []
      }
    : archerActionBodyAtlasOverride
    ? {
        ...report.reviewAssetOverride,
        requestCount: 0,
        requestCounts: { asset: 0 },
        requestedUrls: []
      }
    : engineerSiegeImpactOverride
    ? {
        ...report.reviewAssetOverride,
        requestCount: 0,
        requestCounts: { manifest: 0, impact: 0 },
        requestedUrls: []
      }
    : null;
  if (reviewAssetOverride?.kind === "archer-moving-full-draw-atlas") {
    await context.route(
      "**/assets/generated/characters/new-compatible/archer/moving-full-draw-8dir.png*",
      async (route) => {
        reviewAssetOverride.requestCount += 1;
        reviewAssetOverride.requestCounts.asset += 1;
        reviewAssetOverride.requestedUrls.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: archerMovingDrawAtlasOverride.bytes
        });
      }
    );
  }
  if (reviewAssetOverride?.kind === "archer-action-body-atlas") {
    await context.route(
      (url) =>
        decodeURIComponent(url.pathname).endsWith(
          archerActionBodyAtlasOverride.assetUrl
        ),
      async (route) => {
        reviewAssetOverride.requestCount += 1;
        reviewAssetOverride.requestCounts.asset += 1;
        reviewAssetOverride.requestedUrls.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: archerActionBodyAtlasOverride.bytes
        });
      }
    );
  }
  if (reviewAssetOverride?.kind === "engineer-06-topdown-impact-candidate") {
    await context.route(
      (url) =>
        url.pathname.endsWith(
          "/src/game/assets/arenaSkillRuntimeManifest.json"
        ),
      async (route) => {
        reviewAssetOverride.requestCount += 1;
        reviewAssetOverride.requestCounts.manifest += 1;
        reviewAssetOverride.requestedUrls.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "application/javascript; charset=utf-8",
          body: engineerSiegeImpactOverride.manifestModuleBytes
        });
      }
    );
    await context.route(
      (url) =>
        decodeURIComponent(url.pathname).endsWith(
          "/assets/arena-skills/engineer_工程師/3_R_高階/06_攻城模式_engineer_06/runtime/impact.png"
        ),
      async (route) => {
        reviewAssetOverride.requestCount += 1;
        reviewAssetOverride.requestCounts.impact += 1;
        reviewAssetOverride.requestedUrls.push(route.request().url());
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: engineerSiegeImpactOverride.bytes
        });
      }
    );
  }
  await context.addInitScript(
    ({ selectedClass, storedLoadout, engineerTurretKind }) => {
      localStorage.setItem("renaiss:first-language-selected:v2", "1");
      localStorage.setItem("renaiss:tutorial:arena:v1", "1");
      localStorage.setItem(
        "renaiss:arena-catalog-loadouts:v3",
        JSON.stringify({ [selectedClass]: storedLoadout })
      );
      localStorage.setItem("renaiss.engineer.turret-kind", engineerTurretKind);
      sessionStorage.setItem("renaiss:x-login-entered:v1", "dev:local-dev");
    },
    {
      selectedClass: classId,
      storedLoadout: loadout,
      engineerTurretKind: turretKind
    }
  );

  const page = await context.newPage();
  const videoStartedAtMs = Date.now();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      failedRequests.push(
        `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "failed"}`
      );
    }
  });

  const reviewQuery = noBots
    ? "&reviewBots=0&reviewSpawn=fixed&reviewSpawnX=3800&reviewSpawnY=3000&reviewInvulnerable=1"
    : `&reviewBots=1&reviewBotCount=${reviewBotCount}&reviewBotHealth=${reviewBotHealth}&reviewFreezeBots=${freezeBots ? 1 : 0}&reviewSpawn=fixed&reviewSpawnX=${reviewSpawnPoint.x}&reviewSpawnY=${reviewSpawnPoint.y}&reviewTargetX=${reviewTargetPoint.x}&reviewTargetY=${reviewTargetPoint.y}&reviewInvulnerable=1`;
  await page.goto(`${BASE_URL}/?arena=1&debugArena=1${reviewQuery}`, {
    waitUntil: "domcontentloaded"
  });
  // Vite can finish one hot-reload immediately after the first review context
  // opens. Re-open the same real Arena start panel once if that transient
  // render drops its Enter button; never substitute a mock scene or a video.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.locator(".start-panel").waitFor({ timeout: 20_000 });
      if (mode === "team_3v3") {
        await page.locator(".arena-mode-selector button").nth(1).click();
      }
      await page.locator(".class-card").filter({ hasText: classLabel }).click();
      await page.locator(".enter-button").click({ timeout: 8_000 });
      await page
        .locator(".start-panel")
        .waitFor({ state: "detached", timeout: 20_000 });
      break;
    } catch (error) {
      if (attempt === 1) throw error;
      await page.reload({ waitUntil: "domcontentloaded" });
    }
  }
  await page.waitForFunction(
    () => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      return Boolean(scene?.snapshot?.selfId && scene?.playerViews?.has(scene.snapshot.selfId));
    },
    undefined,
    { timeout: 20_000 }
  );
  if (REVIEW_CAMERA_ZOOM !== 1) {
    await page.evaluate((zoom) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      const camera = scene?.cameras?.main;
      if (!scene || !camera) {
        throw new Error("Arena review camera is unavailable for zoom framing");
      }
      const applyZoom = () => camera.setZoom(zoom);
      applyZoom();
      scene.events.on("postupdate", applyZoom);
      window.__arenaReviewCameraZoom = {
        zoom,
        mode: "review-only-postupdate-zoom-lock"
      };
    }, REVIEW_CAMERA_ZOOM);
    await page.waitForTimeout(180);
  }
  if (CLEAN_CANVAS_ONLY) {
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.dataset.arenaCleanCanvasCapture = "true";
      style.textContent = `
        body * { visibility: hidden !important; }
        canvas { visibility: visible !important; }
      `;
      document.head.appendChild(style);
    });
    await page.waitForTimeout(180);
  }
  return {
    context,
    page,
    reviewAssetOverride,
    video: page.video(),
    videoStartedAtMs,
    consoleErrors,
    pageErrors,
    failedRequests
  };
}

async function installControlledInput(page, turretKind) {
  await page.evaluate((engineerTurretKind) => {
    const scene = window.__renaissArenaGame.scene.scenes[0];
    const self = scene.snapshot.players.find(
      (player) => player.id === scene.snapshot.selfId
    );
    window.__dynamicGalleryInput = {
      moveX: 0,
      moveY: 0,
      angle: 0,
      aimX: self.x + 300,
      aimY: self.y,
      attack: false,
      sprint: false,
      skillF: false,
      skillQ: false,
      skillE: false,
      skillR: false,
      engineerTurretKind
    };
    scene.sendInput = function sendDynamicGalleryInput() {
      if (!this.socket || !this.snapshot) return;
      this.socket.sendInput({ ...window.__dynamicGalleryInput });
    };
  }, turretKind);
}

async function installRuntimeTelemetry(page) {
  await page.evaluate((telemetryIntervalMs) => {
    if (window.__dynamicGalleryTelemetryTimer) {
      window.clearInterval(window.__dynamicGalleryTelemetryTimer);
    }
    window.__dynamicGalleryTelemetry = [];
    if (window.__dynamicGalleryRenderFrameHandle) {
      window.cancelAnimationFrame(window.__dynamicGalleryRenderFrameHandle);
    }
    window.__dynamicGalleryRenderFrameTrace = [];
    let lastEngineerSiegeTexture = null;
    const traceRenderedFrames = () => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      const snapshot = scene?.snapshot;
      const impactView = [...(scene?.vfxViews?.entries?.() ?? [])].find(
        ([effectId, view]) => {
          const effect = snapshot?.effects?.find(
            (candidate) => candidate.id === effectId
          );
          return (
            effect?.skillId === "engineer_06" &&
            String(view?.image?.texture?.key ?? "").includes("_impact_")
          );
        }
      );
      const textureKey = impactView?.[1]?.image?.texture?.key ?? null;
      if (textureKey && textureKey !== lastEngineerSiegeTexture) {
        const image = impactView[1].image;
        window.__dynamicGalleryRenderFrameTrace.push({
          atMs: Date.now(),
          serverTime: snapshot?.serverTime ?? null,
          textureKey,
          x: image.x,
          y: image.y,
          displayWidth: image.displayWidth,
          displayHeight: image.displayHeight,
          originX: image.originX,
          originY: image.originY,
          rotation: image.rotation,
          alpha: image.alpha
        });
      }
      lastEngineerSiegeTexture = textureKey;
      window.__dynamicGalleryRenderFrameHandle =
        window.requestAnimationFrame(traceRenderedFrames);
    };
    window.__dynamicGalleryRenderFrameHandle =
      window.requestAnimationFrame(traceRenderedFrames);
    window.__dynamicGalleryTelemetryTimer = window.setInterval(() => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      const snapshot = scene?.snapshot;
      if (!scene || !snapshot?.selfId) {
        return;
      }
      const self = snapshot.players.find((player) => player.id === snapshot.selfId);
      const camera = scene.cameras?.main;
      const owned = (entity) => entity.ownerId === snapshot.selfId;
      const serializeImage = (image) => {
        const bounds = image?.getBounds?.();
        return image
          ? {
              x: image.x,
              y: image.y,
              displayWidth: image.displayWidth,
              displayHeight: image.displayHeight,
              originX: image.originX,
              originY: image.originY,
              rotation: image.rotation,
              depth: image.depth,
              alpha: image.alpha,
              visible: image.visible,
              textureKey: image.texture?.key ?? null,
              frameName: image.frame?.name ?? null,
              bounds: bounds
                ? {
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height
                  }
                : null
            }
          : null;
      };
      const effectById = new Map(
        snapshot.effects.map((effect) => [effect.id, effect])
      );
      const projectileById = new Map(
        snapshot.projectiles.map((projectile) => [projectile.id, projectile])
      );
      const playerById = new Map(
        snapshot.players.map((player) => [player.id, player])
      );
      window.__dynamicGalleryTelemetry.push({
        atMs: Date.now(),
        serverTime: snapshot.serverTime,
        renderTime:
          snapshot.serverTime +
          Math.max(0, performance.now() - (scene.snapshotReceivedAtMs ?? 0)),
        self: self
          ? {
              id: self.id,
              x: self.x,
              y: self.y,
              angle: self.angle,
              health: self.health,
              action: self.action,
              actionSkillId: self.actionSkillId,
              actionStartedAt: self.actionStartedAt,
              actionEndsAt: self.actionEndsAt,
              cooldowns: { ...self.cooldowns },
              focusLensEndsAt: self.focusLensEndsAt,
              concealmentEndsAt: self.concealmentEndsAt,
              shielded: self.shielded
            }
          : null,
        targets: snapshot.players
          .filter((player) => player.id !== snapshot.selfId && player.bot)
          .map((player) => ({
            id: player.id,
            x: player.x,
            y: player.y,
            health: player.health,
            maxHealth: player.maxHealth,
            alive: player.alive,
            rooted: player.rooted,
            stunned: player.stunned,
            poisoned: player.poisoned,
            slowed: player.slowed
          })),
        projectiles: snapshot.projectiles.filter(owned).map((projectile) => ({
          id: projectile.id,
          skillId: projectile.skillId ?? null,
          type: projectile.type,
          sourceTurretId: projectile.sourceTurretId ?? null,
          spawnX: projectile.spawnX,
          spawnY: projectile.spawnY,
          x: projectile.x,
          y: projectile.y,
          angle: projectile.angle
        })),
        effects: snapshot.effects.filter(owned).map((effect) => ({
          id: effect.id,
          skillId: effect.skillId ?? null,
          type: effect.type,
          targetId: effect.targetId ?? null,
          x: effect.x,
          y: effect.y,
          startX: effect.startX ?? null,
          startY: effect.startY ?? null,
          sourceTurretId: effect.sourceTurretId ?? null,
          endX: effect.endX ?? null,
          endY: effect.endY ?? null,
          radius: effect.radius,
          startedAt: effect.startedAt,
          duration: effect.duration,
          visualRole: effect.visualRole ?? "primary",
          activeStartedAt: effect.activeStartedAt ?? null,
          activeDuration: effect.activeDuration ?? null
        })),
        turrets: snapshot.turrets.filter(owned).map((turret) => ({
          id: turret.id,
          kind: turret.kind,
          x: turret.x,
          y: turret.y,
          angle: turret.angle,
          health: turret.health,
          shield: turret.shield
        })),
        camera: camera
          ? {
              x: camera.x,
              y: camera.y,
              width: camera.width,
              height: camera.height,
              scrollX: camera.scrollX,
              scrollY: camera.scrollY,
              zoom: camera.zoom,
              worldView: {
                x: camera.worldView.x,
                y: camera.worldView.y,
                width: camera.worldView.width,
                height: camera.worldView.height
              }
            }
          : null,
        renderViews: {
          vfx: [...(scene.vfxViews?.entries?.() ?? [])].map(
            ([effectId, view]) => {
              const effect = effectById.get(effectId);
              return {
                effectId,
                skillId: effect?.skillId ?? null,
                type: effect?.type ?? null,
                image: serializeImage(view.image),
                impactRing:
                  view.impactRing?.visible && effect?.skillId === "archer_14"
                    ? {
                        x: effect.x,
                        y: effect.y,
                        radius: effect.radius,
                        visible: view.impactRing.visible,
                        alpha: view.impactRing.alpha,
                        depth: view.impactRing.depth
                      }
                    : null,
                pathCore: view.pathCoreState
                  ? { ...view.pathCoreState, depth: view.pathCore?.depth ?? null }
                  : null
              };
            }
          ),
          projectiles: [...(scene.projectileViews?.entries?.() ?? [])].map(
            ([projectileId, view]) => {
              const projectile = projectileById.get(projectileId);
              return {
                projectileId,
                skillId: projectile?.skillId ?? null,
                type: projectile?.type ?? null,
                phase: projectile?.phase ?? null,
                stretchMode:
                  view.trail?.is3Slice === true
                    ? "three-slice-distance"
                    : null,
                sprite: serializeImage(view.sprite),
                trail: serializeImage(view.trail)
              };
            }
          ),
          players: [...(scene.playerViews?.entries?.() ?? [])].map(
            ([playerId, view]) => {
              const player = playerById.get(playerId);
              return {
                playerId,
                classId: player?.classId ?? null,
                action: player?.action ?? null,
                containerX: view.container?.x ?? null,
                containerY: view.container?.y ?? null,
                sprite: serializeImage(view.sprite),
                concealmentOutline: serializeImage(view.concealmentOutline),
                actionFxBack: serializeImage(view.actionFxBack),
                actionFxFront: serializeImage(view.actionFxFront)
              };
            }
          ),
          turrets: [...(scene.turretViews?.entries?.() ?? [])].map(
            ([turretId, view]) => ({
              turretId,
              containerX: view.container?.x ?? null,
              containerY: view.container?.y ?? null,
              containerDepth: view.container?.depth ?? null,
              body: serializeImage(view.body)
            })
          )
        }
      });
      if (window.__dynamicGalleryTelemetry.length > 720) {
        window.__dynamicGalleryTelemetry.shift();
      }
    }, telemetryIntervalMs);
  }, TELEMETRY_INTERVAL_MS);
}

async function approachNearestEnemy(page, desiredDistance) {
  const timeoutAt = Date.now() + 14_000;
  let result = {
    targetId: null,
    distance: Number.POSITIVE_INFINITY,
    aim: { x: 0, y: 0 }
  };
  while (Date.now() < timeoutAt) {
    result = await page.evaluate((stopDistance) => {
      const scene = window.__renaissArenaGame.scene.scenes[0];
      const self = scene.snapshot.players.find(
        (player) => player.id === scene.snapshot.selfId
      );
      const targets = scene.snapshot.players
        .filter(
          (player) =>
            player.id !== self.id &&
            player.alive &&
            (scene.snapshot.round.mode !== "team_3v3" || player.team !== self.team)
        )
        .sort(
          (left, right) =>
            Math.hypot(left.x - self.x, left.y - self.y) -
            Math.hypot(right.x - self.x, right.y - self.y)
        );
      const target = targets[0];
      if (!target) {
        return {
          targetId: null,
          distance: Number.POSITIVE_INFINITY,
          aim: { x: self.x + 300, y: self.y }
        };
      }
      const dx = target.x - self.x;
      const dy = target.y - self.y;
      const distance = Math.hypot(dx, dy);
      window.__dynamicGalleryInput = {
        ...window.__dynamicGalleryInput,
        moveX: distance > stopDistance ? dx / distance : 0,
        moveY: distance > stopDistance ? dy / distance : 0,
        angle: Math.atan2(dy, dx) * 180 / Math.PI,
        sprint: distance > 560,
        aimX: target.x,
        aimY: target.y
      };
      return {
        targetId: target.id,
        distance,
        aim: { x: target.x, y: target.y }
      };
    }, desiredDistance);
    if (result.distance <= desiredDistance) break;
    await page.waitForTimeout(90);
  }
  await setInput(page, { moveX: 0, moveY: 0, sprint: false });
  await page.waitForTimeout(120);
  if (!result.targetId) throw new Error("找不到可互動的敵方角色。");
  return result;
}

async function getGravityWellEdgeAim(page, targetId) {
  return page.evaluate((targetId) => {
    const scene = window.__renaissArenaGame.scene.scenes[0];
    const self = scene.snapshot.players.find(
      (player) => player.id === scene.snapshot.selfId
    );
    const target = scene.snapshot.players.find((player) => player.id === targetId);
    if (!self || !target) {
      throw new Error("重力井驗收找不到施法者或目標。");
    }
    const dx = target.x - self.x;
    const dy = target.y - self.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) {
      throw new Error("重力井驗收的施法者與目標重疊，無法建立拉扯軸線。");
    }
    const targetDistance = 165;
    return {
      // The target begins 165 units from the well centre: visibly inside the
      // authoritative 200-unit radius, but far enough out to show the pull.
      aim: {
        x: target.x - (dx / distance) * targetDistance,
        y: target.y - (dy / distance) * targetDistance
      },
      target: { x: target.x, y: target.y },
      targetDistance
    };
  }, targetId);
}

async function nearestEnemyAim(page) {
  return page.evaluate(() => {
    const scene = window.__renaissArenaGame.scene.scenes[0];
    const self = scene.snapshot.players.find(
      (player) => player.id === scene.snapshot.selfId
    );
    const target = scene.snapshot.players
      .filter(
        (player) =>
          player.id !== self.id &&
          player.alive &&
          (scene.snapshot.round.mode !== "team_3v3" || player.team !== self.team)
      )
      .sort(
        (left, right) =>
          Math.hypot(left.x - self.x, left.y - self.y) -
          Math.hypot(right.x - self.x, right.y - self.y)
      )[0];
    return target
      ? { x: target.x, y: target.y }
      : { x: self.x + 300, y: self.y };
  });
}

async function deployTurretAtOffset(page, offsetX, offsetY, expectedCount) {
  const self = await readSelf(page);
  await castSkill(page, "skillF", {
    x: self.x + offsetX,
    y: self.y + offsetY
  });
  await waitForOwnedTurretCount(page, expectedCount);
}

async function moveFor(page, moveX, moveY, durationMs) {
  await setInput(page, { moveX, moveY, sprint: false });
  await page.waitForTimeout(durationMs);
  await setInput(page, { moveX: 0, moveY: 0, sprint: false });
  await page.waitForTimeout(100);
}

async function castSkill(page, slot, aim) {
  await setAim(page, aim);
  await pulseInput(page, slot, 155);
}

async function castSkillUntilCooldown(page, slot, aim, timeoutMs = 2800) {
  const timeoutAt = Date.now() + timeoutMs;
  while (Date.now() < timeoutAt) {
    await castSkill(page, slot, aim);
    const started = await page.evaluate((skillSlot) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      const self = scene?.snapshot?.players?.find(
        (player) => player.id === scene.snapshot.selfId
      );
      return Boolean(
        self && self.cooldowns[skillSlot] > scene.snapshot.serverTime
      );
    }, slot);
    if (started) return;
    await page.waitForTimeout(180);
  }
  throw new Error(`${slot} 在 ${timeoutMs}ms 內沒有進入冷卻，技能未成功施放。`);
}

async function pulseInput(page, key, durationMs) {
  await setInput(page, { [key]: true });
  await page.waitForTimeout(durationMs);
  await setInput(page, { [key]: false });
}

async function setAim(page, aim) {
  await page.evaluate((target) => {
    const scene = window.__renaissArenaGame.scene.scenes[0];
    const self = scene.snapshot.players.find(
      (player) => player.id === scene.snapshot.selfId
    );
    const angle =
      Math.atan2(target.y - self.y, target.x - self.x) * 180 / Math.PI;
    window.__dynamicGalleryInput = {
      ...window.__dynamicGalleryInput,
      aimX: target.x,
      aimY: target.y,
      angle
    };
  }, aim);
  await page.waitForTimeout(90);
}

async function setInput(page, patch) {
  await page.evaluate((next) => {
    window.__dynamicGalleryInput = {
      ...window.__dynamicGalleryInput,
      ...next
    };
  }, patch);
}

async function readSelf(page) {
  return page.evaluate(() => {
    const scene = window.__renaissArenaGame.scene.scenes[0];
    const self = scene.snapshot.players.find(
      (player) => player.id === scene.snapshot.selfId
    );
    return {
      id: self.id,
      x: self.x,
      y: self.y,
      team: self.team,
      cooldowns: self.cooldowns
    };
  });
}

async function readOwnedTurrets(page) {
  return page.evaluate(() => {
    const scene = window.__renaissArenaGame.scene.scenes[0];
    return scene.snapshot.turrets
      .filter((turret) => turret.ownerId === scene.snapshot.selfId)
      .sort((left, right) => left.deployedAt - right.deployedAt)
      .map((turret) => ({
        id: turret.id,
        x: turret.x,
        y: turret.y,
        deployedAt: turret.deployedAt
      }));
  });
}

async function prepareBarrierTurretPlacement(
  page,
  firstTurret,
  requestedDistance,
  deployDistance
) {
  let movementSteps = 0;
  for (; movementSteps < 80; movementSteps += 1) {
    const self = await readSelf(page);
    const radiusFromFirst = Math.hypot(
      self.x - firstTurret.x,
      self.y - firstTurret.y
    );
    const circlesIntersect =
      requestedDistance <= radiusFromFirst + deployDistance + 0.25 &&
      requestedDistance >= Math.abs(radiusFromFirst - deployDistance) - 0.25;
    if (circlesIntersect && radiusFromFirst > 0.001) {
      await setInput(page, { moveX: 0, moveY: 0, sprint: false });
      await page.waitForTimeout(140);
      const settledSelf = await readSelf(page);
      const aim = barrierCircleIntersection(
        settledSelf,
        firstTurret,
        deployDistance,
        requestedDistance
      );
      return {
        movementSteps,
        playerAtDeploy: { x: settledSelf.x, y: settledSelf.y },
        aim
      };
    }

    // Walk directly away from the first turret until a real deployment circle
    // can intersect the requested 100/320-distance circle. The position is
    // never mutated; only the same movement input used by a player is sent.
    const awayX = self.x - firstTurret.x;
    const awayY = self.y - firstTurret.y;
    const awayLength = Math.max(0.001, Math.hypot(awayX, awayY));
    await setInput(page, {
      moveX: awayX / awayLength,
      moveY: awayY / awayLength,
      sprint: false
    });
    await page.waitForTimeout(70);
    await setInput(page, { moveX: 0, moveY: 0, sprint: false });
    await page.waitForTimeout(100);
  }
  await setInput(page, { moveX: 0, moveY: 0, sprint: false });
  throw new Error(
    `無法以真實走位建立 ${requestedDistance} 距離的第二座砲台部署圓。`
  );
}

function barrierCircleIntersection(self, firstTurret, deployDistance, linkDistance) {
  const dx = firstTurret.x - self.x;
  const dy = firstTurret.y - self.y;
  const centerDistance = Math.hypot(dx, dy);
  if (centerDistance <= 0.001) {
    throw new Error("工程師與第一座砲台重疊，無法計算第二座砲台部署角度。");
  }
  const along =
    (deployDistance ** 2 - linkDistance ** 2 + centerDistance ** 2) /
    (2 * centerDistance);
  const perpendicular = Math.sqrt(
    Math.max(0, deployDistance ** 2 - along ** 2)
  );
  const unitX = dx / centerDistance;
  const unitY = dy / centerDistance;
  return {
    x: self.x + along * unitX - perpendicular * unitY,
    y: self.y + along * unitY + perpendicular * unitX
  };
}

async function readBarrierGeometry(page) {
  return page.evaluate(() => {
    const scene = window.__renaissArenaGame.scene.scenes[0];
    const effect = scene.snapshot.effects.find(
      (candidate) =>
        candidate.ownerId === scene.snapshot.selfId &&
        candidate.skillId === "engineer_08"
    );
    if (!effect || effect.endX == null || effect.endY == null) {
      throw new Error("實戰 snapshot 沒有屏障節點端點。");
    }
    const startX = effect.x * 2 - effect.endX;
    const startY = effect.y * 2 - effect.endY;
    return {
      startX,
      startY,
      endX: effect.endX,
      endY: effect.endY,
      lineLength: Math.hypot(effect.endX - startX, effect.endY - startY)
    };
  });
}

async function waitForCooldown(page, slot) {
  await page.waitForFunction(
    (skillSlot) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      const self = scene?.snapshot?.players?.find(
        (player) => player.id === scene.snapshot.selfId
      );
      return Boolean(self && self.cooldowns[skillSlot] <= scene.snapshot.serverTime);
    },
    slot,
    { timeout: 12_000 }
  );
}

async function waitForCooldownStarted(page, slot) {
  await page.waitForFunction(
    (skillSlot) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      const self = scene?.snapshot?.players?.find(
        (player) => player.id === scene.snapshot.selfId
      );
      return Boolean(self && self.cooldowns[skillSlot] > scene.snapshot.serverTime);
    },
    slot,
    { timeout: 5_000 }
  );
}

async function waitForTargetPull(
  page,
  targetId,
  initialPoint,
  minimumDisplacement
) {
  await page.waitForFunction(
    ({ expectedTargetId, start, minimum }) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      const target = scene?.snapshot?.players?.find(
        (player) => player.id === expectedTargetId
      );
      return Boolean(
        target && Math.hypot(target.x - start.x, target.y - start.y) >= minimum
      );
    },
    { expectedTargetId: targetId, start: initialPoint, minimum: minimumDisplacement },
    { timeout: 5_000 }
  );
  return page.evaluate((expectedTargetId) => {
    const scene = window.__renaissArenaGame.scene.scenes[0];
    const target = scene.snapshot.players.find(
      (player) => player.id === expectedTargetId
    );
    if (!target) throw new Error("暗鉤牽引後找不到目標位置。");
    return { x: target.x, y: target.y };
  }, targetId);
}

async function waitForActionSkillStarted(page, skillId) {
  await page.waitForFunction(
    (expectedSkillId) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      const self = scene?.snapshot?.players?.find(
        (player) => player.id === scene.snapshot.selfId
      );
      return Boolean(self && self.actionSkillId === expectedSkillId);
    },
    skillId,
    { timeout: 5_000 }
  );
}

async function waitForOwnedTurretCount(page, expectedCount) {
  await page.waitForFunction(
    (count) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      return (
        scene?.snapshot?.turrets?.filter(
          (turret) => turret.ownerId === scene.snapshot.selfId
        ).length >= count
      );
    },
    expectedCount,
    { timeout: 5_000 }
  );
}

async function waitForSkillEffect(page, skillId) {
  await page.waitForFunction(
    (id) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      return scene?.snapshot?.effects?.some(
        (effect) =>
          effect.ownerId === scene.snapshot.selfId && effect.skillId === id
      );
    },
    skillId,
    { timeout: 5_000 }
  );
}

async function waitForProjectileBySkill(page, skillId) {
  await page.waitForFunction(
    (id) => {
      const scene = window.__renaissArenaGame?.scene?.scenes?.[0];
      return scene?.snapshot?.projectiles?.some(
        (projectile) =>
          projectile.ownerId === scene.snapshot.selfId &&
          projectile.skillId === id
      );
    },
    skillId,
    { timeout: 5_000 }
  );
}

async function readArenaCounts(page) {
  return page.evaluate(() => {
    const scene = window.__renaissArenaGame.scene.scenes[0];
    const owned = (entity) => entity.ownerId === scene.snapshot.selfId;
    return {
      mode: scene.snapshot.round.mode,
      playerCount: scene.snapshot.players.length,
      ownedTurrets: scene.snapshot.turrets.filter(owned).length,
      ownedProjectiles: scene.snapshot.projectiles.filter(owned).length,
      ownedEffects: scene.snapshot.effects.filter(owned).length
    };
  });
}

async function closeSession(session, scenario) {
  try {
    const runtimeEvidence = await session.page.evaluate((videoStartedAtMs) => {
      if (window.__dynamicGalleryTelemetryTimer) {
        window.clearInterval(window.__dynamicGalleryTelemetryTimer);
      }
      if (window.__dynamicGalleryRenderFrameHandle) {
        window.cancelAnimationFrame(window.__dynamicGalleryRenderFrameHandle);
      }
      return {
        telemetry: (window.__dynamicGalleryTelemetry ?? []).map((sample) => ({
          ...sample,
          videoTimeSec: Math.max(0, (sample.atMs - videoStartedAtMs) / 1000)
        })),
        renderFrameTrace: (window.__dynamicGalleryRenderFrameTrace ?? []).map(
          (sample) => ({
            ...sample,
            videoTimeSec: Math.max(
              0,
              (sample.atMs - videoStartedAtMs) / 1000
            )
          })
        )
      };
    }, session.videoStartedAtMs);
    scenario.telemetry = runtimeEvidence.telemetry;
    scenario.renderFrameTrace = runtimeEvidence.renderFrameTrace;
    validateRuntimeTelemetry(scenario);
  } catch (error) {
    fail(
      scenario,
      `telemetry: ${error instanceof Error ? error.message : String(error)}`
    );
    scenario.telemetry = [];
  }
  await session.context.close();
  if (session.video) {
    const rawVideoPath = await session.video.path();
    const stableVideoPath = path.join(OUTPUT_DIR, `${scenario.id}.webm`);
    renameSync(rawVideoPath, stableVideoPath);
    scenario.video = path.relative(OUTPUT_DIR, stableVideoPath);
  } else if (!scenario.video) {
    scenario.video = null;
  }
  for (const message of session.consoleErrors) {
    fail(scenario, `console: ${message}`);
  }
  for (const message of session.pageErrors) {
    fail(scenario, `page: ${message}`);
  }
  for (const message of session.failedRequests) {
    fail(scenario, `request: ${message}`);
  }
}

function validateRuntimeTelemetry(scenario) {
  const start = scenario.timeline?.actionStartSec ?? 0;
  const end = scenario.timeline?.actionEndSec ?? start + 0.5;
  const finalSample = scenario.telemetry.at(-1) ?? null;
  // A Vite/tsx watch restart can disconnect Socket.IO while Chrome keeps the
  // last canvas frame visible.  Without this continuity gate that frozen frame
  // can still satisfy the entity/action evidence check and be reported GREEN.
  const telemetryCoversRecovery =
    finalSample != null && finalSample.videoTimeSec >= end + 0.12;
  const samples = scenario.telemetry.filter(
    (sample) =>
      sample.videoTimeSec >= Math.max(0, start - 0.15) &&
      sample.videoTimeSec <= end + 0.25
  );
  const selectedSkill = scenario.selectedSkill;
  const selectedSlot = scenario.selectedSlot;
  const matchingEffects = samples.flatMap((sample) =>
    sample.effects.filter((effect) => effect.skillId === selectedSkill)
  );
  const matchingProjectiles = samples.flatMap((sample) =>
    sample.projectiles.filter((projectile) => projectile.skillId === selectedSkill)
  );
  const actionSamples = samples.filter(
    (sample) => sample.self?.action === selectedSlot
  );
  const maximumTurrets = Math.max(
    0,
    ...samples.map((sample) => sample.turrets.length)
  );
  const coreProjectileSamples = samples.flatMap((sample) =>
    sample.projectiles.filter((projectile) =>
      [
        "mechanical_turret",
        "magic_turret_basic",
        "magic_turret_sync",
        "magic_turret_split",
        "magic_turret_split_fragment",
        "magic_turret_matrix"
      ].includes(projectile.type)
    )
  );
  const targetDamage = Object.fromEntries(
    [...new Set(samples.flatMap((sample) => sample.targets.map((target) => target.id)))].map(
      (targetId) => {
        const healthValues = samples
          .flatMap((sample) => sample.targets)
          .filter((target) => target.id === targetId)
          .map((target) => target.health);
        return [
          targetId,
          healthValues.length > 0
            ? Math.max(...healthValues) - Math.min(...healthValues)
            : 0
        ];
      }
    )
  );
  const hasRuntimeEvidence = scenario.promoRole
    ? true
    : selectedSkill === "engineer_00"
      ? maximumTurrets > 0 && coreProjectileSamples.length > 0
      : matchingEffects.length > 0 ||
        matchingProjectiles.length > 0 ||
        actionSamples.length > 0;
  scenario.runtimeEvidence = {
    status: hasRuntimeEvidence ? "pass" : "fail",
    sampleCount: samples.length,
    matchingEffectSamples: matchingEffects.length,
    matchingProjectileSamples: matchingProjectiles.length,
    matchingActionSamples: actionSamples.length,
    maximumTurrets,
    coreProjectileSamples: coreProjectileSamples.length,
    targetDamage
  };
  scenario.checks.push({
    name: "runtime-skill-entity-and-action-evidence",
    status: hasRuntimeEvidence ? "pass" : "fail"
  });
  scenario.checks.push({
    name: "runtime-telemetry-covers-recovery",
    status: telemetryCoversRecovery ? "pass" : "fail",
    actionEndSec: end,
    requiredTelemetryEndSec: end + 0.12,
    telemetryEndSec: finalSample?.videoTimeSec ?? null
  });
  if (samples.length < 4) {
    fail(scenario, `動態遙測不足：技能時段僅 ${samples.length} 個樣本。`);
  }
  if (!telemetryCoversRecovery) {
    fail(
      scenario,
      `動態遙測未覆蓋 recovery：actionEnd=${end.toFixed(3)}s，telemetryEnd=${
        finalSample?.videoTimeSec?.toFixed(3) ?? "missing"
      }s。可能在錄影中途發生 Socket.IO 斷線或 server watch 重啟。`
    );
  }
  if (!hasRuntimeEvidence) {
    fail(
      scenario,
      `技能時段未出現 ${selectedSkill} 的 effect、projectile、角色 action 或砲台射擊證據。`
    );
  }
  if (scenario.promoCombat) {
    validatePromoCombatTelemetry(scenario, samples);
  }
  if (scenario.promoRole) {
    validatePromoRoleTelemetry(scenario, samples);
  }
  if (selectedSkill === "mage_10") {
    validateGravityWellPull(scenario, samples);
  }
  if (selectedSkill === "archer_04") {
    validateArcherInvisibility(scenario, samples);
  }
  if (selectedSkill === "warrior_03") {
    const stunnedSamples = samples.filter((sample) =>
      sample.targets.some((target) => target.id === scenario.runtime?.targetId && target.stunned)
    );
    scenario.checks.push({
      name: "warrior-third-enchanted-hit-stuns",
      status: stunnedSamples.length > 0 ? "pass" : "fail",
      stunnedSampleCount: stunnedSamples.length
    });
    if (stunnedSamples.length === 0) {
      fail(scenario, "斬鋒附魔第三次強化普攻沒有留下目標暈眩的實戰遙測證據。");
    }
  }
}

function validatePromoRoleTelemetry(scenario, samples) {
  const requiredSkillIds = scenario.promoRole.requiredSkillIds ?? [];
  const observedSkillIds = new Set();
  for (const sample of samples) {
    if (sample.self?.actionSkillId) observedSkillIds.add(sample.self.actionSkillId);
    for (const effect of sample.effects) {
      if (effect.skillId) observedSkillIds.add(effect.skillId);
    }
    for (const projectile of sample.projectiles) {
      if (projectile.skillId) observedSkillIds.add(projectile.skillId);
    }
  }
  const missingSkillIds = requiredSkillIds.filter(
    (skillId) => !observedSkillIds.has(skillId)
  );
  const basicAttackSamples = samples.filter(
    (sample) => sample.self?.action === "attack"
  ).length;
  const maximumTurrets = Math.max(
    0,
    ...samples.map((sample) => sample.turrets.length)
  );
  const minimumVisibleOpponents =
    scenario.promoRole.minimumVisibleOpponents ?? 3;
  const maximumVisibleOpponents = Math.max(
    0,
    ...samples.map((sample) => {
      const view = sample.camera?.worldView;
      if (!view) return 0;
      return sample.targets.filter(
        (target) =>
          target.alive &&
          target.x >= view.x &&
          target.x <= view.x + view.width &&
          target.y >= view.y &&
          target.y <= view.y + view.height
      ).length;
    })
  );
  const totalDamage = Object.values(
    scenario.runtimeEvidence?.targetDamage ?? {}
  ).reduce((sum, value) => sum + Number(value), 0);
  const passed =
    missingSkillIds.length === 0 &&
    (scenario.promoRole.requireBasicAttack !== true || basicAttackSamples > 0) &&
    (scenario.promoRole.requireTurret !== true || maximumTurrets > 0) &&
    (scenario.promoRole.requireDamage !== true || totalDamage > 0) &&
    maximumVisibleOpponents >= minimumVisibleOpponents;
  scenario.promoRoleEvidence = {
    requiredSkillIds,
    observedSkillIds: [...observedSkillIds].sort(),
    missingSkillIds,
    basicAttackSamples,
    maximumTurrets,
    totalDamage,
    maximumVisibleOpponents,
    minimumVisibleOpponents
  };
  scenario.runtimeEvidence.status = passed ? "pass" : "fail";
  scenario.checks.push({
    name: "promo-role-combat-and-multi-skill-evidence",
    status: passed ? "pass" : "fail",
    ...scenario.promoRoleEvidence
  });
  if (!passed) {
    fail(
      scenario,
      `宣傳片職業實戰契約未通過：${JSON.stringify(
        scenario.promoRoleEvidence
      )}`
    );
  }
}

function validatePromoCombatTelemetry(scenario, samples) {
  const minimumVisibleOpponents =
    scenario.promoCombat.minimumVisibleOpponents ?? 3;
  const visibleOpponentCounts = samples.map((sample) => {
    const view = sample.camera?.worldView;
    if (!view) return 0;
    return sample.targets.filter(
      (target) =>
        target.alive &&
        target.x >= view.x &&
        target.x <= view.x + view.width &&
        target.y >= view.y &&
        target.y <= view.y + view.height
    ).length;
  });
  const maximumVisibleOpponents = Math.max(0, ...visibleOpponentCounts);
  const totalDamage = Object.values(
    scenario.runtimeEvidence?.targetDamage ?? {}
  ).reduce((sum, value) => sum + Number(value), 0);
  const requiredStatus = scenario.promoCombat.requiredStatus ?? null;
  const statusSamples = requiredStatus
    ? samples.filter((sample) =>
        sample.targets.some((target) => target[requiredStatus] === true)
      ).length
    : 0;
  const damagePassed =
    scenario.promoCombat.requireDamage !== true || totalDamage > 0;
  const statusPassed = !requiredStatus || statusSamples > 0;
  const crowdPassed = maximumVisibleOpponents >= minimumVisibleOpponents;
  const passed = damagePassed && statusPassed && crowdPassed;
  scenario.promoCombatEvidence = {
    maximumVisibleOpponents,
    minimumVisibleOpponents,
    totalDamage,
    requiredStatus,
    statusSamples
  };
  scenario.checks.push({
    name: "promo-multiplayer-hit-and-framing",
    status: passed ? "pass" : "fail",
    ...scenario.promoCombatEvidence
  });
  if (!passed) {
    fail(
      scenario,
      `宣傳片多人實戰契約未通過：${JSON.stringify(
        scenario.promoCombatEvidence
      )}`
    );
  }
}

function validateArcherInvisibility(scenario, samples) {
  const activeSamples = samples.filter(
    (sample) =>
      sample.self?.concealmentEndsAt > sample.serverTime &&
      sample.renderViews.players.some(
        (view) =>
          view.playerId === sample.self.id &&
          view.concealmentOutline?.visible === true &&
          view.sprite?.alpha > 0.2 &&
          view.sprite?.alpha < 0.5
      )
  );
  const retiredProjectileSamples = samples.flatMap((sample) =>
    sample.projectiles.filter((projectile) => projectile.skillId === "archer_04")
  );
  const targetDamage = Object.values(
    scenario.runtimeEvidence?.targetDamage ?? {}
  ).reduce((sum, value) => sum + Number(value), 0);
  const finalSample = samples.at(-1);
  const recovered = Boolean(
    finalSample &&
      finalSample.self?.concealmentEndsAt <= finalSample.serverTime &&
      finalSample.renderViews.players.some(
        (view) =>
          view.playerId === finalSample.self.id &&
          view.concealmentOutline?.visible === false &&
          view.sprite?.alpha === 1
      )
  );
  const passed =
    activeSamples.length >= 8 &&
    retiredProjectileSamples.length === 0 &&
    targetDamage === 0 &&
    recovered;
  scenario.runtime.invisibilityEvidence = {
    activeSampleCount: activeSamples.length,
    retiredProjectileSampleCount: retiredProjectileSamples.length,
    targetDamage,
    recovered
  };
  scenario.checks.push({
    name: "archer-two-second-self-outline-no-vine-runtime",
    status: passed ? "pass" : "fail",
    ...scenario.runtime.invisibilityEvidence
  });
  if (!passed) {
    fail(
      scenario,
      `隱形實戰契約未通過：${JSON.stringify(
        scenario.runtime.invisibilityEvidence
      )}`
    );
  }
}

function validateGravityWellPull(scenario, samples) {
  const targetId = scenario.runtime?.targetId;
  const readings = samples.flatMap((sample) => {
    const effect = sample.effects.find((candidate) => candidate.skillId === "mage_10");
    const target = sample.targets.find((candidate) => candidate.id === targetId);
    if (!effect || !target) return [];
    return [{
      elapsedMs: sample.serverTime - effect.startedAt,
      activeElapsedMs:
        effect.activeStartedAt == null
          ? sample.serverTime - effect.startedAt
          : sample.serverTime - effect.activeStartedAt,
      duration: effect.duration,
      activeDuration: effect.activeDuration,
      distanceToCenter: Math.hypot(target.x - effect.x, target.y - effect.y),
      slowed: target.slowed
    }];
  });
  const initial = readings[0] ?? null;
  const closest = readings.reduce(
    (nearest, reading) =>
      !nearest || reading.distanceToCenter < nearest.distanceToCenter
        ? reading
        : nearest,
    null
  );
  const pullDistance =
    initial && closest ? initial.distanceToCenter - closest.distanceToCenter : 0;
  const activeDuration = readings[0]?.activeDuration ?? null;
  const hasSustainedField = readings.some((reading) => reading.activeElapsedMs >= 1850);
  const hasSlow = readings.some((reading) => reading.slowed);
  const passed =
    activeDuration === 2000 &&
    initial != null &&
    closest != null &&
    initial.distanceToCenter >= 110 &&
    pullDistance >= 90 &&
    hasSustainedField &&
    hasSlow;
  scenario.runtime.gravityWellPull = {
    activeDuration,
    initialDistanceToCenter: initial?.distanceToCenter ?? null,
    closestDistanceToCenter: closest?.distanceToCenter ?? null,
    pullDistance,
    hasSustainedField,
    hasSlow
  };
  scenario.checks.push({
    name: "mage-gravity-well-two-second-pull",
    status: passed ? "pass" : "fail",
    ...scenario.runtime.gravityWellPull
  });
  if (!passed) {
    fail(
      scenario,
      "重力井未在完整 2 秒作用期間把位於範圍邊緣的目標持續拉向井心。"
    );
  }
}

function fail(scenario, message) {
  if (!scenario.failures.includes(message)) scenario.failures.push(message);
  const reportMessage = `${scenario.label}: ${message}`;
  if (!report.failures.includes(reportMessage)) report.failures.push(reportMessage);
}

function removeScenarioFromFinalReport(scenario) {
  report.scenarios = report.scenarios.filter(
    (candidate) => candidate !== scenario
  );
  const prefix = `${scenario.label}: `;
  report.failures = report.failures.filter(
    (message) => !message.startsWith(prefix)
  );
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function loadReviewAssetOverride(inputPath) {
  const absolutePath = path.resolve(ROOT, inputPath);
  const bytes = readFileSync(absolutePath);
  return {
    path: absolutePath,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

function loadArcherActionBodyReviewOverride(skillId, inputPath) {
  if (!skillId?.startsWith("archer_")) {
    throw new Error(`Archer action-body review requires an archer skill id: ${skillId}`);
  }
  const manifestPath = path.join(
    ROOT,
    "apps/client/src/game/assets/arenaSkillRuntimeManifest.json"
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entry = manifest.entries.find((candidate) => candidate.skillId === skillId);
  if (!entry?.actionBody?.file) {
    throw new Error(`Missing packaged Archer action body for ${skillId}`);
  }
  return {
    ...loadReviewAssetOverride(inputPath),
    skillId,
    assetUrl: entry.actionBody.file
  };
}

function loadEngineerSiegeReviewOverride(impactPath, vfxPath) {
  const impact = loadReviewAssetOverride(impactPath);
  const absoluteVfxPath = path.resolve(ROOT, vfxPath);
  const vfxBytes = readFileSync(absoluteVfxPath);
  const vfx = JSON.parse(vfxBytes.toString("utf8"));
  if (vfx.skillId !== "engineer_06" || !vfx.runtime?.impactAsset) {
    throw new Error(
      `Invalid engineer_06 review VFX metadata: ${absoluteVfxPath}`
    );
  }
  if (
    vfx.runtime.visualContract?.radiusAspect !== 1 ||
    vfx.runtime.impactAsset.semanticAnchor?.[0] !== 256 ||
    vfx.runtime.impactAsset.semanticAnchor?.[1] !== 256 ||
    vfx.runtime.impactAsset.outputSha256 !== impact.sha256
  ) {
    throw new Error(
      `Engineer siege review candidate metadata does not match its circular impact asset: ${absoluteVfxPath}`
    );
  }
  const manifestPath = path.join(
    ROOT,
    "apps/client/src/game/assets/arenaSkillRuntimeManifest.json"
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const entryIndex = manifest.entries.findIndex(
    (entry) => entry.skillId === "engineer_06"
  );
  if (entryIndex < 0) {
    throw new Error("Canonical runtime manifest is missing engineer_06.");
  }
  manifest.entries[entryIndex] = vfx.runtime;
  const manifestModuleBytes = Buffer.from(
    `export default ${JSON.stringify(manifest)};\n`,
    "utf8"
  );
  return {
    ...impact,
    vfxPath: absoluteVfxPath,
    vfxSha256: createHash("sha256").update(vfxBytes).digest("hex"),
    manifestModuleBytes,
    manifestModuleSha256: createHash("sha256")
      .update(manifestModuleBytes)
      .digest("hex"),
    acceptedAnimationId: vfx.runtime.impactAsset.acceptedAnimationId,
    semanticAnchor: vfx.runtime.impactAsset.semanticAnchor,
    radiusAspect: vfx.runtime.visualContract.radiusAspect
  };
}

function shouldRecord(id) {
  return ONLY.length === 0 || ONLY.includes(id);
}

await main();
