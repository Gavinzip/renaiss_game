import { createStarterRoster, type RpgRosterPet } from "./rpgBattle";
import { RPG_AI_DIFFICULTIES, type RpgAiDifficulty } from "./rpgTypes";

export interface RpgAiDifficultyConfig {
  id: RpgAiDifficulty;
  label: string;
  title: string;
  description: string;
  rosterOrder: readonly string[];
  moveLoadouts: Record<string, readonly string[]>;
}

export const RPG_AI_DIFFICULTY_CONFIGS: Record<RpgAiDifficulty, RpgAiDifficultyConfig> = {
  normal: {
    id: "normal",
    label: "普通",
    title: "見習道館",
    description: "基本招式組，適合確認隊伍站位與屬性克制。",
    rosterOrder: ["pet_fire_emberfox", "pet_grass_mossling", "pet_dark_nyxcat"],
    moveLoadouts: {
      pet_fire_emberfox: ["fire_basic_01", "fire_basic_02", "fire_basic_03", "fire_basic_07"],
      pet_grass_mossling: ["grass_basic_01", "grass_basic_04", "grass_basic_05", "grass_basic_07"],
      pet_dark_nyxcat: ["dark_basic_01", "dark_basic_02", "dark_basic_06", "dark_basic_07"]
    }
  },
  hard: {
    id: "hard",
    label: "困難",
    title: "精英道館",
    description: "中階群攻與控制招式更多，會更積極壓低血線。",
    rosterOrder: ["pet_grass_mossling", "pet_dark_nyxcat", "pet_light_lumibun"],
    moveLoadouts: {
      pet_grass_mossling: ["grass_basic_01", "grass_intermediate_01", "grass_intermediate_02", "grass_intermediate_03"],
      pet_dark_nyxcat: ["dark_basic_01", "dark_intermediate_01", "dark_intermediate_02", "dark_intermediate_06"],
      pet_light_lumibun: ["light_basic_01", "light_intermediate_01", "light_intermediate_02", "light_intermediate_04"]
    }
  },
  leader: {
    id: "leader",
    label: "館主",
    title: "五屬館主",
    description: "高階招式與全隊支援都會出現，是目前 AI 道館最高挑戰。",
    rosterOrder: ["pet_dark_nyxcat", "pet_light_lumibun", "pet_water_tidefin"],
    moveLoadouts: {
      pet_dark_nyxcat: ["dark_basic_01", "dark_intermediate_02", "dark_ultimate_01", "dark_ultimate_04"],
      pet_light_lumibun: ["light_basic_01", "light_intermediate_04", "light_ultimate_03", "light_ultimate_05"],
      pet_water_tidefin: ["water_basic_01", "water_intermediate_04", "water_ultimate_03", "water_ultimate_05"]
    }
  }
};

export function getRpgAiDifficultyConfig(difficulty: RpgAiDifficulty) {
  return RPG_AI_DIFFICULTY_CONFIGS[difficulty];
}

export function createRpgAiRoster(ownerId: string, difficulty: RpgAiDifficulty): RpgRosterPet[] {
  const config = getRpgAiDifficultyConfig(difficulty);
  const baseRoster = createStarterRoster(ownerId);
  return config.rosterOrder.flatMap((definitionId) => {
    const pet = baseRoster.find((candidate) => candidate.definitionId === definitionId);
    return pet ? [{ ...pet, moveIds: config.moveLoadouts[definitionId] ?? pet.moveIds }] : [];
  });
}

export function isRpgAiDifficulty(value: string): value is RpgAiDifficulty {
  return (RPG_AI_DIFFICULTIES as readonly string[]).includes(value);
}
