"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

function VerifyEmailContent() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    !token ? "error" : "loading",
  );
  const [errorMessage, setErrorMessage] = useState(
    !token ? t("verifyEmail.errors.noToken") : "",
  );

  useEffect(() => {
    if (!token) return;

    const verifyToken = async () => {
      try {
        await api.auth.verifyEmail(token);
        setStatus("success");
      } catch (err: unknown) {
        setStatus("error");
        const apiErr = err as { errors?: Array<{ message?: string }> };
        setErrorMessage(
          apiErr.errors?.[0]?.message ?? t("verifyEmail.errors.failed"),
        );
      }
    };

    verifyToken();
  }, [token, t]);

  return (
    <Card className="w-full max-w-md mx-4 border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl">
      <CardContent className="pt-6 text-center space-y-4">
        {status === "loading" && (
          <>
            <div className="mx-auto flex items-center justify-center w-16 h-16">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <CardTitle>{t("verifyEmail.loading")}</CardTitle>
            <CardDescription>{t("verifyEmail.loadingMessage")}</CardDescription>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <CardTitle>{t("verifyEmail.success.title")}</CardTitle>
            <CardDescription>
              {t("verifyEmail.success.message")}
            </CardDescription>
            <div className="pt-4 flex">
              <Link
                href="/login"
                className={buttonVariants({
                  variant: "default",
                  className: "w-full",
                })}
              >
                {t("verifyEmail.success.goToLogin")}
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive">
              <XCircle className="w-8 h-8" />
            </div>
            <CardTitle>{t("verifyEmail.errors.title")}</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
            <div className="pt-4 flex">
              <Link
                href="/login"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                {t("verifyEmail.errors.backToLogin")}
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <Suspense
        fallback={<Loader2 className="w-8 h-8 animate-spin text-primary" />}
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
