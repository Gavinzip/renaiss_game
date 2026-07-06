import { RPG_ELEMENT_META, RPG_STARTER_PETS } from "@renaiss-game/shared";
import type { CSSProperties } from "react";
import { RpgPetSprite } from "./RpgPetSprite";
import { generatedAssetPath } from "../game/assets/generatedAssets";
import { RPG_PET_ANIMATION_FRAMES, type RpgPetSpritePose } from "../game/assets/rpgPetSprites";

const PREVIEW_POSES: RpgPetSpritePose[] = ["idle", "walk", "attack", "hit", "faint"];
const FRAME_RACK_POSES: RpgPetSpritePose[] = ["idle", "walk", "attack", "hit", "faint"];

export function RpgAnimationPreview() {
  return (
    <main className="rpg-animation-preview" style={{ "--rpg-arena-url": `url("${generatedAssetPath("rpg-battle-arena")}")` } as CSSProperties}>
      <header>
        <div>
          <strong>RPG 寵物逐幀動畫驗收</strong>
          <span>同一張 spritesheet，五屬性 x 五種動作</span>
        </div>
        <nav>
          <a href="/?preview=release">上架總覽</a>
          <a href="/">回村莊</a>
        </nav>
      </header>
      <section className="rpg-preview-grid">
        {RPG_STARTER_PETS.map((pet) => {
          const meta = RPG_ELEMENT_META[pet.element];
          return (
            <article key={pet.id} style={{ "--element": meta.color, "--element-soft": meta.accent } as CSSProperties}>
              <header>
                <span>{meta.label}</span>
                <strong>{pet.name}</strong>
              </header>
              <div className="rpg-preview-body">
                <div className="rpg-preview-poses">
                  {PREVIEW_POSES.map((pose) => (
                    <div key={pose}>
                      <RpgPetSprite element={pet.element} pose={pose} />
                      <em>{pose}</em>
                    </div>
                  ))}
                </div>
                <div className="rpg-preview-frame-rack" aria-label={`${pet.name} all animation frames`}>
                  {FRAME_RACK_POSES.map((pose) => (
                    <section key={pose}>
                      <strong>{pose}</strong>
                      <div>
                        {RPG_PET_ANIMATION_FRAMES[pose].map((column, frameIndex) => (
                          <span key={`${pose}-${column}`} className="rpg-preview-frame-cell">
                            <RpgPetSprite element={pet.element} pose={pose} frame={frameIndex} animate={false} />
                            <em>{String(column + 1).padStart(2, "0")}</em>
                          </span>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
