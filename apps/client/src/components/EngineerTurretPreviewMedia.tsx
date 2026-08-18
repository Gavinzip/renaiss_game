import type { EngineerTurretKind } from "@renaiss-game/shared";
import { staticAssetUrl } from "../game/assets/staticAssets";
import { getEngineerTurretPackagePreview } from "../game/assets/arenaSkillPackageCatalog";

export function EngineerTurretPreviewMedia({
  kind
}: {
  kind: EngineerTurretKind;
}) {
  const preview = getEngineerTurretPackagePreview(kind);
  if (!preview) {
    throw new Error(`Engineer ${kind} gameplay preview is missing`);
  }
  const sourceSize = preview.sourceSize;
  const crop = preview.crop;
  if (
    !sourceSize ||
    !crop ||
    sourceSize.length !== 2 ||
    crop.length !== 4
  ) {
    throw new Error(`Engineer ${kind} gameplay preview geometry is incomplete`);
  }

  const [sourceWidth, sourceHeight] = sourceSize;
  const [cropX, cropY, cropWidth, cropHeight] = crop;
  const videoStyle = {
    width: `${(sourceWidth / cropWidth) * 100}%`,
    height: `${(sourceHeight / cropHeight) * 100}%`,
    left: `${-(cropX / cropWidth) * 100}%`,
    top: `${-(cropY / cropHeight) * 100}%`
  };
  const label =
    kind === "mechanical"
      ? "普通砲台 · 實戰部署預覽"
      : "魔導砲台 · 實戰部署預覽";

  return (
    <div
      className="arena-skill-preview-media"
      style={{ aspectRatio: `${cropWidth} / ${cropHeight}` }}
      data-preview-source={preview.sourceScenario}
    >
      <video
        key={`${kind}:${preview.sha256}`}
        src={`${staticAssetUrl(preview.file)}?v=${preview.sha256.slice(0, 12)}`}
        style={videoStyle}
        aria-label={label}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
      />
    </div>
  );
}
