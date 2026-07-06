#!/usr/bin/env python3
from __future__ import annotations

import os
import json
import math
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "apps" / "client" / "public" / "assets" / "generated"
EFFECT_ZIP = Path(os.environ.get("RPG_EFFECT_FX_ZIP", str(Path.home() / "Downloads" / "Effect and FX Pixel All Free.zip")))
FIRE_BULLET_RAR = Path(os.environ.get("RPG_FIRE_BULLET_RAR", str(Path.home() / "Downloads" / "New_All_Fire_Bullet_Pixel_16x16.rar")))
SPELLS_FX_ZIP = Path(os.environ.get("RPG_SPELLS_FX_ZIP", str(Path.home() / "Downloads" / "SpellsFX2.0.zip")))
GIGAPACK_ZIP = Path(os.environ.get(
    "RPG_SUPER_PIXEL_GIGAPACK_ZIP",
    str(Path.home() / "Desktop" / "game_pixel" / "world" / "Super Pixel Effects Gigapack (Free Version) v2.5.0.zip"),
))
MANIFEST_PATH = OUT_DIR / "rpg-external-vfx-manifest.json"
ASSET_VERSION = "2026-07-04-rpg-status-five-core-v1"
LICENSE_PENDING_STATUS = "pending-commercial-proof"
LICENSE_CONFIRMED_STATUS = "commercial-proof-confirmed"
LICENSE_PROOF_KEYS = ("source", "reference", "checkedAt")

RPG_ELEMENTS = ("water", "fire", "grass", "dark", "light")
RPG_STATUSES = ("burn", "poison", "stun", "guard", "regen")
RPG_SKILL_STYLES = (
    "strike", "projectile", "projectile", "aura", "aura",
    "burst", "wave", "beam", "field", "strike",
    "strike", "rain", "burst", "field", "aura",
    "beam", "field", "aura", "strike", "field",
    "beam", "rain", "field", "burst", "summon",
)
STYLE_INDEX = {style: index for index, style in enumerate(dict.fromkeys(RPG_SKILL_STYLES))}
GIGAPACK_SEQUENCE_ROWS = (5, 6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24)
SPELL_SEQUENCE_OVERRIDES = {
    # Keep basic/intermediate rows away from the high-tier signature sequences.
    ("water", 6): "Spritesheet/Ice Lance.png",
    ("water", 10): "Spritesheet/Ice Spykes.png",
    ("grass", 9): "Spritesheet/Neon Slash.png",
    ("grass", 17): "Spritesheet/Green Thunder.png",
    ("grass", 18): "Spritesheet/Leaf Flow.png",
    ("dark", 8): "Spritesheet/Magic Vortex.png",
    ("dark", 11): "Spritesheet/Black Hole.png",
    ("dark", 13): "Spritesheet/Magic Vortex.png",
    ("dark", 17): "Spritesheet/Magic Vortex.png",
    ("light", 0): "Spritesheet/Neon Slash.png",
    # Ultimate rows use full named sequences instead of repeated small impact bursts.
    ("water", 20): "Spritesheet/Water Dragon.png",
    ("water", 21): "Spritesheet/Storm Current.png",
    ("water", 22): "Spritesheet/Blue Orb.png",
    ("water", 23): "Spritesheet/Blue Flame.png",
    ("water", 24): "Spritesheet/Wave.png",
    ("fire", 20): "Spritesheet/Fire Burst.png",
    ("fire", 21): "Spritesheet/Fire Ball.png",
    ("fire", 23): "Spritesheet/Power Burst.png",
    ("grass", 20): "Spritesheet/Venom Pilar.png",
    ("grass", 21): "Spritesheet/Poison Smoke.png",
    ("grass", 22): "Spritesheet/Protection Field.png",
    ("grass", 24): "Spritesheet/Toxic Wave.png",
    ("dark", 20): "Spritesheet/Arcane Rift.png",
    ("dark", 23): "Spritesheet/Laser.png",
    ("light", 20): "Spritesheet/Solar Spear.png",
    ("light", 21): "Spritesheet/Celestial Beam.png",
    ("light", 22): "Spritesheet/Energy Pillar.png",
    ("light", 23): "Spritesheet/Thunder Strike 2.png",
    ("light", 24): "Spritesheet/Spiral Spark.png",
}
SPELL_SOURCE_OVERRIDES = {
    ("water", 4): "Spritesheet/Energy Current.png",
    ("water", 9): "Spritesheet/Ion Strike.png",
    ("water", 18): "Spritesheet/Ion Strike.png",
    ("fire", 3): "Spritesheet/Fire Burst.png",
    ("fire", 1): "Spritesheet/Soul Ember.png",
    ("fire", 4): "Spritesheet/Rising Energy.png",
    ("fire", 9): "Spritesheet/Fire Hit.png",
    ("fire", 18): "Spritesheet/Infernal Strike.png",
    ("dark", 10): "Spritesheet/Phantom Wave.png",
    ("grass", 4): "Spritesheet/Leaf Flow.png",
    ("light", 4): "Spritesheet/Star Flow.png",
    ("light", 18): "Spritesheet/Celestial Impact.png",
}
GIGAPACK_SOURCE_OVERRIDES = {
    ("water", 6): "Impacts/directional_impact_001/directional_impact_001_small_blue",
    ("water", 12): "Sci-fi/scifi_warp_003/scifi_warp_003_small_blue",
    ("water", 16): "Fantasy Spells/spell_defense_up_001/spell_defense_up_001_small_blue",
    ("water", 20): "Magic Bursts/round_sparkle_burst_001/round_sparkle_burst_001_small_blue",
    ("water", 24): "Impacts/symmetrical_impact_002/symmetrical_impact_002_small_blue",
    ("fire", 5): "Explosions/symmetrical_explosion_004/symmetrical_explosion_004_small_orange",
    ("fire", 6): "Impacts/directional_impact_004/directional_impact_004_small_yellow",
    ("fire", 7): "Magic Bursts/round_sparkle_burst_003/round_sparkle_burst_003_small_red",
    ("fire", 12): "Explosions/symmetrical_explosion_004/symmetrical_explosion_004_small_orange",
    ("fire", 16): "Fantasy Spells/spell_attack_up_001/spell_attack_up_001_small_red",
    ("fire", 20): "Magic Bursts/round_sparkle_burst_003/round_sparkle_burst_003_small_red",
    ("fire", 22): "Explosions/stylized_explosion_003/stylized_explosion_003_large_yellow",
    ("fire", 24): "Explosions/epic_explosion_002/epic_explosion_002_large_yellow",
    ("grass", 6): "Magic Bursts/directional_bubble_burst_001/directional_bubble_burst_001_small_green",
    ("grass", 12): "Splatters/burst_splatter_003/burst_splatter_003_small_green",
    ("grass", 16): "Fantasy Spells/spell_haste_001/spell_haste_001_small_green",
    ("grass", 20): "Fantasy Spells/spell_poison_001/spell_poison_001_small_green",
    ("grass", 23): "Fantasy Spells/spell_poison_001/spell_poison_001_large_green",
    ("grass", 24): "Magic Bursts/round_sparkle_burst_002/round_sparkle_burst_002_small_green",
    ("dark", 6): "Impacts/directional_impact_003/directional_impact_003_small_violet",
    ("dark", 12): "Explosions/stylized_explosion_002/stylized_explosion_002_small_violet",
    ("dark", 16): "Fantasy Spells/spell_absorb_001/spell_absorb_001_small_violet",
    ("dark", 21): "Smoke Bursts/stylized_skull_smoke_burst_001/stylized_skull_smoke_burst_001_large_white",
    ("dark", 22): "Fantasy Spells/spell_absorb_001/spell_absorb_001_large_violet",
    ("dark", 24): "Explosions/stylized_explosion_002/stylized_explosion_002_large_violet",
    ("light", 6): "Impacts/directional_impact_002/directional_impact_002_small_white",
    ("light", 12): "Impacts/symmetrical_impact_006/symmetrical_impact_006_small_yellow",
    ("light", 16): "Fantasy Spells/spell_defense_up_001/spell_defense_up_001_small_blue",
}
STATUS_SOURCE_OVERRIDES = {
    "poison": "Fantasy Spells/status_poison_001/status_poison_001_small_green",
    "guard": "Fantasy Spells/spell_defense_up_001/spell_defense_up_001_small_blue",
}

