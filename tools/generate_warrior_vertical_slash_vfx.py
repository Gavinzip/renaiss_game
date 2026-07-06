from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "apps/client/public/assets/generated/ability-effects.png"
OUTPUT = ROOT / "apps/client/public/assets/generated/warrior-vertical-slash.png"

SOURCE_COLUMNS = 12
SOURCE_ROWS = 10
WARRIOR_SLASH_ROW = 1
SOURCE_FRAMES = [3, 4, 5, 5, 4, 3]
CELL_SIZE = 128


def trim_alpha(image: Image.Image) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return image
    return image.crop(bbox)


def fit_into_cell(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    width, height = image.size
    scale = min(max_width / width, max_height / height, 1.6)
    if scale == 1:
        return image
    return image.resize((max(1, round(width * scale)), max(1, round(height * scale))), Image.Resampling.NEAREST)


def paste_center(sheet: Image.Image, image: Image.Image, column: int, row: int) -> None:
    x = column * CELL_SIZE + (CELL_SIZE - image.width) // 2
    y = row * CELL_SIZE + (CELL_SIZE - image.height) // 2
    sheet.alpha_composite(image, (x, y))


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    source_cell_width = source.width // SOURCE_COLUMNS
    source_cell_height = source.height // SOURCE_ROWS
    sheet = Image.new("RGBA", (len(SOURCE_FRAMES) * CELL_SIZE, 2 * CELL_SIZE), (0, 0, 0, 0))

    for column, source_frame in enumerate(SOURCE_FRAMES):
      crop = source.crop(
          (
              source_frame * source_cell_width,
              WARRIOR_SLASH_ROW * source_cell_height,
              (source_frame + 1) * source_cell_width,
              (WARRIOR_SLASH_ROW + 1) * source_cell_height,
          )
      )
      trimmed = trim_alpha(crop)
      up = trim_alpha(trimmed.rotate(90, expand=True, resample=Image.Resampling.NEAREST))
      down = trim_alpha(trimmed.rotate(-90, expand=True, resample=Image.Resampling.NEAREST))
      paste_center(sheet, fit_into_cell(up, 116, 92), column, 0)
      paste_center(sheet, fit_into_cell(down, 116, 92), column, 1)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUTPUT)
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({sheet.width}x{sheet.height})")


if __name__ == "__main__":
    main()
