"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button, buttonVariants } from "@/components/ui/button";
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

export default function RegisterPage() {
  const t = useTranslations("auth");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("register.errors.passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      await api.auth.register({ name, email, password, confirmPassword });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errors[0]?.message || t("register.errors.generic"));
      } else {
        setError(t("register.errors.generic"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-pulse" />
        <Card className="w-full max-w-md mx-4 border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <CardTitle>{t("register.success.title")}</CardTitle>
            <CardDescription>
              {t("register.success.emailSentTo")} <strong>{email}</strong>.{" "}
              {t("register.success.instructions")}
            </CardDescription>
            <div className="pt-4 flex">
              <Link
                href="/login"
                className={buttonVariants({
                  variant: "default",
                  className: "w-full",
                })}
              >
                {t("register.success.goToLogin")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-1/4 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-pulse" />

      <Card className="w-full max-w-md mx-4 border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl z-10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {t("register.title")}
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              {t("register.subtitle")}
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
              <Label htmlFor="name">{t("register.fullName")}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t("register.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("register.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("register.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("register.password")}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t("register.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                {t("register.passwordHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t("register.confirmPassword")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("register.passwordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("register.submitting")}
                </>
              ) : (
                t("register.submit")
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground mt-4">
              {t("register.hasAccount")}{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                {t("register.loginLink")}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