STATUS_SPELL_SOURCE_OVERRIDES = {
    "burn": "Spritesheet/Flameburst.png",
    "stun": "Spritesheet/Thunder Charge.png",
    "regen": "Spritesheet/Poison Spores.png",
}

SKILL_COLUMNS = 16
SKILL_ROWS = 25
SKILL_FRAME_W = 160
SKILL_FRAME_H = 112
SOURCE_FX_FRAME = 64
SPELL_SOURCE_FRAME = 64
STATUS_COLUMNS = 12
STATUS_ROWS = 5
STATUS_FRAME_W = 96
STATUS_FRAME_H = 96

PROJECTILE_COLUMNS = 10
PROJECTILE_ROWS = 5
PROJECTILE_FRAME_W = 96
PROJECTILE_FRAME_H = 56
SOURCE_PROJECTILE_FRAME = 16

ELEMENT_COLOR_ROW = {
    "fire": 0,
    "water": 2,
    "grass": 3,
    "dark": 1,
    "light": 5,
}

ELEMENT_PROJECTILE_FILE = {
    "fire": "All_Fire_Bullet_Pixel_16x16_00.png",
    "water": "All_Fire_Bullet_Pixel_16x16_02.png",
    "grass": "All_Fire_Bullet_Pixel_16x16_03.png",
    "dark": "All_Fire_Bullet_Pixel_16x16_05.png",
    "light": "All_Fire_Bullet_Pixel_16x16_04.png",
}

SPELL_STYLE_SOURCES = {
    "fire": {
        "strike": ("Spritesheet/Neon Slash.png", "Spritesheet/Fire Hit.png", "Spritesheet/Infernal Strike.png"),
        "projectile": ("Spritesheet/Fire Ball.png", "Spritesheet/Soul Ember.png", "Spritesheet/Spark.png"),
        "beam": ("Spritesheet/Infernal Strike.png", "Spritesheet/Fire Hit.png", "Spritesheet/Fire Burst.png"),
        "burst": ("Spritesheet/Fire Burst.png", "Spritesheet/Flameburst.png", "Spritesheet/Infernal Strike.png", "Spritesheet/Power Burst.png"),
        "rain": ("Spritesheet/Fire Ball.png", "Spritesheet/Spark.png", "Spritesheet/Flameburst.png"),
        "aura": ("Spritesheet/Flameburst.png", "Spritesheet/Fire Burst.png", "Spritesheet/Rising Energy.png"),
        "wave": ("Spritesheet/Flameburst.png", "Spritesheet/Fire Burst.png", "Spritesheet/Infernal Strike.png"),
        "field": ("Spritesheet/Flameburst.png", "Spritesheet/Fire Burst.png", "Spritesheet/Rising Energy.png"),
        "summon": ("Spritesheet/Infernal Strike.png", "Spritesheet/Fire Hit.png", "Spritesheet/Flameburst.png"),
    },
    "water": {
        "strike": ("Spritesheet/Ice Spykes.png", "Spritesheet/Ion Strike.png", "Spritesheet/Wave.png"),
        "projectile": ("Spritesheet/Water Ball.png", "Spritesheet/Blue Orb.png", "Spritesheet/Ice Lance.png"),
        "beam": ("Spritesheet/Water Dragon.png", "Spritesheet/Wave.png", "Spritesheet/Ice Lance.png"),
        "burst": ("Spritesheet/Water Ball.png", "Spritesheet/Nova Pulse.png", "Spritesheet/Glacial Core.png", "Spritesheet/Blue Flame.png"),
        "rain": ("Spritesheet/Ice Lance.png", "Spritesheet/Wave.png", "Spritesheet/Ice Spykes.png", "Spritesheet/Storm Current.png"),
        "aura": ("Spritesheet/Glacial Core.png", "Spritesheet/Energy Current.png", "Spritesheet/Protection Field.png"),
        "wave": ("Spritesheet/Wave.png", "Spritesheet/Water Dragon.png", "Spritesheet/Storm Current.png", "Spritesheet/Ice Lance.png"),
        "field": ("Spritesheet/Protection Field.png", "Spritesheet/Energy Current.png", "Spritesheet/Glacial Core.png", "Spritesheet/Blue Orb.png"),
        "summon": ("Spritesheet/Water Dragon.png", "Spritesheet/Glacial Core.png", "Spritesheet/Storm Current.png", "Spritesheet/Wave.png"),
    },
    "grass": {
        "strike": ("Spritesheet/Leaf Flow.png", "Spritesheet/Green Thunder.png", "Spritesheet/Quake Surge.png", "Spritesheet/Neon Slash.png"),
        "projectile": ("Spritesheet/Green Energy Ball.png", "Spritesheet/Toxic Orb.png", "Spritesheet/Poison Spores.png"),
        "beam": ("Spritesheet/Green Thunder.png", "Spritesheet/Venom Pilar.png", "Spritesheet/Leaf Flow.png"),
        "burst": ("Spritesheet/Poison Spores.png", "Spritesheet/Power Burst.png", "Spritesheet/Green Energy Ball.png", "Spritesheet/Quake Surge.png"),
        "rain": ("Spritesheet/Poison Spores.png", "Spritesheet/Leaf Flow.png", "Spritesheet/Green Thunder.png", "Spritesheet/Poison Smoke.png"),
        "aura": ("Spritesheet/Leaf Flow.png", "Spritesheet/Green Thunder.png", "Spritesheet/Protection Field.png", "Spritesheet/Poison Spores.png"),
        "wave": ("Spritesheet/Toxic Wave.png", "Spritesheet/Leaf Flow.png", "Spritesheet/Poison Smoke.png"),
        "field": ("Spritesheet/Protection Field.png", "Spritesheet/Poison Spores.png", "Spritesheet/Spell Mist.png"),
        "summon": ("Spritesheet/Leaf Flow.png", "Spritesheet/Green Energy Ball.png", "Spritesheet/Poison Spores.png", "Spritesheet/Toxic Wave.png"),
    },
    "dark": {
        "strike": ("Spritesheet/Phantom Arc.png", "Spritesheet/Phantom Wave.png", "Spritesheet/Neon Slash.png"),
        "projectile": ("Spritesheet/Dark Orb.png", "Spritesheet/Arcane Orb.png", "Spritesheet/Toxic Orb.png"),
        "beam": ("Spritesheet/Arcane Rift.png", "Spritesheet/Laser.png", "Spritesheet/Phantom Wave.png"),
        "burst": ("Spritesheet/Black Hole.png", "Spritesheet/Power Burst.png", "Spritesheet/Soul Ember.png", "Spritesheet/Laser.png"),
        "rain": ("Spritesheet/Dark Orb.png", "Spritesheet/Black Hole.png", "Spritesheet/Phantom Wave.png"),
        "aura": ("Spritesheet/Black Hole.png", "Spritesheet/Magic Vortex.png", "Spritesheet/Spell Mist.png"),
        "wave": ("Spritesheet/Phantom Wave.png", "Spritesheet/Toxic Wave.png", "Spritesheet/Arcane Rift.png"),
        "field": ("Spritesheet/Spell Mist.png", "Spritesheet/Magic Vortex.png", "Spritesheet/Black Hole.png"),
        "summon": ("Spritesheet/Black Hole.png", "Spritesheet/Phantom Arc.png", "Spritesheet/Magic Vortex.png"),
    },
    "light": {
        "strike": ("Spritesheet/Solar Spear.png", "Spritesheet/Judgment Ray.png", "Spritesheet/Celestial Impact.png", "Spritesheet/Neon Slash.png"),
        "projectile": ("Spritesheet/Arcane Orb.png", "Spritesheet/Solar Spear.png", "Spritesheet/Spark.png"),
        "beam": ("Spritesheet/Celestial Beam.png", "Spritesheet/Judgment Ray.png", "Spritesheet/Solar Spear.png"),
        "rain": ("Spritesheet/Star Flow.png", "Spritesheet/Spark.png", "Spritesheet/Celestial Beam.png"),
        "aura": ("Spritesheet/Divine Sigil.png", "Spritesheet/Star Flow.png", "Spritesheet/Protection Field.png"),
        "wave": ("Spritesheet/Star Flow.png", "Spritesheet/Energy Current.png", "Spritesheet/Phantom Wave.png"),
        "field": ("Spritesheet/Divine Sigil.png", "Spritesheet/Protection Field.png", "Spritesheet/Star Flow.png", "Spritesheet/Energy Pillar.png"),
        "burst": ("Spritesheet/Celestial Impact.png", "Spritesheet/Nova Pulse.png", "Spritesheet/Power Burst.png", "Spritesheet/Thunder Strike 2.png"),
        "summon": ("Spritesheet/Divine Sigil.png", "Spritesheet/Celestial Impact.png", "Spritesheet/Rising Energy.png", "Spritesheet/Spiral Spark.png"),
    },
}

