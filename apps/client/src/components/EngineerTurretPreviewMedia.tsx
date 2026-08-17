import type { EngineerTurretKind } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { staticAssetUrl } from "../game/assets/staticAssets";

const CORE_ASSET_ROOT =
  "/assets/arena-skills/engineer_工程師/0_F_核心/00_部署砲台_engineer_00/runtime";

const TURRET_PREVIEW = {
  mechanical: {
    deployFile: "deploy-mechanical.png",
    sourceWidth: 672,
    sourceHeight: 36,
    frameWidth: 48,
    frameHeight: 36,
    scale: 4,
    label: "普通砲台 · 部署預覽"
  },
  magic_missile: {
    deployFile: "deploy-magic.png",
    sourceWidth: 1568,
    sourceHeight: 96,
    frameWidth: 112,
    frameHeight: 96,
    scale: 1.5,
    label: "魔導砲台 · 部署預覽"
  }
} as const;

export function EngineerTurretPreviewMedia({
  kind
}: {
  kind: EngineerTurretKind;
}) {
  const preview = TURRET_PREVIEW[kind];
  const style = {
    "--turret-deploy-image": `url("${staticAssetUrl(`${CORE_ASSET_ROOT}/${preview.deployFile}`)}")`,
    "--turret-sheet-width": `${preview.sourceWidth * preview.scale}px`,
    "--turret-sheet-height": `${preview.sourceHeight * preview.scale}px`,
    "--turret-frame-width": `${preview.frameWidth * preview.scale}px`,
    "--turret-frame-height": `${preview.frameHeight * preview.scale}px`,
    "--turret-frame-left": `${-(preview.frameWidth * preview.scale) / 2}px`,
    "--turret-frame-top": `${-(preview.frameHeight * preview.scale) / 2}px`,
    "--turret-sheet-end": `${-preview.frameWidth * preview.scale * 13}px`,
    "--mechanical-atlas": `url("${staticAssetUrl(`${CORE_ASSET_ROOT}/mechanical-turret-atlas.png`)}")`
  } as CSSProperties;

  return (
    <div
      className={`engineer-turret-preview-media is-${kind}`}
      style={style}
      role="img"
      aria-label={preview.label}
    >
      <span className="engineer-turret-preview-grid" aria-hidden="true" />
      <span className="engineer-turret-preview-range" aria-hidden="true" />
      <span className="engineer-turret-preview-spawn" aria-hidden="true">
        <span className="engineer-turret-preview-deploy" />
        {kind === "mechanical" ? (
          <span className="engineer-turret-preview-machine">
            <span className="is-base" />
            <span className="is-head" />
          </span>
        ) : (
          <img
            className="engineer-turret-preview-magic"
            src={staticAssetUrl(`${CORE_ASSET_ROOT}/magic-turret.png`)}
            alt=""
          />
        )}
        <span className="engineer-turret-preview-shot" />
      </span>
      <span className="engineer-turret-preview-caption">
        <b>F</b>
        {kind === "mechanical" ? "部署普通砲台" : "部署魔導砲台"}
      </span>
    </div>
  );
}
