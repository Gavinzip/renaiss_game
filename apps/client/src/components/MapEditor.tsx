import { ClipboardText, DownloadSimple, Eye, Plus, Trash, UploadSimple, X } from "@phosphor-icons/react";
import {
  MAP_PROPS,
  WORLD,
  type Collider,
  type MapProp,
  type MapPropType
} from "@renaiss-game/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ENV_CROPS,
  getArenaDecalGridPosition,
  getArenaDecalTexturePadding,
  getArenaDecalTextureTrimPadding,
  shouldTrimArenaDecalTexture,
  type ArenaDecalKey,
  type Crop
} from "../game/assets/crops";
import { generatedAssetPath } from "../game/assets/generatedAssets";
import { removeMatteFromImageData } from "../game/assets/spriteMatte";
import { MAP_EDITOR_STORAGE_KEY, cloneMapProps, loadEditorInitialProps, parseMapPropDraftText } from "../game/mapDraft";
import {
  getMapPropFootPoint,
  getMapPropRenderFrame,
  getMapPropShadowFrame,
  getMapPropVisualBounds,
  MAP_EDITOR_PALETTE,
  MAP_PROP_CATALOG_BY_TYPE,
  type MapPropCatalogEntry
} from "../game/mapPropCatalog";

interface TextureCache {
  envSource: HTMLImageElement;
  arenaSource: HTMLImageElement;
  tiles: Record<TileTextureKey, HTMLCanvasElement>;
  props: Partial<Record<MapPropType, HTMLCanvasElement>>;
  thumbs: Partial<Record<MapPropType, string>>;
}

interface DragState {
  mode: "pan" | "prop";
  pointerId: number;
  startX: number;
  startY: number;
  panX: number;
  panY: number;
  propId?: string;
  propX?: number;
  propY?: number;
}