GIGAPACK_ARCHIVE_ROOT = "Super Pixel Effects Gigapack (Free Version)/PNG"
GIGAPACK_STYLE_SOURCES = {
    "water": {
        "wave": (
            "Impacts/directional_impact_001/directional_impact_001_small_blue",
            "Magic Bursts/round_sparkle_burst_001/round_sparkle_burst_001_small_blue",
            "Sci-fi/scifi_warp_003/scifi_warp_003_small_blue",
        ),
        "aura": (
            "Fantasy Spells/spell_defense_up_001/spell_defense_up_001_small_blue",
            "Magic Bursts/round_sparkle_burst_001/round_sparkle_burst_001_small_blue",
            "Impacts/symmetrical_impact_002/symmetrical_impact_002_small_blue",
        ),
        "beam": (
            "Impacts/directional_impact_001/directional_impact_001_small_blue",
            "Magic Bursts/round_sparkle_burst_001/round_sparkle_burst_001_small_blue",
            "Sci-fi/scifi_warp_003/scifi_warp_003_small_blue",
        ),
        "rain": (
            "Impacts/symmetrical_impact_002/symmetrical_impact_002_small_blue",
            "Magic Bursts/round_sparkle_burst_001/round_sparkle_burst_001_small_blue",
            "Sci-fi/scifi_warp_003/scifi_warp_003_small_blue",
        ),
        "field": (
            "Fantasy Spells/spell_defense_up_001/spell_defense_up_001_small_blue",
            "Magic Bursts/round_sparkle_burst_001/round_sparkle_burst_001_small_blue",
            "Impacts/symmetrical_impact_002/symmetrical_impact_002_small_blue",
        ),
        "burst": (
            "Impacts/symmetrical_impact_002/symmetrical_impact_002_small_blue",
            "Sci-fi/scifi_warp_003/scifi_warp_003_small_blue",
            "Impacts/directional_impact_001/directional_impact_001_small_blue",
        ),
        "summon": (
            "Impacts/symmetrical_impact_002/symmetrical_impact_002_small_blue",
            "Magic Bursts/round_sparkle_burst_001/round_sparkle_burst_001_small_blue",
            "Sci-fi/scifi_warp_003/scifi_warp_003_small_blue",
        ),
    },
    "fire": {
        "wave": (
            "Impacts/directional_impact_004/directional_impact_004_small_yellow",
            "Explosions/symmetrical_explosion_004/symmetrical_explosion_004_small_orange",
            "Magic Bursts/round_sparkle_burst_003/round_sparkle_burst_003_small_red",
        ),
        "aura": (
            "Fantasy Spells/spell_attack_up_001/spell_attack_up_001_small_red",
            "Magic Bursts/round_sparkle_burst_003/round_sparkle_burst_003_small_red",
            "Impacts/symmetrical_impact_004/symmetrical_impact_004_small_yellow",
        ),
        "beam": (
            "Impacts/directional_impact_004/directional_impact_004_small_yellow",
            "Explosions/symmetrical_explosion_004/symmetrical_explosion_004_small_orange",
            "Magic Bursts/round_sparkle_burst_003/round_sparkle_burst_003_small_red",
        ),
        "rain": (
            "Explosions/stylized_explosion_001/stylized_explosion_001_small_yellow",
            "Explosions/symmetrical_explosion_004/symmetrical_explosion_004_small_orange",
            "Magic Bursts/round_sparkle_burst_003/round_sparkle_burst_003_small_red",
        ),
        "field": (
            "Fantasy Spells/spell_attack_up_001/spell_attack_up_001_small_red",
            "Magic Bursts/round_sparkle_burst_003/round_sparkle_burst_003_small_red",
            "Impacts/symmetrical_impact_004/symmetrical_impact_004_small_yellow",
            "Explosions/stylized_explosion_003/stylized_explosion_003_large_yellow",
        ),
        "burst": (
            "Explosions/symmetrical_explosion_004/symmetrical_explosion_004_small_orange",
            "Impacts/symmetrical_impact_006/symmetrical_impact_006_small_yellow",
            "Impacts/directional_impact_004/directional_impact_004_small_yellow",
        ),
        "summon": (
            "Explosions/epic_explosion_001/epic_explosion_001_large_orange",
            "Explosions/epic_explosion_002/epic_explosion_002_large_yellow",
            "Impacts/directional_impact_004/directional_impact_004_small_yellow",
            "Impacts/symmetrical_impact_006/symmetrical_impact_006_small_yellow",
        ),
    },
    "grass": {
        "wave": (
            "Magic Bursts/directional_bubble_burst_001/directional_bubble_burst_001_small_green",
            "Splatters/burst_splatter_003/burst_splatter_003_small_green",
            "Magic Bursts/round_sparkle_burst_002/round_sparkle_burst_002_small_green",
        ),
        "aura": (
            "Fantasy Spells/spell_haste_001/spell_haste_001_small_green",
            "Magic Bursts/round_sparkle_burst_002/round_sparkle_burst_002_small_green",
            "Magic Bursts/directional_bubble_burst_001/directional_bubble_burst_001_small_green",
        ),
        "beam": (
            "Magic Bursts/directional_bubble_burst_001/directional_bubble_burst_001_small_green",
            "Fantasy Spells/spell_poison_001/spell_poison_001_small_green",
            "Magic Bursts/round_sparkle_burst_002/round_sparkle_burst_002_small_green",
        ),
        "rain": (
            "Fantasy Spells/spell_poison_001/spell_poison_001_small_green",
            "Splatters/burst_splatter_003/burst_splatter_003_small_green",
            "Magic Bursts/round_sparkle_burst_002/round_sparkle_burst_002_small_green",
        ),
        "field": (
            "Fantasy Spells/spell_haste_001/spell_haste_001_small_green",
            "Magic Bursts/round_sparkle_burst_002/round_sparkle_burst_002_small_green",
            "Fantasy Spells/status_poison_001/status_poison_001_small_green",
        ),
        "burst": (
            "Splatters/burst_splatter_003/burst_splatter_003_small_green",
            "Magic Bursts/directional_bubble_burst_001/directional_bubble_burst_001_small_green",
            "Fantasy Spells/spell_poison_001/spell_poison_001_small_green",
            "Fantasy Spells/spell_poison_001/spell_poison_001_large_green",
        ),
        "summon": (
            "Fantasy Spells/spell_poison_001/spell_poison_001_small_green",
            "Magic Bursts/directional_bubble_burst_001/directional_bubble_burst_001_small_green",
            "Magic Bursts/round_sparkle_burst_002/round_sparkle_burst_002_small_green",
        ),
    },
    "dark": {
        "wave": (
            "Impacts/directional_impact_003/directional_impact_003_small_violet",
            "Lightning/lightning_burst_002/lightning_burst_002_small_violet",
            "Fantasy Spells/spell_absorb_001/spell_absorb_001_small_violet",
        ),
        "aura": (
            "Fantasy Spells/spell_absorb_001/spell_absorb_001_small_violet",
            "Lightning/lightning_burst_002/lightning_burst_002_small_violet",
            "Smoke Bursts/symmetrical_smoke_burst_001/symmetrical_smoke_burst_001_small_brown",
        ),
        "beam": (
            "Lightning/lightning_strike_001/lightning_strike_001_small_violet",
            "Impacts/directional_impact_003/directional_impact_003_small_violet",
            "Fantasy Spells/spell_absorb_001/spell_absorb_001_small_violet",
        ),
        "rain": (
            "Lightning/lightning_burst_003/lightning_burst_003_small_violet",
            "Explosions/stylized_explosion_002/stylized_explosion_002_small_violet",
            "Smoke Bursts/stylized_skull_smoke_burst_001/stylized_skull_smoke_burst_001_small_white",
            "Smoke Bursts/stylized_skull_smoke_burst_001/stylized_skull_smoke_burst_001_large_white",
        ),
        "field": (
            "Fantasy Spells/spell_absorb_001/spell_absorb_001_small_violet",
            "Fantasy Spells/spell_absorb_001/spell_absorb_001_large_violet",
            "Lightning/lightning_burst_002/lightning_burst_002_small_violet",
            "Smoke Bursts/symmetrical_smoke_burst_001/symmetrical_smoke_burst_001_small_brown",
        ),
        "burst": (
            "Explosions/stylized_explosion_002/stylized_explosion_002_small_violet",
            "Lightning/lightning_burst_002/lightning_burst_002_small_violet",
            "Impacts/directional_impact_003/directional_impact_003_small_violet",
        ),
        "summon": (
            "Explosions/stylized_explosion_002/stylized_explosion_002_small_violet",
            "Explosions/stylized_explosion_002/stylized_explosion_002_large_violet",
            "Fantasy Spells/spell_absorb_001/spell_absorb_001_small_violet",
            "Smoke Bursts/stylized_skull_smoke_burst_001/stylized_skull_smoke_burst_001_small_white",
        ),
    },
    "light": {
        "wave": (
            "Magic Bursts/round_light_burst_001/round_light_burst_001_small_yellow",
            "Impacts/directional_impact_002/directional_impact_002_small_white",
            "Sci-fi/scifi_spark_burst_001/scifi_spark_burst_001_small_yellow",
        ),
        "aura": (
            "Fantasy Spells/status_sparkling_001/status_sparkling_001_small_yellow",
            "Magic Bursts/round_light_burst_001/round_light_burst_001_small_yellow",
            "Impacts/directional_impact_002/directional_impact_002_small_white",
        ),
        "beam": (
            "Magic Bursts/round_light_burst_001/round_light_burst_001_small_yellow",
            "Impacts/directional_impact_002/directional_impact_002_small_white",
            "Sci-fi/scifi_spark_burst_001/scifi_spark_burst_001_small_yellow",
        ),
        "rain": (
            "Fantasy Spells/status_sparkling_001/status_sparkling_001_small_yellow",
            "Magic Bursts/round_light_burst_001/round_light_burst_001_small_yellow",
            "Sci-fi/scifi_spark_burst_001/scifi_spark_burst_001_small_yellow",
        ),
        "field": (
            "Fantasy Spells/status_sparkling_001/status_sparkling_001_small_yellow",
            "Fantasy Spells/spell_defense_up_001/spell_defense_up_001_small_blue",
            "Magic Bursts/round_light_burst_001/round_light_burst_001_small_yellow",
        ),
        "burst": (
            "Impacts/symmetrical_impact_006/symmetrical_impact_006_small_yellow",
            "Magic Bursts/round_light_burst_001/round_light_burst_001_small_yellow",
            "Sci-fi/scifi_spark_burst_001/scifi_spark_burst_001_small_yellow",
        ),
        "summon": (
            "Magic Bursts/round_light_burst_001/round_light_burst_001_small_yellow",
            "Sci-fi/scifi_spark_burst_001/scifi_spark_burst_001_small_yellow",
            "Fantasy Spells/status_sparkling_001/status_sparkling_001_small_yellow",
        ),
    },
}

