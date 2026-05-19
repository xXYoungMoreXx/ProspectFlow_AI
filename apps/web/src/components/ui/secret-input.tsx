"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SecretInputProps {
  id?: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SecretInput({
  id,
  value,
  onChange,
  placeholder = "sk-••••••••••••••••",
  disabled = false,
  className,
}: SecretInputProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const isServerMasked =
    typeof value === "string" && /\*/.test(value) && value.length <= 20;

  const handleCopy = async () => {
    if (!value || isServerMasked) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative flex items-center gap-1 ${className ?? ""}`}>
      <Input
        id={id}
        type={visible && !isServerMasked ? "text" : "password"}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-20 font-mono text-sm"
        autoComplete="off"
        spellCheck={false}
      />
      <div className="absolute right-1 flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled || isServerMasked}
          tabIndex={-1}
          title={visible ? "Hide" : "Show"}
        >
          {visible && !isServerMasked ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
          disabled={disabled || isServerMasked || !value}
          tabIndex={-1}
          title="Copy"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
