export interface RpgWalletCard {
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

export interface RpgWalletCardsResponse {
  success: boolean;
  reason: string | null;
  walletAddress: string;
  source: string;
  fallbackUsed: boolean;
  cached?: boolean;
  stale?: boolean;
  staleReason?: string;
  cachedAt?: number;
  collectibleCount: number;
  totalFMV: number;
  scannedRows: number;
  collectibles: RpgWalletCard[];
  profileDb?: string;
  cardSkillBindings?: Record<string, string>;
  petCardLoadouts?: Record<string, string[]>;
  error?: string;
}

export const RPG_DEFAULT_WALLET_ADDRESS = "0xef6c52085d12397c37652c4918036c1492fcf7a6";

export interface RpgWalletCardSkillDrawResponse {
  success: boolean;
  alreadyBound?: boolean;
  reason?: string;
  message?: string;
  cardSkillBindings: Record<string, string>;
  petCardLoadouts: Record<string, string[]>;
  entry: {
    id: string;
    ticketId: string;
    ticketLabel: string;
    createdAt: number;
    moves: Array<{ id: string }>;
  };
}

export interface RpgPetCardLoadoutResponse {
  success: boolean;
  reason?: string;
  message?: string;
  petCardLoadouts: Record<string, string[]>;
}

export async function fetchRpgWalletCards(walletAddress: string, force = false) {
  const refreshQuery = force ? "?refresh=1" : "";
  const response = await fetch(`${gameServerUrl()}/api/rpg/wallet-cards/${encodeURIComponent(walletAddress)}${refreshQuery}`);
  const payload = (await response.json()) as RpgWalletCardsResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? payload.reason ?? "Unable to fetch wallet cards.");
  }
  return payload;
}

export async function drawRpgWalletCardSkill(walletAddress: string, cardId: string) {
  const response = await fetch(`${gameServerUrl()}/api/rpg/wallet-cards/${encodeURIComponent(walletAddress)}/draw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId })
  });
  const payload = (await response.json()) as RpgWalletCardSkillDrawResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? payload.reason ?? "Unable to draw wallet card skill.");
  }
  return payload;
}

export async function equipRpgWalletCard(walletAddress: string, petId: string, cardId: string) {
  const response = await fetch(`${gameServerUrl()}/api/rpg/pet-card-loadouts/${encodeURIComponent(walletAddress)}/equip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ petId, cardId })
  });
  const payload = (await response.json()) as RpgPetCardLoadoutResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? payload.reason ?? "Unable to equip wallet card.");
  }
  return payload;
}

export async function unequipRpgWalletCard(walletAddress: string, petId: string, cardId: string) {
  const response = await fetch(`${gameServerUrl()}/api/rpg/pet-card-loadouts/${encodeURIComponent(walletAddress)}/unequip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ petId, cardId })
  });
  const payload = (await response.json()) as RpgPetCardLoadoutResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message ?? payload.reason ?? "Unable to unequip wallet card.");
  }
  return payload;
}
import { gameServerUrl } from "./gameServer";