STATUS_GIGAPACK_SOURCES = {
    "burn": (
        "Fantasy Spells/spell_attack_up_001/spell_attack_up_001_small_red",
        "Magic Bursts/round_sparkle_burst_003/round_sparkle_burst_003_small_red",
        "Splatters/burst_splatter_001/burst_splatter_001_small_red",
    ),
    "poison": (
        "Fantasy Spells/status_poison_001/status_poison_001_small_green",
        "Fantasy Spells/spell_poison_001/spell_poison_001_small_green",
        "Splatters/burst_splatter_003/burst_splatter_003_small_green",
    ),
    "stun": (
        "Sci-fi/scifi_spark_burst_001/scifi_spark_burst_001_small_yellow",
        "Magic Bursts/round_light_burst_001/round_light_burst_001_small_yellow",
        "Lightning/lightning_burst_001/lightning_burst_001_small_violet",
    ),
    "guard": (
        "Fantasy Spells/spell_defense_up_001/spell_defense_up_001_small_blue",
        "Impacts/symmetrical_impact_002/symmetrical_impact_002_small_blue",
        "Magic Bursts/round_sparkle_burst_001/round_sparkle_burst_001_small_blue",
    ),
    "regen": (
        "Fantasy Spells/spell_heal_001/spell_heal_001_large_red",
        "Fantasy Spells/spell_heal_001/spell_heal_001_small_red",
        "Fantasy Spells/spell_haste_001/spell_haste_001_small_green",
        "Sci-fi/scifi_heartbeat_slow_001/scifi_heartbeat_slow_001_small_green",
        "Magic Bursts/round_sparkle_burst_002/round_sparkle_burst_002_small_green",
        "Magic Bursts/directional_bubble_burst_001/directional_bubble_burst_001_small_green",
    ),
}

STATUS_LAYOUT = {
    "burn": ((70, 50), (48, 61), (0.82, 0.34, 0.26)),
    "poison": ((66, 66), (48, 55), (0.78, 0.4, 0.28)),
    "stun": ((54, 58), (48, 40), (0.86, 0.35, 0.22)),
    "guard": ((72, 66), (48, 52), (0.72, 0.34, 0.24)),
    "regen": ((76, 72), (48, 50), (0.82, 0.4, 0.25)),
}

STATUS_TINTS = {
    "regen": ("#143b17", "#ccff78"),
}

