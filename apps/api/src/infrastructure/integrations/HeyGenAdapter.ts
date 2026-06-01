import type { CompositeSecretsProvider } from "../secrets/CompositeSecretsProvider.js";

export interface HeyGenVideoInput {
  scriptText: string;
  avatarId?: string;
  voiceId?: string;
  backgroundUrl?: string;
  width?: number;
  height?: number;
}

export interface HeyGenVideoResult {
  videoId: string;
  videoUrl: string;
  durationSeconds?: number;
  status: "completed" | "processing";
}

/**
 * SPEC-08: HeyGen v2 adapter — tutorial de entrega do site (~2-3 min, avatar pt-BR).
 * API key stored in secrets as "HEYGEN_API_KEY".
 */
export class HeyGenAdapter {
  private readonly baseUrl = "https://api.heygen.com/v2";
  private readonly DEFAULT_AVATAR_ID = "Angela-inblackskin-20220820"; // pt-BR compatible
  private readonly DEFAULT_VOICE_ID = "pt_BR_female_1";

  constructor(private readonly secrets: CompositeSecretsProvider) {}

  private async apiKey(): Promise<string> {
    const key = await this.secrets.get("HEYGEN_API_KEY");
    if (!key) throw new Error("HEYGEN_API_KEY not configured in settings");
    return key;
  }

  async generateTutorial(input: HeyGenVideoInput): Promise<HeyGenVideoResult> {
    const apiKey = await this.apiKey();

    const body = {
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: input.avatarId ?? this.DEFAULT_AVATAR_ID,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: input.scriptText,
            voice_id: input.voiceId ?? this.DEFAULT_VOICE_ID,
            speed: 1.0,
          },
          background: input.backgroundUrl
            ? { type: "image", url: input.backgroundUrl }
            : { type: "color", value: "#FFFFFF" },
        },
      ],
      dimension: {
        width: input.width ?? 1280,
        height: input.height ?? 720,
      },
      aspect_ratio: null,
    };

    const res = await fetch(`${this.baseUrl}/video/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HeyGen error [${res.status}]: ${text}`);
    }

    const data = (await res.json()) as { data: { video_id: string } };
    const videoId = data.data.video_id;

    // Poll until complete (max 10 min for a 3-min video)
    return this.pollVideo(apiKey, videoId);
  }

  private async pollVideo(
    apiKey: string,
    videoId: string,
  ): Promise<HeyGenVideoResult> {
    const maxAttempts = 60;
    let attempt = 0;

    while (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 10_000)); // 10s intervals
      attempt++;

      const res = await fetch(
        `${this.baseUrl}/video_status.get?video_id=${videoId}`,
        {
          headers: { "X-Api-Key": apiKey },
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!res.ok) continue;

      const data = (await res.json()) as {
        data: { status: string; video_url?: string; duration?: number };
      };

      const { status, video_url, duration } = data.data;

      if (status === "completed" && video_url) {
        return {
          videoId,
          videoUrl: video_url,
          durationSeconds: duration,
          status: "completed",
        };
      }

      if (status === "failed") {
        throw new Error(`HeyGen video ${videoId} generation failed`);
      }
    }

    // Timed out — return processing status so caller can retry/poll
    return { videoId, videoUrl: "", status: "processing" };
  }
}
