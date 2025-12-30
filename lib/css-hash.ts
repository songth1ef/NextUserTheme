import CryptoJS from "crypto-js";

export function computeSha256Hex(input: string): string {
  const normalized = typeof input === "string" ? input : String(input);
  const hash = CryptoJS.SHA256(normalized);
  return hash.toString(CryptoJS.enc.Hex);
}