const TILE_SIZE = 96;
const SNAP_STEP = 16;
type TileTextureKey = "grass" | "stone" | "stoneAlt";
const ROAD_WARNING_TYPES = new Set<MapPropType>([
  "fence",
  "lamp",
  "banner",
  "bannerPost",
  "barrel",
  "crate",
  "rockCluster",
  "mossStone",
  "flatRock",
  "stoneCorner",
  "brokenFence"
]);
const ROAD_CLEARANCE_SAMPLE_COUNT = 5;
const ROAD_CLEARANCE_MARGIN = 42;
const ROAD_CLEARANCE_SAMPLE_OFFSET = 26;
export function MapEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const texturesRef = useRef<TextureCache | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [ready, setReady] = useState(false);
  const [props, setProps] = useState<MapProp[]>(() => loadInitialProps());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [pointerWorld, setPointerWorld] = useState(() => ({ x: WORLD.width / 2, y: WORLD.height / 2 }));
  const [viewport, setViewport] = useState(() => {
    const zoom = 0.22;
    return {
      zoom,
      panX: window.innerWidth / 2 - (WORLD.width / 2) * zoom,
      panY: window.innerHeight / 2 - (WORLD.height / 2) * zoom
    };
  });
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const selected = props.find((prop) => prop.id === selectedId) ?? null;
  const textures = texturesRef.current;
  const selectedIssues = selected ? getPlacementIssues(selected, props) : [];
  const issueCount = props.reduce((count, prop) => count + getPlacementIssues(prop, props).length, 0);

  useEffect(() => {
    let cancelled = false;
    void loadEditorTextures().then((textures) => {
      if (cancelled) {
        return;
      }
      texturesRef.current = textures;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(MAP_EDITOR_STORAGE_KEY, JSON.stringify(props));
  }, [props]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const textures = texturesRef.current;
    if (!canvas || !textures) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, rect.width, rect.height);
    drawWorld(ctx, rect.width, rect.height, viewport, textures);
    drawMapProps(ctx, props, textures, viewport, selectedId);
    drawPlacementOverlays(ctx, props, viewport, selectedId);
  }, [props, selectedId, viewport]);

  useEffect(() => {
    draw();
  }, [draw, ready]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  const updateSelected = (patch: Partial<MapProp>) => {
    if (!selectedId) {
      return;
    }
    setProps((items) => items.map((item) => (item.id === selectedId ? { ...item, ...patch } : item)));
  };

  const moveSelectedBy = useCallback(
    (dx: number, dy: number) => {
      if (!selectedId) {
        return;
      }
      setProps((items) =>
        items.map((item) => {
          if (item.id !== selectedId) {
            return item;
          }
          const nextX = item.x + dx;
          const nextY = item.y + dy;
          return {
            ...item,
            x: nextX,
            y: nextY,
            collider: moveCollider(item.collider, nextX, nextY, item.x, item.y)
          };
        })
      );
    },
    [selectedId]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!selectedId || target?.closest("input, textarea, button, a")) {
        return;
      }

      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1]
      };
      const direction = arrows[event.key];
      if (!direction) {
        return;
      }

      event.preventDefault();
      const step = event.altKey ? 1 : event.shiftKey ? SNAP_STEP * 4 : snapEnabled ? SNAP_STEP : 4;
      moveSelectedBy(direction[0] * step, direction[1] * step);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveSelectedBy, selectedId, snapEnabled]);

  const addProp = (asset: MapPropCatalogEntry) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const center = screenToWorld(rect ? rect.width / 2 : window.innerWidth / 2, rect ? rect.height / 2 : window.innerHeight / 2, viewport);
    const x = snapEnabled ? snapValue(center.x) : Math.round(center.x);
    const y = snapEnabled ? snapValue(center.y) : Math.round(center.y);
    const next: MapProp = {
      id: `${asset.type}_${Date.now().toString(36)}`,
      type: asset.type,
      x,
      y,
      width: asset.width,
      height: asset.height,
      depthOffset: Math.round(asset.height * 0.48),
      collider: makeCollider(asset, x, y, asset.width, asset.height)
    };
    setProps((items) => [...items, next]);
    setSelectedId(next.id);
  };

  const duplicateSelected = () => {
    if (!selected) {
      return;
    }
    const nextX = snapEnabled ? snapValue(selected.x + 64) : selected.x + 64;
    const nextY = snapEnabled ? snapValue(selected.y + 48) : selected.y + 48;
    const next: MapProp = {
      ...selected,
      id: `${selected.type}_${Date.now().toString(36)}`,
      x: nextX,
      y: nextY,
      collider: moveCollider(selected.collider ? { ...selected.collider } : undefined, nextX, nextY, selected.x, selected.y)
    };
    setProps((items) => [...items, next]);
    setSelectedId(next.id);
  };

  const fitCenter = () => {
    const zoom = 0.22;
    setViewport({
      zoom,
      panX: window.innerWidth / 2 - (WORLD.width / 2) * zoom,
      panY: window.innerHeight / 2 - (WORLD.height / 2) * zoom
    });
  };

  const deleteSelected = () => {
    if (!selectedId) {
      return;
    }
    setProps((items) => items.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const resetMap = () => {
    const next = cloneMapProps(MAP_PROPS);
    setProps(next);
    setSelectedId(null);
  };

  const makeExport = async () => {
    const text = formatPropsForExport(props);
    setExportText(text);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked by the browser; the textarea still contains the export.
    }
  };

  const makeJsonExport = async () => {
    const text = JSON.stringify(props, null, 2);
    setExportText(text);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked by the browser; the textarea still contains the export.
    }
  };

  const importDraft = () => {
    try {
      const next = parseMapPropDraftText(importText);
      setProps(next);
      setSelectedId(next[0]?.id ?? null);
      setImportStatus(`Imported ${next.length} props`);
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Import failed");
    }
  };

  const openPreviewGame = () => {
    localStorage.setItem(MAP_EDITOR_STORAGE_KEY, JSON.stringify(props));
    window.location.href = "/?mapPreview=1";
  };

  return (
    <main className="map-editor">
      <canvas
        ref={canvasRef}
        className="map-editor-canvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const hit = hitTestProp(event.clientX, event.clientY, props, viewport, selectedId);
          if (hit) {
            setSelectedId(hit.id);
            dragRef.current = {
              mode: "prop",
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              panX: viewport.panX,
              panY: viewport.panY,
              propId: hit.id,
              propX: hit.x,
              propY: hit.y
            };
          } else {
            setSelectedId(null);
            dragRef.current = {
              mode: "pan",
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              panX: viewport.panX,
              panY: viewport.panY
            };
          }
        }}
        onPointerMove={(event) => {
          const worldPoint = screenToWorld(event.clientX, event.clientY, viewport);
          setPointerWorld({
            x: Math.round(worldPoint.x),
            y: Math.round(worldPoint.y)
          });
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) {
            return;
          }
          const dx = event.clientX - drag.startX;
          const dy = event.clientY - drag.startY;
          if (drag.mode === "pan") {
            setViewport((state) => ({ ...state, panX: drag.panX + dx, panY: drag.panY + dy }));
            return;
          }
          if (!drag.propId || drag.propX === undefined || drag.propY === undefined) {
            return;
          }
          const rawX = drag.propX + dx / viewport.zoom;
          const rawY = drag.propY + dy / viewport.zoom;
          const nextX = snapEnabled ? snapValue(rawX) : Math.round(rawX);
          const nextY = snapEnabled ? snapValue(rawY) : Math.round(rawY);
          setProps((items) =>
            items.map((item) =>
              item.id === drag.propId
                ? {
                    ...item,
                    x: nextX,
                    y: nextY,
                    collider: moveCollider(item.collider, nextX, nextY, item.x, item.y)
                  }
                : item
            )
          );
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          const nextZoom = clamp(viewport.zoom * (event.deltaY > 0 ? 0.9 : 1.1), 0.08, 0.9);
          const before = screenToWorld(event.clientX, event.clientY, viewport);
          setViewport({
            zoom: nextZoom,
            panX: event.clientX - before.x * nextZoom,
            panY: event.clientY - before.y * nextZoom
          });
        }}
      />

      <aside className="map-editor-panel">
        <header>
          <strong>Scene Editor</strong>
          <a href="/" aria-label="Back to game">
            <X size={18} weight="bold" />
          </a>
        </header>
        <div className={issueCount ? "map-editor-validation is-warning" : "map-editor-validation"}>
          {issueCount ? `${issueCount} placement warning${issueCount === 1 ? "" : "s"}` : "No placement warnings"}
        </div>
        {selected ? (
          <div className={selectedIssues.length ? "map-editor-issues is-warning" : "map-editor-issues"}>
            {selectedIssues.length ? selectedIssues.map((issue) => <span key={issue}>{issue}</span>) : <span>Selected prop looks clean</span>}
          </div>
        ) : null}

        <section>
          <h2>Palette</h2>
          <div className="map-editor-palette">
            {MAP_EDITOR_PALETTE.map((asset) => (
              <button key={asset.type} type="button" onClick={() => addProp(asset)}>
                {textures?.thumbs[asset.type] ? <img src={textures.thumbs[asset.type]} alt="" /> : <span className="map-editor-thumb-placeholder" />}
                <Plus size={13} weight="bold" />
                <span>{asset.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Tools</h2>
          <div className="map-editor-actions">
            <button type="button" onClick={() => setSnapEnabled((value) => !value)}>
              Snap {snapEnabled ? "On" : "Off"}
            </button>
            <button type="button" onClick={fitCenter}>
              <Eye size={15} weight="bold" />
              Fit
            </button>
            <button type="button" onClick={duplicateSelected} disabled={!selected}>
              <Plus size={15} weight="bold" />
              Duplicate
            </button>
            <button type="button" onClick={resetMap}>
              Reset
            </button>
          </div>
          <div className="map-editor-coordinates">
            X {pointerWorld.x} / Y {pointerWorld.y} / Zoom {viewport.zoom.toFixed(2)}
          </div>
        </section>

        <section>
          <h2>Selection</h2>
          {selected ? (
            <div className="map-editor-fields">
              <label>
                <span>Type</span>
                <b>{selected.type}</b>
              </label>
              <NumberField label="X" value={selected.x} onChange={(value) => updateSelected({ x: value, collider: moveCollider(selected.collider, value, selected.y, selected.x, selected.y) })} />
              <NumberField label="Y" value={selected.y} onChange={(value) => updateSelected({ y: value, collider: moveCollider(selected.collider, selected.x, value, selected.x, selected.y) })} />
              <NumberField label="W" value={selected.width} onChange={(value) => updateSelected(resizeProp(selected, value, selected.height))} />
              <NumberField label="H" value={selected.height} onChange={(value) => updateSelected(resizeProp(selected, selected.width, value))} />
              <NumberField label="Depth" value={selected.depthOffset} onChange={(value) => updateSelected({ depthOffset: value })} />
              <button className="map-editor-danger" type="button" onClick={deleteSelected}>
                <Trash size={15} weight="bold" />
                Delete
              </button>
            </div>
          ) : (
            <p>Drag the canvas or select a prop.</p>
          )}
        </section>

        <section>
          <h2>Export</h2>
          <div className="map-editor-actions">
            <button type="button" onClick={makeExport}>
              <ClipboardText size={15} weight="bold" />
              Copy TS
            </button>
            <button type="button" onClick={makeJsonExport}>
              <ClipboardText size={15} weight="bold" />
              Copy JSON
            </button>
            <button type="button" onClick={openPreviewGame}>
              <Eye size={15} weight="bold" />
              Preview Game
            </button>
            <a href="/" className="map-editor-link-button">Game</a>
          </div>
          {exportText ? <textarea readOnly value={exportText} /> : null}
        </section>

        <section>
          <h2>Import</h2>
          <textarea
            className="map-editor-import"
            value={importText}
            placeholder="Paste JSON array or copied TS export"
            onChange={(event) => {
              setImportText(event.target.value);
              setImportStatus("");
            }}
          />
          <div className="map-editor-actions">
            <button type="button" onClick={importDraft} disabled={!importText.trim()}>
              <UploadSimple size={15} weight="bold" />
              Import Draft
            </button>
          </div>
          {importStatus ? <div className={importStatus.startsWith("Imported") ? "map-editor-import-status" : "map-editor-import-status is-warning"}>{importStatus}</div> : null}
        </section>

        <footer>
          <DownloadSimple size={14} weight="bold" />
          Stored locally. Arrow keys nudge selected props.
        </footer>
      </aside>

      {!ready ? <div className="map-editor-loading">Loading editor assets</div> : null}
    </main>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} type="number" step={1} onChange={(event) => onChange(Math.round(Number(event.target.value) || 0))} />
    </label>
  );
}

function loadInitialProps() {
  return loadEditorInitialProps();
}

async function loadEditorTextures(): Promise<TextureCache> {
  const [envSource, arenaSource] = await Promise.all([loadImage(generatedAssetPath("village-assets")), loadImage(generatedAssetPath("arena-decals"))]);
  const cache: TextureCache = {
    envSource,
    arenaSource,
    tiles: {
      grass: buildEnvTexture(envSource, ENV_CROPS.grass),
      stone: buildEnvTexture(envSource, ENV_CROPS.stone),
      stoneAlt: buildEnvTexture(envSource, ENV_CROPS.stoneAlt)
    },
    props: {},
    thumbs: {}
  };
  for (const asset of MAP_EDITOR_PALETTE) {
    const texture = buildPropTexture(cache, asset);
    cache.props[asset.type] = texture;
    cache.thumbs[asset.type] = buildThumbnailUrl(texture);
  }
  return cache;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

function buildPropTexture(cache: TextureCache, asset: MapPropCatalogEntry) {
  const source = asset.source.kind === "env" ? cache.envSource : cache.arenaSource;
  const crop = asset.source.kind === "env" ? ENV_CROPS[asset.source.cropKey] : getArenaCrop(source, asset.source.key);
  return asset.source.kind === "env"
    ? buildEnvTexture(source, crop)
    : buildArenaTexture(
        source,
        crop,
        getArenaDecalTexturePadding(asset.source.key),
        shouldTrimArenaDecalTexture(asset.source.key),
        getArenaDecalTextureTrimPadding(asset.source.key)
      );
}

function buildEnvTexture(source: HTMLImageElement, crop: Crop) {
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  removeMagentaMatte(ctx, crop.width, crop.height);
  return canvas;
}

function buildArenaTexture(
  source: HTMLImageElement,
  crop: Crop,
  padding = { top: 0, right: 0, bottom: 0, left: 0 },
  trimAlpha = false,
  trimPadding = { top: 0, right: 0, bottom: 0, left: 0 }
) {
  const canvas = document.createElement("canvas");
  canvas.width = crop.width + padding.left + padding.right;
  canvas.height = crop.height + padding.top + padding.bottom;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, padding.left, padding.top, crop.width, crop.height);
  return trimAlpha ? trimCanvasToAlpha(canvas, trimPadding) : canvas;
}

function buildThumbnailUrl(texture: HTMLCanvasElement) {
  const canvasSize = 64;
  const maxSide = 56;
  const scale = Math.min(1, maxSide / Math.max(texture.width, texture.height));
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round(texture.width * scale));
  const height = Math.max(1, Math.round(texture.height * scale));
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(texture, Math.round((canvasSize - width) / 2), Math.round((canvasSize - height) / 2), width, height);
  return canvas.toDataURL("image/png");
}

