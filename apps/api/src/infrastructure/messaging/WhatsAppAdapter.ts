import { config } from "../../config.js";

export interface WhatsAppMessagePayload {
  instanceName: string;
  remoteJid: string; // The recipient's phone number with country code + @s.whatsapp.net
  text: string;
}

export interface WhatsAppMediaPayload extends WhatsAppMessagePayload {
  media: string; // Base64 encoded media or URL
  mediatype: "image" | "video" | "audio" | "document";
  fileName?: string;
}

/**
 * WhatsApp Adapter using Evolution API.
 * This adapter uses the standard Node.js fetch API to communicate with Evolution.
 */
export class WhatsAppAdapter {
  private get baseUrl(): string {
    if (!config.EVOLUTION_API_URL)
      throw new Error("EVOLUTION_API_URL is not configured.");
    return config.EVOLUTION_API_URL.replace(/\/$/, "");
  }

  private get headers(): Record<string, string> {
    if (!config.EVOLUTION_API_KEY)
      throw new Error("EVOLUTION_API_KEY is not configured.");
    return {
      "Content-Type": "application/json",
      apikey: config.EVOLUTION_API_KEY,
    };
  }

  /**
   * Sends a simple text message.
   */
  async sendText(
    payload: WhatsAppMessagePayload,
  ): Promise<{ messageId: string }> {
    const url = `${this.baseUrl}/message/sendText/${payload.instanceName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        number: payload.remoteJid,
        options: {
          delay: 1200, // humanize delay
          presence: "composing", // shows "typing..."
        },
        textMessage: {
          text: payload.text,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Evolution API Error [${response.status}]: ${err}`);
    }

    const data = (await response.json()) as any;
    return { messageId: data.key?.id || "unknown" };
  }

  /**
   * Sends a media message (image, video, document).
   */
  async sendMedia(
    payload: WhatsAppMediaPayload,
  ): Promise<{ messageId: string }> {
    const url = `${this.baseUrl}/message/sendMedia/${payload.instanceName}`;

    const response = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        number: payload.remoteJid,
        options: {
          delay: 1200,
          presence: "composing",
        },
        mediaMessage: {
          mediatype: payload.mediatype,
          caption: payload.text,
          media: payload.media,
          fileName: payload.fileName || "file",
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Evolution API Error [${response.status}]: ${err}`);
    }

    const data = (await response.json()) as any;
    return { messageId: data.key?.id || "unknown" };
  }

  /**
   * Checks connection status of an instance.
   */
  async checkInstanceStatus(
    instanceName: string,
  ): Promise<{ state: string; isConnected: boolean }> {
    const url = `${this.baseUrl}/instance/connectionState/${instanceName}`;

    const response = await fetch(url, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      return { state: "UNKNOWN", isConnected: false };
    }

    const data = (await response.json()) as any;
    const state = data?.instance?.state || "UNKNOWN";
    return {
      state,
      isConnected: state === "open",
    };
  }
}
