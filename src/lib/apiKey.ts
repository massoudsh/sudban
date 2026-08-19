import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const PREFIX_LENGTH = 12; // شامل "sk_live_" + ۴ کاراکتر تصادفی اول برای جست‌وجوی سریع
const BCRYPT_ROUNDS = 10;

/**
 * یک کلید API جدید تولید می‌کند و پیشوند + هش آن را برای ذخیره در دیتابیس برمی‌گرداند.
 * خود کلید (apiKey) فقط یک‌بار در لحظه ساخت به کاربر نمایش داده می‌شود و هرگز ذخیره نمی‌شود.
 */
export async function generateApiKey(): Promise<{
  apiKey: string;
  apiKeyPrefix: string;
  apiKeyHash: string;
}> {
  const apiKey = `sk_live_${randomBytes(24).toString("hex")}`;
  const apiKeyPrefix = apiKey.slice(0, PREFIX_LENGTH);
  const apiKeyHash = await bcrypt.hash(apiKey, BCRYPT_ROUNDS);
  return { apiKey, apiKeyPrefix, apiKeyHash };
}

export function extractApiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, PREFIX_LENGTH);
}

export async function verifyApiKey(apiKey: string, apiKeyHash: string): Promise<boolean> {
  return bcrypt.compare(apiKey, apiKeyHash);
}