function getArenaCrop(source: HTMLImageElement, key: ArenaDecalKey): Crop {
  const { column, row } = getArenaDecalGridPosition(key);
  const width = Math.floor(source.width / 5);
  const height = Math.floor(source.height / 4);
  return {
    x: Math.round(column * (source.width / 5)),
    y: Math.round(row * (source.height / 4)),
    width,
    height
  };
}

function removeMagentaMatte(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height);
  removeMatteFromImageData(image, "magenta");
  ctx.putImageData(image, 0, 0);
}

function trimCanvasToAlpha(canvas: HTMLCanvasElement, padding: { top: number; right: number; bottom: number; left: number }) {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] <= 8) {
        continue;
      }
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) {
    return canvas;
  }

  const cropLeft = Math.max(0, left - padding.left);
  const cropTop = Math.max(0, top - padding.top);
  const cropRight = Math.min(width, right + 1 + padding.right);
  const cropBottom = Math.min(height, bottom + 1 + padding.bottom);
  const output = document.createElement("canvas");
  output.width = cropRight - cropLeft;
  output.height = cropBottom - cropTop;
  const outputCtx = output.getContext("2d")!;
  outputCtx.imageSmoothingEnabled = false;
  outputCtx.drawImage(canvas, cropLeft, cropTop, output.width, output.height, 0, 0, output.width, output.height);
  return output;
}

function drawWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: { zoom: number; panX: number; panY: number },
  textures: TextureCache
) {
  ctx.fillStyle = "#1f3519";
  ctx.fillRect(0, 0, width, height);
  const topLeft = screenToWorld(0, 0, viewport);
  const bottomRight = screenToWorld(width, height, viewport);
  const startX = Math.max(0, Math.floor(topLeft.x / TILE_SIZE) * TILE_SIZE);
  const startY = Math.max(0, Math.floor(topLeft.y / TILE_SIZE) * TILE_SIZE);
  const endX = Math.min(WORLD.width, Math.ceil(bottomRight.x / TILE_SIZE) * TILE_SIZE);
  const endY = Math.min(WORLD.height, Math.ceil(bottomRight.y / TILE_SIZE) * TILE_SIZE);
  const center = WORLD.width / 2;

  for (let y = startY; y <= endY; y += TILE_SIZE) {
    for (let x = startX; x <= endX; x += TILE_SIZE) {
      const cx = x + TILE_SIZE / 2;
      const cy = y + TILE_SIZE / 2;
      const screen = worldToScreen(x, y, viewport);
      const road = isRoadTile(cx, cy, center);
      const hash = tileHash(cx, cy);
      const texture = road ? (hash % 3 === 0 ? textures.tiles.stoneAlt : textures.tiles.stone) : textures.tiles.grass;
      drawTile(ctx, texture, screen.x, screen.y, TILE_SIZE * viewport.zoom + 1, hash);
      if (road && hash % 4 === 0) {
        ctx.fillStyle = "rgba(242, 238, 246, 0.12)";
        ctx.fillRect(screen.x, screen.y, TILE_SIZE * viewport.zoom + 1, TILE_SIZE * viewport.zoom + 1);
      }
      if (!isRoadTile(cx, cy, center) && tileHash(cx, cy) % 5 === 0) {
        ctx.fillStyle = "rgba(243, 255, 211, 0.14)";
        ctx.fillRect(screen.x, screen.y, TILE_SIZE * viewport.zoom + 1, TILE_SIZE * viewport.zoom + 1);
      }
      if (viewport.zoom > 0.2) {
        ctx.strokeStyle = "rgba(22, 18, 10, 0.16)";
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x, screen.y, TILE_SIZE * viewport.zoom, TILE_SIZE * viewport.zoom);
      }
    }
  }
}

