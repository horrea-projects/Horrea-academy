"use client";

import Link from "next/link";
import { Check, List, Play, Pause } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ModuleNavItem = {
  id: string;
  title: string;
  duration: string;
  completed?: boolean;
  current?: boolean;
};

type ModuleProgressProps = {
  modules: ModuleNavItem[];
  message?: string;
};

function ModuleProgress({ modules, message }: ModuleProgressProps) {
  const completedCount = modules.filter((m) => m.completed).length;
  const totalCount = modules.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Card className="border-transparent lg:border-border lg:gap-6 gap-4">
      <CardHeader>
        <CardTitle>
          Progression{" "}
          <Badge variant="outline" className="ms-1">
            {completedCount}/{totalCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={progressPercent} className="h-2.5" />
        {message && (
          <div className="bg-muted/50 text-muted-foreground rounded-lg p-3 text-sm">{message}</div>
        )}
      </CardContent>
    </Card>
  );
}

type ModuleListNavProps = {
  slug: string;
  modules: ModuleNavItem[];
};

function ModuleListNav({ slug, modules }: ModuleListNavProps) {
  return (
    <Card className="border-transparent lg:border-border lg:gap-6 gap-4">
      <CardHeader>
        <CardTitle>Modules</CardTitle>
        <CardAction>
          <span className="text-muted-foreground text-sm">
            {modules.filter((m) => m.completed).length}/{modules.length}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {modules.map((mod) => (
            <Link
              key={mod.id}
              href={`/dashboard/courses/${slug}/modules/${mod.id}`}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                mod.current && "border-primary bg-primary/5",
                !mod.current && "border-border hover:bg-muted/50"
              )}
            >
              {mod.completed ? (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                  <Check className="size-4" />
                </div>
              ) : mod.current ? (
                <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Pause className="size-4" />
                </div>
              ) : (
                <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
                  <Play className="size-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{mod.title}</p>
                <p className="text-muted-foreground text-sm">{mod.duration}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type ModuleSidebarProps = {
  slug: string;
  modules: ModuleNavItem[];
  completedCount?: number;
};

export function ModuleSidebar({ slug, modules, completedCount = 0 }: ModuleSidebarProps) {
  return (
    <div className="space-y-4 lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:self-start lg:pt-1">
      <ModuleProgress
        modules={modules}
        message="Complétez les modules pour faire progresser votre parcours."
      />
      <ModuleListNav slug={slug} modules={modules} />
    </div>
  );
}

export function ModuleSidebarMobile({ slug, modules, completedCount = 0 }: ModuleSidebarProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="fixed bottom-4 right-4 z-40 lg:hidden shadow-lg">
          <List className="mr-2 size-4" />
          Modules
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto">
        <div className="mt-6 space-y-4">
          <ModuleSidebar slug={slug} modules={modules} completedCount={completedCount} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