STATUS_SOURCE_MIN_OPAQUE = {
    "burn": 120,
    "stun": 150,
}

STATUS_GIGAPACK_MIN_OPAQUE = {
    "guard": 1000,
}


@dataclass(frozen=True)
class SpellFx:
    frames: tuple[Image.Image, ...]


@dataclass(frozen=True)
class GigapackFx:
    frames: tuple[Image.Image, ...]


def default_license_manifest() -> dict[str, object]:
    return {
        "status": LICENSE_CONFIRMED_STATUS,
        "notes": (
            "Project owner confirmed in the Codex thread on 2026-07-03 that both external RPG VFX packs "
            "were paid for and can be used commercially."
        ),
        "proof": {
            "source": "Project owner purchase confirmation in Codex thread",
            "reference": "User message on 2026-07-03: both RPG VFX packs are paid and approved for commercial use",
            "checkedAt": "2026-07-03",
        },
        "impactPack": {
            "displayName": "750 Effect and FX Pixel All",
            "localDefault": str(EFFECT_ZIP),
            "usedAs": "64x64 impact sprites normalized into 160x112 RPG skill rows",
            "licenseStatus": LICENSE_CONFIRMED_STATUS,
            "licenseReference": {
                "source": "BDragon1727 itch.io asset page",
                "reference": "https://bdragon1727.itch.io/750-effect-and-fx-pixel-all",
                "checkedAt": "2026-07-03",
                "notes": (
                    "The page says commercial games require a contribution. Project owner confirmed payment on 2026-07-03."
                ),
            },
            "proof": {
                "source": "Project owner purchase confirmation in Codex thread",
                "reference": "User message on 2026-07-03: both RPG VFX packs are paid and approved for commercial use",
                "checkedAt": "2026-07-03",
            },
        },
        "projectilePack": {
            "displayName": "Fire Pixel Bullet 16x16",
            "localDefault": str(FIRE_BULLET_RAR),
            "usedAs": "16x16 bullet sprites normalized into 96x56 RPG projectile rows",
            "licenseStatus": LICENSE_CONFIRMED_STATUS,
            "licenseReference": {
                "source": "BDragon1727 itch.io asset and purchase pages",
                "reference": "https://bdragon1727.itch.io/fire-pixel-bullet-16x16",
                "purchaseReference": "https://bdragon1727.itch.io/fire-pixel-bullet-16x16/purchase",
                "checkedAt": "2026-07-03",
                "notes": "The page says commercial games require a contribution. Project owner confirmed payment on 2026-07-03.",
            },
            "proof": {
                "source": "Project owner purchase confirmation in Codex thread",
                "reference": "User message on 2026-07-03: both RPG VFX packs are paid and approved for commercial use",
                "checkedAt": "2026-07-03",
            },
        },
        "spellPack": {
            "displayName": "SpellsFX 2.0",
            "localDefault": str(SPELLS_FX_ZIP),
            "usedAs": "64x64 spell spritesheet frames normalized as complete single-sequence RPG skill rows",
            "licenseStatus": LICENSE_CONFIRMED_STATUS,
            "licenseReference": {
                "source": "SpellsFX2.0.zip public-license.txt",
                "reference": "Creative Commons Attribution v4.0 International in local archive",
                "checkedAt": "2026-07-03",
                "notes": "The included license permits free and commercial projects with attribution to Raphael Hatencia / RagnaPixel Studio.",
            },
            "proof": {
                "source": "SpellsFX2.0.zip public-license.txt",
                "reference": "CC BY 4.0; commercial use allowed with Raphael Hatencia / RagnaPixel Studio credit",
                "checkedAt": "2026-07-03",
            },
        },
        "gigapackPack": {
            "displayName": "Super Pixel Effects Gigapack Free Version",
            "localDefault": str(GIGAPACK_ZIP),
            "usedAs": "Selected 15 FPS PNG-frame effects normalized into curated group, support, status, intermediate, ultimate, and persistent status RPG VFX rows",
            "licenseStatus": LICENSE_CONFIRMED_STATUS,
            "licenseReference": {
                "source": "Super Pixel Effects Gigapack Free Version license.txt",
                "reference": "http://untiedgames.com/files/license.txt",
                "checkedAt": "2026-07-03",
                "notes": "Included license summary says commercial and non-commercial use are both OK with attribution.",
            },
            "proof": {
                "source": "Super Pixel Effects Gigapack Free Version license.txt",
                "reference": "Commercial use OK; credit Will Tice / unTied Games",
                "checkedAt": "2026-07-03",
            },
        },
    }


def read_existing_manifest() -> dict[str, object] | None:
    if not MANIFEST_PATH.exists():
        return None
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return manifest if isinstance(manifest, dict) else None


def has_complete_commercial_proof(license_info: object) -> bool:
    if not isinstance(license_info, dict):
        return False
    if license_info.get("status") != LICENSE_CONFIRMED_STATUS:
        return False
    proof = license_info.get("proof")
    if not isinstance(proof, dict):
        return False
    return all(bool(proof.get(key)) for key in LICENSE_PROOF_KEYS)


def merge_pack_license_defaults(default_pack: object, existing_pack: object) -> object:
    if not isinstance(default_pack, dict):
        return default_pack
    merged = default_pack.copy()
    if isinstance(existing_pack, dict):
        if existing_pack.get("displayName") != default_pack.get("displayName"):
            return merged
        if existing_pack.get("licenseStatus") != LICENSE_CONFIRMED_STATUS:
            return merged
        for key, value in existing_pack.items():
            if key not in {"displayName", "localDefault", "usedAs"}:
                merged[key] = value
    return merged


def license_manifest_from_existing(existing_manifest: dict[str, object] | None) -> dict[str, object]:
    license_info = default_license_manifest()
    if not existing_manifest:
        return license_info

    existing_license = existing_manifest.get("license")
    if not isinstance(existing_license, dict):
        return license_info

    if has_complete_commercial_proof(existing_license):
        for key, value in existing_license.items():
            if key not in {"impactPack", "projectilePack", "spellPack", "gigapackPack"}:
                license_info[key] = value

    license_info["impactPack"] = merge_pack_license_defaults(
        license_info.get("impactPack"),
        existing_license.get("impactPack"),
    )
    license_info["projectilePack"] = merge_pack_license_defaults(
        license_info.get("projectilePack"),
        existing_license.get("projectilePack"),
    )
    license_info["spellPack"] = merge_pack_license_defaults(
        license_info.get("spellPack"),
        existing_license.get("spellPack"),
    )
    license_info["gigapackPack"] = merge_pack_license_defaults(
        license_info.get("gigapackPack"),
        existing_license.get("gigapackPack"),
    )
    return license_info


def require_file(path: Path, label: str) -> None:
    if not path.exists():
        raise SystemExit(f"Missing {label}: {path}")


def colorize_shadow(alpha: Image.Image, opacity: int) -> Image.Image:
    shadow = Image.new("RGBA", alpha.size, (14, 8, 6, 0))
    shadow.putalpha(alpha.point(lambda value: min(opacity, int(value * opacity / 255))))
    return shadow


def safe_alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    return image.getchannel("A").point(lambda value: 255 if value > 18 else 0).getbbox()


def opaque_pixel_count(image: Image.Image, threshold: int = 18) -> int:
    alpha = image.getchannel("A")
    return sum(1 for value in alpha.getdata() if value > threshold)


def spell_source_names(element: str, style: str) -> tuple[str, ...]:
    return SPELL_STYLE_SOURCES[element][style]


def all_spell_sources() -> list[str]:
    return sorted(
        {
            source
            for element_sources in SPELL_STYLE_SOURCES.values()
            for style_sources in element_sources.values()
            for source in style_sources
        } | set(STATUS_SPELL_SOURCE_OVERRIDES.values())
    )