function drawTile(ctx: CanvasRenderingContext2D, texture: HTMLCanvasElement, x: number, y: number, size: number, hash: number) {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.scale(hash & 1 ? -1 : 1, hash & 2 ? -1 : 1);
  ctx.drawImage(texture, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function drawMapProps(
  ctx: CanvasRenderingContext2D,
  props: MapProp[],
  textures: TextureCache,
  viewport: { zoom: number; panX: number; panY: number },
  selectedId: string | null
) {
  const sorted = [...props].sort((a, b) => a.y + a.depthOffset - (b.y + b.depthOffset));
  for (const prop of sorted) {
    const texture = textures.props[prop.type];
    if (!texture) {
      continue;
    }
    const frame = getMapPropRenderFrame(prop);
    const x = frame.left * viewport.zoom + viewport.panX;
    const y = frame.top * viewport.zoom + viewport.panY;
    const shadow = getMapPropShadowFrame(prop);
    if (shadow) {
      ctx.globalAlpha = shadow.alpha;
      ctx.fillStyle = `#${shadow.color.toString(16).padStart(6, "0")}`;
      ctx.beginPath();
      ctx.ellipse(
        shadow.x * viewport.zoom + viewport.panX,
        shadow.y * viewport.zoom + viewport.panY,
        (shadow.width / 2) * viewport.zoom,
        (shadow.height / 2) * viewport.zoom,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(texture, x, y, frame.width * viewport.zoom, frame.height * viewport.zoom);
    if (prop.id === selectedId) {
      const issues = getPlacementIssues(prop, props);
      ctx.strokeStyle = issues.length ? "#ff6250" : "#ffe28c";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, frame.width * viewport.zoom + 4, frame.height * viewport.zoom + 4);
    }
  }
}

function drawPlacementOverlays(
  ctx: CanvasRenderingContext2D,
  props: MapProp[],
  viewport: { zoom: number; panX: number; panY: number },
  selectedId: string | null
) {
  const selected = selectedId ? props.find((prop) => prop.id === selectedId) : null;
  for (const prop of props) {
    if (!prop.collider) {
      continue;
    }
    const isSelected = prop.id === selectedId;
    ctx.save();
    ctx.globalAlpha = isSelected ? 0.92 : 0.16;
    ctx.strokeStyle = isSelected ? "#74e4ff" : "#1d1009";
    ctx.lineWidth = isSelected ? 2 : 1;
    drawCollider(ctx, prop.collider, viewport);
    ctx.restore();
  }

  if (!selected) {
    return;
  }

  const issues = getPlacementIssues(selected, props);
  const foot = getMapPropFootPoint(selected);
  const footScreen = worldToScreen(foot.x, foot.y, viewport);
  ctx.save();
  ctx.fillStyle = issues.length ? "rgba(255, 98, 80, 0.86)" : "rgba(116, 228, 255, 0.86)";
  ctx.strokeStyle = "#1d1009";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(footScreen.x, footScreen.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCollider(ctx: CanvasRenderingContext2D, collider: Collider, viewport: { zoom: number; panX: number; panY: number }) {
  const screen = worldToScreen(collider.x, collider.y, viewport);
  if (collider.kind === "circle") {
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, collider.radius * viewport.zoom, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  ctx.strokeRect(
    (collider.x - collider.width / 2) * viewport.zoom + viewport.panX,
    (collider.y - collider.height / 2) * viewport.zoom + viewport.panY,
    collider.width * viewport.zoom,
    collider.height * viewport.zoom
  );
}

function worldToScreen(x: number, y: number, viewport: { zoom: number; panX: number; panY: number }) {
  return { x: x * viewport.zoom + viewport.panX, y: y * viewport.zoom + viewport.panY };
}

function screenToWorld(x: number, y: number, viewport: { zoom: number; panX: number; panY: number }) {
  return { x: (x - viewport.panX) / viewport.zoom, y: (y - viewport.panY) / viewport.zoom };
}

function hitTestProp(
  screenX: number,
  screenY: number,
  props: MapProp[],
  viewport: { zoom: number; panX: number; panY: number },
  preferredId: string | null
) {
  const preferred = preferredId ? props.find((prop) => prop.id === preferredId) : null;
  if (preferred && isPropHit(screenX, screenY, preferred, viewport)) {
    return preferred;
  }

  for (const prop of [...props].sort((a, b) => b.y + b.depthOffset - (a.y + a.depthOffset))) {
    if (isPropHit(screenX, screenY, prop, viewport)) {
      return prop;
    }
  }
  return null;
}

function isPropHit(screenX: number, screenY: number, prop: MapProp, viewport: { zoom: number; panX: number; panY: number }) {
  const bounds = getMapPropVisualBounds(prop);
  const left = bounds.left * viewport.zoom + viewport.panX;
  const top = bounds.top * viewport.zoom + viewport.panY;
  const right = bounds.right * viewport.zoom + viewport.panX;
  const bottom = bounds.bottom * viewport.zoom + viewport.panY;
  return screenX >= left && screenX <= right && screenY >= top && screenY <= bottom;
}

function makeCollider(asset: MapPropCatalogEntry, x: number, y: number, width: number, height: number): Collider | undefined {
  if (asset.collider === "none") {
    return undefined;
  }
  if (asset.collider === "circle") {
    return { kind: "circle", x, y: y + Math.round(height * asset.footOffsetY), radius: Math.round(Math.min(width, height) * 0.24) };
  }
  return { kind: "rect", x, y: y + Math.round(height * asset.footOffsetY), width: Math.round(width * 0.74), height: Math.round(height * 0.22) };
}

function getPlacementIssues(prop: MapProp, props: MapProp[]) {
  const issues: string[] = [];
  const foot = getMapPropFootPoint(prop);
  if (ROAD_WARNING_TYPES.has(prop.type) && isRoadTile(foot.x, foot.y, WORLD.width / 2)) {
    issues.push("Placed on road");
  }
  if (ROAD_WARNING_TYPES.has(prop.type) && groundedPropTouchesRoadEdge(prop)) {
    issues.push("Touches road edge");
  }

  const overlaps = props.filter((candidate) => candidate.id !== prop.id && propsOverlap(prop, candidate));
  if (overlaps.length > 0) {
    issues.push(`Overlaps ${overlaps.length} prop${overlaps.length === 1 ? "" : "s"}`);
  }

  const frame = getMapPropRenderFrame(prop);
  if (frame.left < 0 || frame.left + frame.width > WORLD.width || frame.top < 0 || frame.top + frame.height > WORLD.height) {
    issues.push("Outside world bounds");
  }

  return issues;
}

function groundedPropTouchesRoadEdge(prop: MapProp) {
  const bounds = getMapPropVisualBounds(prop);
  const foot = getMapPropFootPoint(prop);
  const usableLeft = bounds.left - ROAD_CLEARANCE_MARGIN;
  const usableRight = bounds.right + ROAD_CLEARANCE_MARGIN;
  const span = Math.max(1, usableRight - usableLeft);

  for (let index = 0; index < ROAD_CLEARANCE_SAMPLE_COUNT; index += 1) {
    const t = index / (ROAD_CLEARANCE_SAMPLE_COUNT - 1);
    const x = usableLeft + span * t;
    for (const y of [foot.y - ROAD_CLEARANCE_SAMPLE_OFFSET, foot.y, foot.y + ROAD_CLEARANCE_SAMPLE_OFFSET]) {
      if (isRoadTile(x, y, WORLD.width / 2)) {
        return true;
      }
    }
  }

  return false;
}

function propsOverlap(a: MapProp, b: MapProp) {
  if (a.collider && b.collider) {
    return collidersOverlap(a.collider, b.collider);
  }

  const aBounds = getMapPropVisualBounds(a);
  const bBounds = getMapPropVisualBounds(b);
  return !(aBounds.right < bBounds.left || aBounds.left > bBounds.right || aBounds.bottom < bBounds.top || aBounds.top > bBounds.bottom);
}

function collidersOverlap(a: Collider, b: Collider) {
  if (a.kind === "circle" && b.kind === "circle") {
    return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
  }
  if (a.kind === "circle" && b.kind === "rect") {
    return circleRectOverlap(a, b);
  }
  if (a.kind === "rect" && b.kind === "circle") {
    return circleRectOverlap(b, a);
  }
  if (a.kind === "rect" && b.kind === "rect") {
    return !(
      a.x + a.width / 2 < b.x - b.width / 2 ||
      a.x - a.width / 2 > b.x + b.width / 2 ||
      a.y + a.height / 2 < b.y - b.height / 2 ||
      a.y - a.height / 2 > b.y + b.height / 2
    );
  }
  return false;
}

function circleRectOverlap(circle: Extract<Collider, { kind: "circle" }>, rect: Extract<Collider, { kind: "rect" }>) {
  const closestX = clamp(circle.x, rect.x - rect.width / 2, rect.x + rect.width / 2);
  const closestY = clamp(circle.y, rect.y - rect.height / 2, rect.y + rect.height / 2);
  return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.radius;
}

function moveCollider(collider: Collider | undefined, nextX: number, nextY: number, previousX: number, previousY: number): Collider | undefined {
  if (!collider) {
    return undefined;
  }
  return {
    ...collider,
    x: collider.x + nextX - previousX,
    y: collider.y + nextY - previousY
  };
}

function resizeProp(prop: MapProp, width: number, height: number): Partial<MapProp> {
  const asset = MAP_PROP_CATALOG_BY_TYPE[prop.type];
  return {
    width,
    height,
    collider: makeCollider(asset, prop.x, prop.y, width, height)
  };
}

function formatPropsForExport(props: MapProp[]) {
  return `export const MAP_PROPS: MapProp[] = ${JSON.stringify(props, null, 2)};`;
}

function isRoadTile(x: number, y: number, center: number) {
  const dx = x - center;
  const dy = y - center;
  const distanceFromCenter = Math.hypot(dx, dy);
  return (
    distanceFromCenter < 720 ||
    Math.abs(x - center) < 155 ||
    Math.abs(y - center) < 155 ||
    (Math.abs(distanceFromCenter - 1700) < 110 && Math.abs(dx) < 2050 && Math.abs(dy) < 2050) ||
    (Math.abs(Math.abs(dx) - Math.abs(dy)) < 95 && distanceFromCenter > 780 && distanceFromCenter < 2350) ||
    (Math.abs(y - WORLD.height * 0.22) < 90 && x > 720 && x < WORLD.width - 720) ||
    (Math.abs(y - WORLD.height * 0.78) < 90 && x > 720 && x < WORLD.width - 720) ||
    (Math.abs(x - WORLD.width * 0.22) < 90 && y > 720 && y < WORLD.height - 720) ||
    (Math.abs(x - WORLD.width * 0.78) < 90 && y > 720 && y < WORLD.height - 720)
  );
}

function tileHash(x: number, y: number) {
  const gx = Math.floor(x / TILE_SIZE);
  const gy = Math.floor(y / TILE_SIZE);
  return Math.abs(Math.imul(gx + 17, 73856093) ^ Math.imul(gy + 31, 19349663));
}

function snapValue(value: number) {
  return Math.round(value / SNAP_STEP) * SNAP_STEP;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
