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

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    !token ? "error" : "loading",
  );
  const [errorMessage, setErrorMessage] = useState(
    !token ? "Token de verificação ausente." : "",
  );

  useEffect(() => {
    if (!token) return;

    const verifyToken = async () => {
      try {
        await api.auth.verifyEmail(token);
        setStatus("success");
      } catch (err: any) {
        setStatus("error");
        setErrorMessage(
          err.errors?.[0]?.message ||
            "Falha ao verificar e-mail. O link pode ter expirado.",
        );
      }
    };

    verifyToken();
  }, [token]);

  return (
    <Card className="w-full max-w-md mx-4 border-border/50 bg-card/80 backdrop-blur-sm shadow-2xl">
      <CardContent className="pt-6 text-center space-y-4">
        {status === "loading" && (
          <>
            <div className="mx-auto flex items-center justify-center w-16 h-16">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <CardTitle>Verificando e-mail...</CardTitle>
            <CardDescription>Aguarde um momento.</CardDescription>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <CardTitle>E-mail verificado!</CardTitle>
            <CardDescription>
              Sua conta foi ativada com sucesso. Você já pode fazer login.
            </CardDescription>
            <div className="pt-4 flex">
              <Link
                href="/login"
                className={buttonVariants({
                  variant: "default",
                  className: "w-full",
                })}
              >
                Ir para o Login
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive">
              <XCircle className="w-8 h-8" />
            </div>
            <CardTitle>Erro na verificação</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
            <div className="pt-4 flex">
              <Link
                href="/login"
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                Voltar para o Login
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
