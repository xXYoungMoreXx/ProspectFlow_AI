import { config } from "../../config.js";

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface TelegramPayload {
  chatId?: string;
  text: string;
  parseMode?: "Markdown" | "HTML";
  disableNotification?: boolean;
  inlineKeyboard?: InlineKeyboardButton[][];
}

export interface EditMessagePayload {
  chatId: string | number;
  messageId: number;
  text: string;
  parseMode?: "Markdown" | "HTML";
  inlineKeyboard?: InlineKeyboardButton[][];
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  result?: { message_id: number };
}

/**
 * Telegram Adapter using Telegram Bot HTTP API.
 * Uses native Node.js fetch to avoid extra dependencies.
 */
export class TelegramAdapter {
  private get baseUrl(): string {
    if (!config.TELEGRAM_BOT_TOKEN)
      throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
    return `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`;
  }

  /**
   * Sends a message to a Telegram chat.
   * Optionally includes inline keyboard buttons for HITL actions.
   */
  async sendMessage(payload: TelegramPayload): Promise<{ messageId: number }> {
    const chatId = payload.chatId || config.TELEGRAM_CHAT_ID;
    if (!chatId) {
      throw new Error("Target Chat ID is required (via payload or config.TELEGRAM_CHAT_ID).");
    }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: payload.text,
      parse_mode: payload.parseMode || "HTML",
      disable_notification: payload.disableNotification || false,
    };

    if (payload.inlineKeyboard) {
      body["reply_markup"] = { inline_keyboard: payload.inlineKeyboard };
    }

    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Telegram API Error [${response.status}]: ${errText}`);
    }

    const data = await response.json() as TelegramApiResponse;
    if (!data.ok) {
      throw new Error(`Telegram API Error: ${data.description}`);
    }

    return { messageId: data.result!.message_id };
  }

  /**
   * Answers a callback query to dismiss the loading state on the inline button.
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    const body: Record<string, unknown> = {
      callback_query_id: callbackQueryId,
    };
    if (text) body["text"] = text;

    const response = await fetch(`${this.baseUrl}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Telegram answerCallbackQuery Error [${response.status}]: ${errText}`);
    }
  }

  /**
   * Edits the text (and optionally the inline keyboard) of a sent message.
   */
  async editMessageText(payload: EditMessagePayload): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: payload.chatId,
      message_id: payload.messageId,
      text: payload.text,
      parse_mode: payload.parseMode || "HTML",
    };

    if (payload.inlineKeyboard) {
      body["reply_markup"] = { inline_keyboard: payload.inlineKeyboard };
    } else {
      // Clear reply markup
      body["reply_markup"] = { inline_keyboard: [] };
    }

    const response = await fetch(`${this.baseUrl}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Telegram editMessageText Error [${response.status}]: ${errText}`);
    }

    const data = await response.json() as TelegramApiResponse;
    if (!data.ok) {
      throw new Error(`Telegram editMessageText Error: ${data.description}`);
    }
  }
}
