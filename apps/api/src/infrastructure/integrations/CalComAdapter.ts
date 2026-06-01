import type { CompositeSecretsProvider } from "../secrets/CompositeSecretsProvider.js";

export interface CalComBookingInput {
  eventTypeId: number;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  startTime: string; // ISO 8601
  timeZone?: string;
}

export interface CalComBookingResult {
  bookingId: number;
  uid: string;
  bookingLink: string;
  startTime: string;
  endTime: string;
}

/**
 * Cal.com v2 adapter — schedules meetings via the API.
 * API key stored in secrets under key "CALCOM_API_KEY".
 */
export class CalComAdapter {
  private readonly baseUrl = "https://api.cal.com/v2";

  constructor(private readonly secrets: CompositeSecretsProvider) {}

  private async apiKey(): Promise<string> {
    const key = await this.secrets.get("CALCOM_API_KEY");
    if (!key) throw new Error("CALCOM_API_KEY not configured in settings");
    return key;
  }

  async scheduleBooking(
    input: CalComBookingInput,
  ): Promise<CalComBookingResult> {
    const apiKey = await this.apiKey();

    const body = {
      eventTypeId: input.eventTypeId,
      attendee: {
        name: input.name,
        email: input.email,
        timeZone: input.timeZone ?? "America/Sao_Paulo",
        language: "pt-BR",
      },
      start: input.startTime,
      metadata: {
        phone: input.phone ?? "",
        notes: input.notes ?? "",
      },
    };

    const res = await fetch(`${this.baseUrl}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": "2024-08-13",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CalCom error [${res.status}]: ${text}`);
    }

    const data = (await res.json()) as {
      status: string;
      data: {
        id: number;
        uid: string;
        start: string;
        end: string;
      };
    };

    const booking = data.data;
    return {
      bookingId: booking.id,
      uid: booking.uid,
      bookingLink: `https://cal.com/booking/${booking.uid}`,
      startTime: booking.start,
      endTime: booking.end,
    };
  }
}
