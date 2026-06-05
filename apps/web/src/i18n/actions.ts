"use server";

import { cookies } from "next/headers";
import { locales } from "./config";

export async function setLocale(locale: string): Promise<void> {
  if (!locales.includes(locale as never)) return;
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });
}
