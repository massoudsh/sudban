import { Seller } from "@prisma/client";
import { RiskAlertCandidate } from "../types";

export interface AlertNotificationPayload {
  seller: Seller;
  productName: string;
  productSku: string;
  alerts: RiskAlertCandidate[];
}

interface NotificationChannel {
  name: string;
  isConfigured(seller: Seller): boolean;
  send(payload: AlertNotificationPayload): Promise<void>;
}

function formatMessage(payload: AlertNotificationPayload): string {
  const header = `⚠️ هشدار قیمت‌گذاری — ${payload.productName} (${payload.productSku})`;
  const lines = payload.alerts.map((a) => `• ${a.message}`);
  return [header, ...lines].join("\n");
}

/**
 * کانال تلگرام — از طریق Bot API. نیازمند TELEGRAM_BOT_TOKEN سراسری (سطح پلتفرم)
 * و telegramChatId اختصاصی هر فروشنده (از طریق PATCH /sellers/me/notifications).
 */
const telegramChannel: NotificationChannel = {
  name: "telegram",
  isConfigured: (seller) => Boolean(process.env.TELEGRAM_BOT_TOKEN && seller.telegramChatId),
  async send(payload) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: payload.seller.telegramChatId,
        text: formatMessage(payload),
      }),
    });
    if (!response.ok) {
      throw new Error(`Telegram API خطا داد: ${response.status} ${await response.text()}`);
    }
  },
};

/**
 * کانال ایمیل — از طریق یک وب‌هوک SMTP/ارسال ایمیل عمومی (مثلاً یک سرویس ترنزکشنال ایمیل).
 * نیازمند EMAIL_WEBHOOK_URL و اختیاری EMAIL_WEBHOOK_TOKEN در env سطح پلتفرم.
 * قرارداد: POST { to, subject, text } با هدر Authorization: Bearer <EMAIL_WEBHOOK_TOKEN> (در صورت تعریف).
 */
const emailChannel: NotificationChannel = {
  name: "email",
  isConfigured: (seller) =>
    Boolean(process.env.EMAIL_WEBHOOK_URL && (seller.notifyEmail || seller.email)),
  async send(payload) {
    const url = process.env.EMAIL_WEBHOOK_URL!;
    const token = process.env.EMAIL_WEBHOOK_TOKEN;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        to: payload.seller.notifyEmail || payload.seller.email,
        subject: `هشدار قیمت‌گذاری سودبان — ${payload.productName}`,
        text: formatMessage(payload),
      }),
    });
    if (!response.ok) {
      throw new Error(`وب‌هوک ایمیل خطا داد: ${response.status} ${await response.text()}`);
    }
  },
};

/**
 * کانال پیامک — آداپتور عمومی برای هر سرویس‌دهنده ایرانی که وب‌هوک JSON ساده بپذیرد
 * (مثل کاوه‌نگار/ملی‌پیامک با یک لایه نازک پروکسی). نیازمند SMS_WEBHOOK_URL و SMS_WEBHOOK_TOKEN.
 * قرارداد: POST { to, text } با هدر Authorization: Bearer <SMS_WEBHOOK_TOKEN>.
 */
const smsChannel: NotificationChannel = {
  name: "sms",
  isConfigured: (seller) => Boolean(process.env.SMS_WEBHOOK_URL && seller.notifyPhone),
  async send(payload) {
    const url = process.env.SMS_WEBHOOK_URL!;
    const token = process.env.SMS_WEBHOOK_TOKEN;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        to: payload.seller.notifyPhone,
        text: formatMessage(payload),
      }),
    });
    if (!response.ok) {
      throw new Error(`وب‌هوک پیامک خطا داد: ${response.status} ${await response.text()}`);
    }
  },
};

const CHANNELS: NotificationChannel[] = [telegramChannel, emailChannel, smsChannel];

/**
 * برای هر کانال پیکربندی‌شده روی این فروشنده تلاش برای ارسال می‌کند (best-effort، مستقل از هم).
 * خطای یک کانال باعث توقف بقیه نمی‌شود؛ فقط لاگ می‌شود تا پاسخ API کند/بلاک نشود.
 */
export async function notifyNewAlerts(payload: AlertNotificationPayload): Promise<void> {
  if (payload.alerts.length === 0) return;

  const configured = CHANNELS.filter((c) => c.isConfigured(payload.seller));
  if (configured.length === 0) return;

  await Promise.all(
    configured.map(async (channel) => {
      try {
        await channel.send(payload);
      } catch (err) {
        console.error(`ارسال هشدار از کانال ${channel.name} برای فروشنده ${payload.seller.id} ناموفق بود:`, err);
      }
    })
  );
}
