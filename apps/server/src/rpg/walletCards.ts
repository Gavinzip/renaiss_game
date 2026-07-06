const RENAISS_COLLECTIBLE_LIST_URL = "https://www.renaiss.xyz/api/trpc/collectible.list";
const DEFAULT_WALLET_PAGE_LIMIT = 100;
const DEFAULT_WALLET_MAX_OFFSET = 5_000;
const DEFAULT_WALLET_PAGE_BATCH_SIZE = 10;
const WALLET_CACHE_TTL_MS = 10 * 60_000;
const walletCache = new Map<string, { expiresAt: number; result: RpgWalletCollectiblesResult }>();

interface RenaissAttributeRow {
  trait?: unknown;
  trait_type?: unknown;
  value?: unknown;
}

interface RenaissCollectibleRow {
  id?: unknown;
  tokenId?: unknown;
  tokenID?: unknown;
  name?: unknown;
  collectibleName?: unknown;
  title?: unknown;
  cardName?: unknown;
  pokemonName?: unknown;
  setName?: unknown;
  collectionName?: unknown;
  seriesName?: unknown;
  cardNumber?: unknown;
  category?: unknown;
  rarity?: unknown;
  frontImageUrl?: unknown;
  imageUrl?: unknown;
  collectibleImageUrl?: unknown;
  fmvPriceInUSD?: unknown;
  fmvPriceInUsd?: unknown;
  fmv?: unknown;
  value?: unknown;
  price?: unknown;
  ownerAddress?: unknown;
  attributes?: unknown;
  year?: unknown;
  language?: unknown;
  genre?: unknown;
  gradingCompany?: unknown;
  grader?: unknown;
  grade?: unknown;
}

interface RenaissCollectibleListResult {
  collection?: unknown;
  collectibles?: unknown;
  data?: unknown;
  pagination?: {
    hasMore?: unknown;
    limit?: unknown;
    total?: unknown;
    offset?: unknown;
  };
}

export interface RpgWalletCollectible {
  id: string;
  tokenId: string;
  name: string;
  pokemonName: string;
  setName: string;
  cardNumber: string;
  year: string;
  language: string;
  ownerAddress: string;
  fmvUSD: number;
  imageUrl: string;
  attributes: Array<{ trait: string; value: string }>;
  attributeCandidates: {
    category: string | null;
    genre: string | null;
    gradingCompany: string | null;
    grade: string | null;
    rarity: string | null;
  };
}

export interface RpgWalletCollectiblesResult {
  success: boolean;
  reason: string | null;
  walletAddress: string;
  source: string;
  fallbackUsed: boolean;
  collectibleCount: number;
  totalFMV: number;
  scannedRows: number;
  collectibles: RpgWalletCollectible[];
  cached?: boolean;
  stale?: boolean;
  staleReason?: string;
  error?: string;
}

function stringValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizeWalletAddress(walletAddress: unknown) {
  return String(walletAddress || "").toLowerCase().trim();
}

function isValidWalletAddress(walletAddress: string) {
  return /^0x[a-f0-9]{40}$/.test(walletAddress);
}

function parseFmvUSD(card: RenaissCollectibleRow) {
  const fmvCent = Number(card.fmvPriceInUSD ?? card.fmvPriceInUsd);
  if (Number.isFinite(fmvCent) && fmvCent >= 0) return fmvCent / 100;

  const legacyValue = Number(card.fmv ?? card.value ?? card.price ?? 0);
  return Number.isFinite(legacyValue) ? legacyValue : 0;
}

function normalizeAttributes(attributes: unknown): Array<{ trait: string; value: string }> {
  if (!Array.isArray(attributes)) return [];
  return attributes.flatMap((attribute): Array<{ trait: string; value: string }> => {
    if (!attribute || typeof attribute !== "object") return [];
    const row = attribute as RenaissAttributeRow;
    const trait = stringValue(row.trait ?? row.trait_type);
    const value = stringValue(row.value);
    return trait && value ? [{ trait, value }] : [];
  });
}

function attributeValue(attributes: readonly { trait: string; value: string }[], trait: string) {
  const wanted = trait.toLowerCase();
  return attributes.find((attribute) => attribute.trait.toLowerCase() === wanted)?.value ?? "";
}

function extractRows(result: RenaissCollectibleListResult) {
  const rows = result.collection ?? result.collectibles ?? result.data;
  return Array.isArray(rows) ? rows.filter((row): row is RenaissCollectibleRow => Boolean(row && typeof row === "object")) : [];
}