def gigapack_source_names(element: str, style: str) -> tuple[str, ...]:
    return GIGAPACK_STYLE_SOURCES.get(element, {}).get(style, ())


def row_gigapack_source_names(element: str, style: str, row: int) -> tuple[str, ...]:
    return gigapack_source_names(element, style) if row in GIGAPACK_SEQUENCE_ROWS else ()


def selected_gigapack_source_name(element: str, style: str, row: int) -> str | None:
    source_names = row_gigapack_source_names(element, style, row)
    if not source_names:
        return None
    override = GIGAPACK_SOURCE_OVERRIDES.get((element, row))
    if override:
        if override not in source_names:
            raise SystemExit(f"Gigapack override {override} is not valid for {element} row {row} ({style})")
        return override
    return source_names[(row * 2 + row // 3 + STYLE_INDEX[style]) % len(source_names)]


def selected_spell_source_name(element: str, style: str, row: int) -> str:
    source_names = spell_source_names(element, style)
    override = SPELL_SEQUENCE_OVERRIDES.get((element, row)) or SPELL_SOURCE_OVERRIDES.get((element, row))
    if override:
        if override not in source_names:
            raise SystemExit(f"Spell override {override} is not valid for {element} row {row} ({style})")
        return override
    return source_names[(row * 2 + row // 3 + STYLE_INDEX[style]) % len(source_names)]


def selected_primary_pack(element: str, row: int) -> str:
    if (element, row) in SPELL_SEQUENCE_OVERRIDES:
        return "external-spellsfx-2"
    return "external-super-pixel-gigapack" if row in GIGAPACK_SEQUENCE_ROWS else "external-spellsfx-2"


def selected_primary_source_name(element: str, style: str, row: int) -> str:
    if selected_primary_pack(element, row) == "external-super-pixel-gigapack":
        source_name = selected_gigapack_source_name(element, style, row)
        if not source_name:
            raise SystemExit(f"Missing selected Gigapack source for {element} row {row} ({style})")
        return source_name
    return selected_spell_source_name(element, style, row)


def all_gigapack_sources() -> list[str]:
    return sorted(
        {
            source
            for element_sources in GIGAPACK_STYLE_SOURCES.values()
            for style_sources in element_sources.values()
            for source in style_sources
        }
    )


def all_status_gigapack_sources() -> list[str]:
    return sorted(
        {
            source
            for status, sources in STATUS_GIGAPACK_SOURCES.items()
            if status not in STATUS_SPELL_SOURCE_OVERRIDES
            for source in sources
        }
    )


def selected_status_pack(status: str) -> str:
    return "external-spellsfx-2" if status in STATUS_SPELL_SOURCE_OVERRIDES else "external-super-pixel-gigapack"


def selected_status_source_name(status: str, row: int) -> str:
    spell_override = STATUS_SPELL_SOURCE_OVERRIDES.get(status)
    if spell_override:
        return spell_override

    source_names = STATUS_GIGAPACK_SOURCES[status]
    override = STATUS_SOURCE_OVERRIDES.get(status)
    if override:
        if override not in source_names:
            raise SystemExit(f"Status override {override} is not valid for {status} row {row}")
        return override
    return source_names[row_source_offset(row) % len(source_names)]


def visible_spell_frames(image: Image.Image) -> tuple[Image.Image, ...]:
    columns = image.width // SPELL_SOURCE_FRAME
    rows = image.height // SPELL_SOURCE_FRAME
    frames: list[Image.Image] = []
    for row in range(rows):
        for column in range(columns):
            frame = image.crop(
                (
                    column * SPELL_SOURCE_FRAME,
                    row * SPELL_SOURCE_FRAME,
                    (column + 1) * SPELL_SOURCE_FRAME,
                    (row + 1) * SPELL_SOURCE_FRAME,
                )
            )
            if safe_alpha_bbox(frame):
                frames.append(frame)
    if not frames:
        raise SystemExit("SpellsFX source sheet has no visible frames")
    return tuple(frames)


def read_spell_sources() -> dict[str, SpellFx]:
    require_file(SPELLS_FX_ZIP, "SpellsFX2.0.zip")
    wanted = all_spell_sources()
    sources: dict[str, SpellFx] = {}
    with ZipFile(SPELLS_FX_ZIP) as archive:
        names = set(archive.namelist())
        missing = [name for name in wanted if name not in names]
        if missing:
            raise SystemExit(f"Missing expected SpellsFX entries: {', '.join(missing)}")
        if "public-license.txt" not in names:
            raise SystemExit("SpellsFX2.0.zip is missing public-license.txt")
        for name in wanted:
            with archive.open(name) as file:
                image = Image.open(file).convert("RGBA")
                if image.width % SPELL_SOURCE_FRAME or image.height % SPELL_SOURCE_FRAME:
                    raise SystemExit(f"{name} is not on a 64px grid: {image.size}")
                sources[name] = SpellFx(frames=visible_spell_frames(image))
    return sources


def read_gigapack_sources() -> dict[str, GigapackFx]:
    wanted = sorted({*all_gigapack_sources(), *all_status_gigapack_sources()})
    if not wanted:
        return {}
    require_file(GIGAPACK_ZIP, "Super Pixel Effects Gigapack (Free Version) v2.5.0.zip")
    sources: dict[str, GigapackFx] = {}
    with ZipFile(GIGAPACK_ZIP) as archive:
        names = set(archive.namelist())
        if "Super Pixel Effects Gigapack (Free Version)/license.txt" not in names:
            raise SystemExit("Super Pixel Effects Gigapack archive is missing license.txt")
        for source_dir in wanted:
            prefix = f"{GIGAPACK_ARCHIVE_ROOT}/{source_dir}/"
            frame_names = sorted(name for name in names if name.startswith(prefix) and name.lower().endswith(".png"))
            if not frame_names:
                raise SystemExit(f"Missing expected Gigapack frame directory: {source_dir}")
            frames: list[Image.Image] = []
            for name in frame_names:
                with archive.open(name) as file:
                    frame = Image.open(file).convert("RGBA")
                if safe_alpha_bbox(frame):
                    frames.append(frame)
            if not frames:
                raise SystemExit(f"Gigapack source has no visible frames: {source_dir}")
            sources[source_dir] = GigapackFx(frames=tuple(frames))
    return sources


def spell_source_frame(source: SpellFx, output_column: int) -> Image.Image:
    if len(source.frames) == 1:
        return source.frames[0]
    frame = round(output_column * (len(source.frames) - 1) / max(1, SKILL_COLUMNS - 1))
    return source.frames[frame]


def spell_status_source_frame(source: SpellFx, output_column: int) -> Image.Image:
    if len(source.frames) == 1:
        return source.frames[0]
    return source.frames[output_column % len(source.frames)]


def loopable_spell_status_source_frame(source: SpellFx, status: str, output_column: int) -> Image.Image:
    min_opaque = STATUS_SOURCE_MIN_OPAQUE.get(status, 0)
    frames = [frame for frame in source.frames if opaque_pixel_count(frame) >= min_opaque] if min_opaque else list(source.frames)
    if not frames:
        frames = list(source.frames)
    return frames[output_column % len(frames)]


def gigapack_source_frame(source: GigapackFx, output_column: int, output_columns: int = SKILL_COLUMNS) -> Image.Image:
    if len(source.frames) == 1:
        return source.frames[0]
    frame = round(output_column * (len(source.frames) - 1) / max(1, output_columns - 1))
    return source.frames[frame]


def dense_gigapack_source_frame(source: GigapackFx, output_column: int, min_opaque: int = 140) -> Image.Image:
    frames = [frame for frame in source.frames if opaque_pixel_count(frame) >= min_opaque]
    if not frames:
        frames = list(source.frames)
    return frames[output_column % len(frames)]


def row_source_offset(row: int) -> int:
    return row + (row % 7) + (row // 3)


def crop_to_alpha(image: Image.Image, padding: int = 3) -> Image.Image:
    bbox = safe_alpha_bbox(image)
    if bbox is None:
        return image
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - padding),
            max(0, top - padding),
            min(image.width, right + padding),
            min(image.height, bottom + padding),
        )
    )


def with_alpha_multiplier(image: Image.Image, multiplier: float) -> Image.Image:
    adjusted = image.copy()
    alpha = adjusted.getchannel("A")
    adjusted.putalpha(alpha.point(lambda value: max(0, min(255, int(value * multiplier)))))
    return adjusted


def tint_frame(image: Image.Image, dark_hex: str, light_hex: str) -> Image.Image:
    def rgb(hex_color: str) -> tuple[int, int, int]:
        value = hex_color.lstrip("#")
        return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))

    dark = rgb(dark_hex)
    light = rgb(light_hex)
    luminance = ImageOps.grayscale(image)
    alpha = image.getchannel("A")
    tinted = Image.new("RGBA", image.size, (0, 0, 0, 0))
    pixels = []
    for value, opacity in zip(luminance.getdata(), alpha.getdata(), strict=True):
        mix = value / 255
        pixels.append((
            round(dark[0] + (light[0] - dark[0]) * mix),
            round(dark[1] + (light[1] - dark[1]) * mix),
            round(dark[2] + (light[2] - dark[2]) * mix),
            opacity,
        ))
    tinted.putdata(pixels)
    return tinted


