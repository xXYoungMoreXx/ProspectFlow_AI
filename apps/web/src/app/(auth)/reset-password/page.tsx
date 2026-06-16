"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

function ResetPasswordForm() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <Card className="w-full max-w-md mx-4 border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="w-8 h-8" />
          </div>
          <CardTitle>{t("resetPassword.errors.invalidToken.title")}</CardTitle>
          <CardDescription>
            {t("resetPassword.errors.invalidToken.message")}
          </CardDescription>
          <div className="pt-4 flex">
            <Link
              href="/forgot-password"
              className={buttonVariants({
                variant: "default",
                className: "w-full",
              })}
            >
              {t("resetPassword.errors.invalidToken.requestNew")}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("resetPassword.errors.passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      await api.auth.resetPassword({ token, password, confirmPassword });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errors[0]?.message || t("resetPassword.errors.generic"));
      } else {
        setError(t("resetPassword.errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-md mx-4 border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <CardTitle>{t("resetPassword.success.title")}</CardTitle>
          <CardDescription>
            {t("resetPassword.success.message")}
          </CardDescription>
          <div className="pt-4 flex">
            <Link
              href="/login"
              className={buttonVariants({
                variant: "default",
                className: "w-full",
              })}
            >
              {t("resetPassword.success.goToLogin")}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-4 border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl z-10">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("resetPassword.title")}
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-1">
            {t("resetPassword.subtitle")}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">{t("resetPassword.newPassword")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("resetPassword.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t("resetPassword.confirmPassword")}
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("resetPassword.passwordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11"
            />
          </div>

          <button
            type="submit"
            className={buttonVariants({
              variant: "default",
              className: "w-full h-11 font-medium",
            })}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("resetPassword.submitting")}
              </>
            ) : (
              t("resetPassword.submit")
            )}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <Suspense
        fallback={<Loader2 className="w-8 h-8 animate-spin text-primary" />}
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