function dedupeRows(rows: readonly RenaissCollectibleRow[]) {
  const map = new Map<string, RenaissCollectibleRow>();
  for (const row of rows) {
    const key = stringValue(row.tokenId ?? row.tokenID) || stringValue(row.id) || `${normalizeWalletAddress(row.ownerAddress)}:${map.size}`;
    if (key && !map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function normalizeCollectible(card: RenaissCollectibleRow): RpgWalletCollectible {
  const attributes = normalizeAttributes(card.attributes);
  const attr = (trait: string) => attributeValue(attributes, trait);
  const tokenId = stringValue(card.tokenId ?? card.tokenID);
  const name = stringValue(card.name ?? card.collectibleName ?? card.title);
  const setName = stringValue(card.setName ?? card.collectionName ?? card.seriesName ?? attr("Set"));
  const cardNumber = stringValue(card.cardNumber ?? attr("Card Number")).replace(/^#/, "");
  const category = stringValue(card.category ?? attr("Category"));
  const rarity = stringValue(card.rarity ?? attr("Rarity"));
  const imageUrl = stringValue(card.frontImageUrl ?? card.imageUrl ?? card.collectibleImageUrl);

  return {
    id: stringValue(card.id),
    tokenId,
    name: name || (tokenId ? `Token #${tokenId}` : "Unknown Collectible"),
    pokemonName: stringValue(card.pokemonName ?? card.cardName ?? name),
    setName,
    cardNumber,
    year: stringValue(card.year ?? attr("Year")),
    language: stringValue(card.language ?? attr("Language")),
    ownerAddress: normalizeWalletAddress(card.ownerAddress),
    fmvUSD: Number(parseFmvUSD(card).toFixed(2)),
    imageUrl,
    attributes,
    attributeCandidates: {
      category: category || null,
      genre: stringValue(card.genre ?? attr("Genre")) || null,
      gradingCompany: stringValue(card.gradingCompany ?? card.grader ?? attr("Grader")) || null,
      grade: stringValue(card.grade ?? attr("Grade")) || null,
      rarity: rarity || null
    }
  };
}

async function trpcCollectibleList(queryPayload: Record<string, unknown>) {
  const inputJson = JSON.stringify({ 0: { json: queryPayload } });
  const url = `${RENAISS_COLLECTIBLE_LIST_URL}?batch=1&input=${encodeURIComponent(inputJson)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  if (!response.ok) {
    throw new Error(`collectible.list HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  const root = Array.isArray(data) ? data[0] : data;
  if (!root || typeof root !== "object") throw new Error("collectible.list empty response");
  const payload = root as { error?: { json?: { message?: string }; message?: string }; result?: { data?: { json?: unknown } } };
  if (payload.error) {
    throw new Error(payload.error.json?.message ?? payload.error.message ?? "collectible.list error");
  }
  const result = payload.result?.data?.json;
  if (!result || typeof result !== "object") throw new Error("collectible.list missing result json");
  return result as RenaissCollectibleListResult;
}

export async function fetchWalletCollectibles(walletAddress: string, options: { force?: boolean } = {}): Promise<RpgWalletCollectiblesResult> {
  const wallet = normalizeWalletAddress(walletAddress);
  if (!isValidWalletAddress(wallet)) {
    return {
      success: false,
      reason: "invalid_wallet_address",
      walletAddress: wallet,
      source: "renaiss_collectible_list",
      fallbackUsed: false,
      collectibleCount: 0,
      totalFMV: 0,
      scannedRows: 0,
      collectibles: []
    };
  }

  const cached = walletCache.get(wallet);
  if (!options.force && cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, cached: true };
  }

  const limit = Math.max(10, Math.min(100, Number(process.env.RPG_WALLET_PAGE_LIMIT || DEFAULT_WALLET_PAGE_LIMIT)));
  const maxOffset = Math.max(limit, Number(process.env.RPG_WALLET_MAX_OFFSET || DEFAULT_WALLET_MAX_OFFSET));
  const batchSize = Math.max(1, Math.min(10, Number(process.env.RPG_WALLET_PAGE_BATCH_SIZE || DEFAULT_WALLET_PAGE_BATCH_SIZE)));
  const matchedRows: RenaissCollectibleRow[] = [];
  let scannedRows = 0;
  let shouldStop = false;

  try {
    for (let batchStart = 0; batchStart <= maxOffset && !shouldStop; batchStart += limit * batchSize) {
      const offsets = Array.from({ length: batchSize }, (_, index) => batchStart + index * limit).filter((offset) => offset <= maxOffset);
      const results = await Promise.all(
        offsets.map((offset) =>
          trpcCollectibleList({
            address: wallet,
            filter: "all",
            isHolding: true,
            limit,
            offset,
            sortBy: "mintDate",
            sortOrder: "desc",
            includeOpenCardPackRecords: true
          })
        )
      );

      for (const result of results) {
        const rows = extractRows(result);
        scannedRows += rows.length;
        matchedRows.push(...rows.filter((row) => normalizeWalletAddress(row.ownerAddress) === wallet));
        if (!result.pagination?.hasMore || rows.length === 0) shouldStop = true;
      }
    }
  } catch (error) {
    return {
      success: false,
      reason: "wallet_collection_fetch_failed",
      error: error instanceof Error ? error.message : String(error),
      walletAddress: wallet,
      source: "renaiss_collectible_list",
      fallbackUsed: false,
      collectibleCount: 0,
      totalFMV: 0,
      scannedRows,
      collectibles: []
    };
  }

  const collectibles = dedupeRows(matchedRows).map(normalizeCollectible).sort((a, b) => b.fmvUSD - a.fmvUSD || a.name.localeCompare(b.name));

  const result: RpgWalletCollectiblesResult = {
    success: true,
    reason: null,
    walletAddress: wallet,
    source: "renaiss_collectible_list_owner_address_scan",
    fallbackUsed: false,
    collectibleCount: collectibles.length,
    totalFMV: Number(collectibles.reduce((sum, card) => sum + card.fmvUSD, 0).toFixed(2)),
    scannedRows,
    collectibles
  };
  walletCache.set(wallet, { expiresAt: Date.now() + WALLET_CACHE_TTL_MS, result });
  return result;
}