def place_scaled_frame(
    layer: Image.Image,
    frame: Image.Image,
    fit_w: int,
    fit_h: int,
    center_x: int,
    center_y: int,
    opacity: float,
) -> None:
    cropped = crop_to_alpha(frame, padding=2)
    bbox = safe_alpha_bbox(cropped)
    if bbox is None:
        return
    scale = min(fit_w / cropped.width, fit_h / cropped.height)
    scaled = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.NEAREST,
    )
    scaled = with_alpha_multiplier(scaled, opacity)
    alpha = scaled.getchannel("A")
    shadow = colorize_shadow(alpha, round(76 * opacity))
    x = center_x - scaled.width // 2
    y = center_y - scaled.height // 2
    layer.alpha_composite(shadow, (x + 2, y + 3))
    layer.alpha_composite(scaled, (x, y))


def compose_skill_frame(
    spell_sources: dict[str, SpellFx],
    gigapack_sources: dict[str, GigapackFx],
    element: str,
    style: str,
    row: int,
    column: int,
) -> Image.Image:
    primary_pack = selected_primary_pack(element, row)
    if primary_pack == "external-super-pixel-gigapack":
        gigapack_source = selected_primary_source_name(element, style, row)
        layer = Image.new("RGBA", (SKILL_FRAME_W, SKILL_FRAME_H), (0, 0, 0, 0))
        if style == "beam":
            fit = (112, 76)
            center = (82, 55)
        elif style == "rain":
            fit = (112, 84)
            center = (80, 53)
        elif style == "field":
            fit = (118, 88)
            center = (80, 59)
        elif style == "aura":
            fit = (106, 82)
            center = (80, 57)
        elif style == "wave":
            fit = (128, 82)
            center = (80, 57)
        elif style == "burst":
            fit = (118, 86)
            center = (80, 56)
        elif style == "summon":
            fit = (126, 90)
            center = (80, 58)
        else:
            fit = (108, 82)
            center = (80, 57)
        fit = (
            max(72, min(SKILL_FRAME_W, fit[0] + ((row % 5) - 2) * 5)),
            max(58, min(SKILL_FRAME_H, fit[1] + ((row % 4) - 1) * 4)),
        )
        center = (
            center[0] + ((row * 7) % 9) - 4,
            center[1] + ((row * 5) % 7) - 3,
        )
        place_scaled_frame(layer, gigapack_source_frame(gigapack_sources[gigapack_source], column), fit[0], fit[1], center[0], center[1], 0.9)
        return layer

    source_name = selected_primary_source_name(element, style, row)
    frame = crop_to_alpha(spell_source_frame(spell_sources[source_name], column), padding=3)
    cell = Image.new("RGBA", (SKILL_FRAME_W, SKILL_FRAME_H), (0, 0, 0, 0))
    if safe_alpha_bbox(frame) is None:
        return cell
    fit_by_style = {
        "strike": (108, 88),
        "projectile": (94, 78),
        "beam": (140, 82),
        "burst": (126, 104),
        "rain": (122, 96),
        "aura": (128, 104),
        "wave": (144, 92),
        "field": (136, 106),
        "summon": (106, 82),
    }
    fit_w, fit_h = fit_by_style[style]
    fit_w = max(72, min(SKILL_FRAME_W, fit_w + ((row % 5) - 2) * 5))
    fit_h = max(58, min(SKILL_FRAME_H, fit_h + ((row % 4) - 1) * 4))
    scale = min(fit_w / frame.width, fit_h / frame.height)
    scaled = frame.resize((max(1, round(frame.width * scale)), max(1, round(frame.height * scale))), Image.Resampling.NEAREST)
    alpha = scaled.getchannel("A")
    shadow = colorize_shadow(alpha, 72)
    y_bias = {"strike": -4, "projectile": -8, "beam": -8, "burst": -2, "rain": -6, "aura": 0, "wave": -2, "field": 4, "summon": 0}[style]
    x = (SKILL_FRAME_W - scaled.width) // 2 + ((row * 7) % 9) - 4
    y = (SKILL_FRAME_H - scaled.height) // 2 + y_bias + ((row * 5) % 7) - 3
    progress = column / max(1, SKILL_COLUMNS - 1)
    if style == "projectile":
        x += round((progress - 0.5) * 42)
    elif style in {"beam", "wave", "rain"}:
        x += round((progress - 0.5) * 20)
    if style in {"aura", "field", "summon", "burst"}:
        y += round(math.sin(progress * math.tau) * 3)
    cell.alpha_composite(shadow, (x + 2, y + 3))
    cell.alpha_composite(scaled, (x, y))
    return cell


def make_skill_sheets() -> None:
    spell_sources = read_spell_sources()
    gigapack_sources = read_gigapack_sources()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for element in RPG_ELEMENTS:
        sheet = Image.new("RGBA", (SKILL_COLUMNS * SKILL_FRAME_W, SKILL_ROWS * SKILL_FRAME_H), (0, 0, 0, 0))
        for row, style in enumerate(RPG_SKILL_STYLES):
            for column in range(SKILL_COLUMNS):
                frame = compose_skill_frame(spell_sources, gigapack_sources, element, style, row, column)
                sheet.alpha_composite(frame, (column * SKILL_FRAME_W, row * SKILL_FRAME_H))
        sheet.save(OUT_DIR / f"rpg-skill-vfx-{element}.png")


def compose_status_frame(
    spell_sources: dict[str, SpellFx],
    gigapack_sources: dict[str, GigapackFx],
    status: str,
    row: int,
    column: int,
) -> Image.Image:
    source_name = selected_status_source_name(status, row)
    fit, center, opacities = STATUS_LAYOUT[status]
    layer = Image.new("RGBA", (STATUS_FRAME_W, STATUS_FRAME_H), (0, 0, 0, 0))

    if selected_status_pack(status) == "external-spellsfx-2":
        source = spell_sources[source_name]
        frame = loopable_spell_status_source_frame(source, status, column)
    else:
        source = gigapack_sources[source_name]
        frame = dense_gigapack_source_frame(source, column, STATUS_GIGAPACK_MIN_OPAQUE.get(status, 140))
    if status in STATUS_TINTS:
        frame = tint_frame(frame, *STATUS_TINTS[status])
    place_scaled_frame(layer, frame, fit[0], fit[1], center[0], center[1], opacities[0])
    return layer


