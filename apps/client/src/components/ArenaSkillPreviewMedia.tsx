import type { ArenaCatalogSkillId } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { arenaSkillPreviewMedia } from "../game/assets/generatedAssets";

export function ArenaSkillPreviewMedia({
  skillId,
  label
}: {
  skillId: ArenaCatalogSkillId;
  label: string;
}) {
  const preview = arenaSkillPreviewMedia(skillId);
  if (preview.mediaType === "image/webp") {
    return (
      <div className="arena-skill-preview-media" style={{ aspectRatio: "16 / 9" }}>
        <img
          key={`${skillId}:${preview.sha256}`}
          src={preview.url}
          aria-label={label}
          draggable={false}
        />
      </div>
    );
  }

  const sourceSize = preview.sourceSize;
  const crop = preview.crop;
  if (
    preview.mediaType !== "video/webm" ||
    !sourceSize ||
    !crop ||
    sourceSize.length !== 2 ||
    crop.length !== 4
  ) {
    throw new Error(`Arena video preview contract is incomplete for ${skillId}`);
  }

  const [sourceWidth, sourceHeight] = sourceSize;
  const [cropX, cropY, cropWidth, cropHeight] = crop;
  const viewportStyle = {
    "--arena-preview-ratio": cropWidth / cropHeight,
    aspectRatio: `${cropWidth} / ${cropHeight}`
  } as CSSProperties;
  const videoStyle: CSSProperties = {
    width: `${(sourceWidth / cropWidth) * 100}%`,
    height: `${(sourceHeight / cropHeight) * 100}%`,
    left: `${-(cropX / cropWidth) * 100}%`,
    top: `${-(cropY / cropHeight) * 100}%`
  };

  return (
    <div className="arena-skill-preview-media" style={viewportStyle}>
      <video
        key={`${skillId}:${preview.sha256}`}
        src={preview.url}
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
