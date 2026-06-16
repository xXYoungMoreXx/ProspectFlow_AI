"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import Link from "next/link";

const SOURCES = [
  "MANUAL",
  "GOOGLE_MAPS",
  "SCRAPED",
  "REFERRAL",
  "APOLLO",
] as const;

type LeadSource = (typeof SOURCES)[number];

export default function NewLeadPage() {
  const t = useTranslations("leads");
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  const [contactName, setContactName] = useState("");
  const [contactCompany, setContactCompany] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [source, setSource] = useState<LeadSource>("MANUAL");

  const hasContact = contactPhone.trim() !== "" || contactEmail.trim() !== "";
  const canSubmit = contactName.trim().length >= 2 && hasContact;

  const createMutation = useMutation({
    mutationFn: () =>
      api.leads.create(
        {
          contactName: contactName.trim(),
          ...(contactCompany.trim() && { contactCompany: contactCompany.trim() }),
          ...(contactPhone.trim() && { contactPhone: contactPhone.trim() }),
          ...(contactEmail.trim() && { contactEmail: contactEmail.trim() }),
          source,
        },
        token!,
      ),
    onSuccess: () => router.push("/leads"),
  });

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Link href="/leads">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("new.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("new.subtitle")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            {t("new.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contactName">{t("new.contactName")} *</Label>
            <Input
              id="contactName"
              placeholder={t("new.contactNamePlaceholder")}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactCompany">{t("new.contactCompany")}</Label>
            <Input
              id="contactCompany"
              placeholder={t("new.contactCompanyPlaceholder")}
              value={contactCompany}
              onChange={(e) => setContactCompany(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">{t("new.contactPhone")}</Label>
              <Input
                id="contactPhone"
                placeholder={t("new.contactPhonePlaceholder")}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">{t("new.contactEmail")}</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder={t("new.contactEmailPlaceholder")}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
          </div>

          {!hasContact && contactName.length > 0 && (
            <p className="text-xs text-destructive">{t("new.contactRequired")}</p>
          )}

          <div className="space-y-2">
            <Label>{t("new.source")}</Label>
            <Select
              value={source}
              onValueChange={(v) => v && setSource(v as LeadSource)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("new.sourcePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`new.sources.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {createMutation.isError && (
            <p className="text-xs text-destructive">{t("new.submitError")}</p>
          )}

          <Button
            className="w-full gap-2 mt-2"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("new.submitting")}
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                {t("new.submit")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