def make_status_sprites() -> None:
    spell_sources = read_spell_sources()
    gigapack_sources = read_gigapack_sources()
    sheet = Image.new("RGBA", (STATUS_COLUMNS * STATUS_FRAME_W, STATUS_ROWS * STATUS_FRAME_H), (0, 0, 0, 0))
    for row, status in enumerate(RPG_STATUSES):
        for column in range(STATUS_COLUMNS):
            frame = compose_status_frame(spell_sources, gigapack_sources, status, row, column)
            sheet.alpha_composite(frame, (column * STATUS_FRAME_W, row * STATUS_FRAME_H))
    sheet.save(OUT_DIR / "rpg-status-vfx.png")


def extract_rar_to_temp() -> Path:
    require_file(FIRE_BULLET_RAR, "New_All_Fire_Bullet_Pixel_16x16.rar")
    temp_dir = Path(tempfile.mkdtemp(prefix="renaiss-fire-bullets-"))
    tool = shutil.which("bsdtar") or shutil.which("7z")
    if not tool:
        raise SystemExit("Cannot extract RAR: bsdtar or 7z is required.")
    if Path(tool).name == "7z":
        subprocess.run([tool, "x", f"-o{temp_dir}", str(FIRE_BULLET_RAR)], check=True, stdout=subprocess.DEVNULL)
    else:
        subprocess.run([tool, "-xf", str(FIRE_BULLET_RAR), "-C", str(temp_dir)], check=True, stdout=subprocess.DEVNULL)
    return temp_dir


def make_projectile_sprites() -> None:
    temp_dir = extract_rar_to_temp()
    try:
        sheet = Image.new("RGBA", (PROJECTILE_COLUMNS * PROJECTILE_FRAME_W, PROJECTILE_ROWS * PROJECTILE_FRAME_H), (0, 0, 0, 0))
        projectile_frames = [(15, column) for column in range(5)] + [(17, column) for column in range(5)]
        for row, element in enumerate(RPG_ELEMENTS):
            source_path = temp_dir / ELEMENT_PROJECTILE_FILE[element]
            if not source_path.exists():
                raise SystemExit(f"Missing projectile source after extraction: {source_path.name}")
            source = Image.open(source_path).convert("RGBA")
            for column, (src_row, src_column) in enumerate(projectile_frames):
                crop = source.crop(
                    (
                        src_column * SOURCE_PROJECTILE_FRAME,
                        src_row * SOURCE_PROJECTILE_FRAME,
                        (src_column + 1) * SOURCE_PROJECTILE_FRAME,
                        (src_row + 1) * SOURCE_PROJECTILE_FRAME,
                    )
                )
                scaled = crop.resize((SOURCE_PROJECTILE_FRAME * 3, SOURCE_PROJECTILE_FRAME * 3), Image.Resampling.NEAREST)
                cell = Image.new("RGBA", (PROJECTILE_FRAME_W, PROJECTILE_FRAME_H), (0, 0, 0, 0))
                alpha = scaled.getchannel("A")
                shadow = colorize_shadow(alpha, 120)
                x = 25 + column % 2
                y = 4
                for trail in range(3):
                    ghost = ImageOps.mirror(scaled).copy()
                    ghost.putalpha(alpha.point(lambda value, amount=trail: int(value * (0.18 - amount * 0.04))))
                    cell.alpha_composite(ghost, (max(0, x - 9 - trail * 7), y + trail))
                cell.alpha_composite(shadow, (x + 2, y + 3))
                cell.alpha_composite(scaled, (x, y))
                sheet.alpha_composite(cell, (column * PROJECTILE_FRAME_W, row * PROJECTILE_FRAME_H))
        sheet.save(OUT_DIR / "rpg-skill-projectiles.png")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def tier_for_row(row: int) -> str:
    if row >= 20:
        return "ultimate"
    if row >= 10:
        return "intermediate"
    return "basic"


def write_manifest() -> None:
    spell_sources = all_spell_sources()
    gigapack_sources = all_gigapack_sources()
    impact_sources = sorted([*spell_sources, *gigapack_sources])
    projectile_frames = [(15, column) for column in range(5)] + [(17, column) for column in range(5)]
    manifest = {
        "schemaVersion": 1,
        "assetVersion": ASSET_VERSION,
        "license": license_manifest_from_existing(read_existing_manifest()),
        "runtimeSheets": {
            "skillImpact": {
                "files": [f"rpg-skill-vfx-{element}.png" for element in RPG_ELEMENTS],
                "columns": SKILL_COLUMNS,
                "rows": SKILL_ROWS,
                "frameWidth": SKILL_FRAME_W,
                "frameHeight": SKILL_FRAME_H
            },
            "projectiles": {
                "file": "rpg-skill-projectiles.png",
                "columns": PROJECTILE_COLUMNS,
                "rows": PROJECTILE_ROWS,
                "frameWidth": PROJECTILE_FRAME_W,
                "frameHeight": PROJECTILE_FRAME_H
            }
        },
        "impactSources": impact_sources,
        "compositionMode": "single-sequence-per-row",
        "selectionContract": {
            "runtimeComposition": "one-primary-sequence-per-skill-row",
            "allowsPackLayering": False,
            "moveRowsExposeOnlySelectedSources": True,
            "statusRowsArePersistentOverlays": True,
        },
        "spellSources": spell_sources,
        "gigapackSources": gigapack_sources,
        "statusGigapackSources": all_status_gigapack_sources(),
        "elementRows": {
            element: {
                "impactColorRow": ELEMENT_COLOR_ROW[element],
                "projectileSource": ELEMENT_PROJECTILE_FILE[element],
                "projectileRow": index
            }
            for index, element in enumerate(RPG_ELEMENTS)
        },
        "moveRows": [
            {
                "row": row,
                "tier": tier_for_row(row),
                "slot": row - 19 if row >= 20 else row - 9 if row >= 10 else row + 1,
                "style": style,
                "selectedSources": {
                    element: {
                        "pack": selected_primary_pack(element, row),
                        "source": selected_primary_source_name(element, style, row),
                    }
                    for element in RPG_ELEMENTS
                },
            }
            for row, style in enumerate(RPG_SKILL_STYLES)
        ],
        "statusRows": [
            {
                "row": row,
                "status": status,
                "pack": selected_status_pack(status),
                "source": selected_status_source_name(status, row),
            }
            for row, status in enumerate(RPG_STATUSES)
        ],
        "projectileFrames": [
            {"column": column, "sourceFrameWidth": SOURCE_PROJECTILE_FRAME, "sourceFrameHeight": SOURCE_PROJECTILE_FRAME, "sourceRow": source_row, "sourceColumn": source_column}
            for column, (source_row, source_column) in enumerate(projectile_frames)
        ]
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    make_projectile_sprites()
    make_skill_sheets()
    make_status_sprites()
    write_manifest()
    print("Updated RPG VFX assets:")
    print(f"- {OUT_DIR / 'rpg-skill-projectiles.png'}")
    for element in RPG_ELEMENTS:
        print(f"- {OUT_DIR / f'rpg-skill-vfx-{element}.png'}")
    print(f"- {OUT_DIR / 'rpg-status-vfx.png'}")
    print(f"- {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
