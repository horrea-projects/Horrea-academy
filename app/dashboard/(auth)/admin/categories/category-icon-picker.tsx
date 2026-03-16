"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_ICONS, getCategoryIconSvg, isCustomSvg } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (icon: string) => void;
  className?: string;
};

export function CategoryIconPicker({ value, onChange, className }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customSvg, setCustomSvg] = useState(isCustomSvg(value) ? value : "");

  useEffect(() => {
    if (isCustomSvg(value)) {
      setCustomSvg(value);
      setCustomOpen(true);
    } else {
      setCustomSvg("");
    }
  }, [value]);

  const currentSvg = getCategoryIconSvg(value) ?? "";

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Icône (SVG)</Label>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {CATEGORY_ICONS.map((icon) => (
          <button
            key={icon.id}
            type="button"
            onClick={() => {
              onChange(icon.id);
              setCustomOpen(false);
            }}
            className={cn(
              "flex size-12 items-center justify-center rounded-lg border transition-colors hover:bg-muted",
              value === icon.id ? "border-primary bg-primary/10" : "border-border"
            )}
            title={icon.label}
          >
            <span
              className="size-6 [&>svg]:size-full"
              dangerouslySetInnerHTML={{ __html: icon.svg }}
            />
          </button>
        ))}
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCustomOpen(!customOpen)}
        >
          {customOpen ? "Masquer SVG personnalisé" : "Icône personnalisée (coller un SVG)"}
        </Button>
        {customOpen && (
          <div className="mt-2 space-y-2">
            <Textarea
              placeholder='<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'
              value={customSvg}
              onChange={(e) => setCustomSvg(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const trimmed = customSvg.trim();
                if (trimmed.toLowerCase().startsWith("<svg")) {
                  onChange(trimmed);
                }
              }}
            >
              Utiliser ce SVG
            </Button>
          </div>
        )}
      </div>
      {currentSvg && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">Aperçu :</span>
          <span
            className="size-8 [&>svg]:size-full [&>svg]:text-foreground"
            dangerouslySetInnerHTML={{ __html: currentSvg }}
          />
        </div>
      )}
    </div>
  );
}
