"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CommandIcon, SearchIcon, GraduationCapIcon, BookOpenIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useRouter } from "next/navigation";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { navItems } from "@/components/layout/sidebar/nav-main";

type SearchResultCourse = { slug: string; title: string; descriptionShort: string; href: string };
type SearchResultModule = {
  courseSlug: string;
  moduleId: string;
  title: string;
  courseTitle: string;
  href: string;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

export default function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<SearchResultCourse[]>([]);
  const [modules, setModules] = useState<SearchResultModule[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debouncedQuery = useDebounce(query.trim(), 200);

  const fetchSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setCourses([]);
      setModules([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { courses: SearchResultCourse[]; modules: SearchResultModule[] };
      setCourses(data.courses ?? []);
      setModules(data.modules ?? []);
    } catch {
      setCourses([]);
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSearch(debouncedQuery);
  }, [debouncedQuery, fetchSearch]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const hasSearchResults = debouncedQuery.length >= 2 && (courses.length > 0 || modules.length > 0);
  const showNavOnly = !query.trim() || query.length < 2;
  const showEmpty = debouncedQuery.length >= 2 && !loading && courses.length === 0 && modules.length === 0;

  return (
    <div className="lg:flex-1">
      <div className="relative hidden max-w-sm flex-1 lg:block">
        <SearchIcon className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          className="text-muted-foreground h-9 w-full cursor-pointer rounded-md border pl-10 pr-4 text-sm shadow-xs"
          placeholder="Rechercher une formation ou un module..."
          type="search"
          onFocus={() => setOpen(true)}
        />
        <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-sm bg-zinc-200 p-1 font-mono text-xs font-medium sm:flex dark:bg-neutral-700">
          <CommandIcon className="size-3" />
          <span>k</span>
        </div>
      </div>
      <div className="block lg:hidden">
        <Button size="icon" variant="ghost" onClick={() => setOpen(true)}>
          <SearchIcon />
        </Button>
      </div>
      <CommandDialog open={open} onOpenChange={setOpen} commandProps={{ shouldFilter: false }}>
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle>Recherche</DialogTitle>
          </DialogHeader>
        </VisuallyHidden>
        <>
          <CommandInput
            placeholder="Rechercher une formation ou un module..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Recherche..." : showEmpty ? "Aucun résultat." : "Tapez pour rechercher..."}
            </CommandEmpty>
            {showNavOnly && (
              <>
                {navItems.map((route) => (
                  <React.Fragment key={route.title}>
                    <CommandGroup heading={route.title}>
                      {route.items.map((item, key) => (
                        <CommandItem
                          key={key}
                          value={`nav-${item.href}`}
                          onSelect={() => {
                            setOpen(false);
                            router.push(item.href);
                          }}
                        >
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </React.Fragment>
                ))}
              </>
            )}
            {hasSearchResults && (
              <>
                {courses.length > 0 && (
                  <CommandGroup heading="Formations">
                    {courses.map((c) => (
                      <CommandItem
                        key={c.slug}
                        value={`course-${c.slug}`}
                        onSelect={() => {
                          setOpen(false);
                          router.push(c.href);
                        }}
                      >
                        <GraduationCapIcon />
                        <span>{c.title}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {modules.length > 0 && (
                  <CommandGroup heading="Modules">
                    {modules.map((m) => (
                      <CommandItem
                        key={`${m.courseSlug}-${m.moduleId}`}
                        value={`module-${m.courseSlug}-${m.moduleId}`}
                        onSelect={() => {
                          setOpen(false);
                          router.push(m.href);
                        }}
                      >
                        <BookOpenIcon />
                        <span className="truncate">{m.title}</span>
                        <span className="text-muted-foreground ml-1 truncate text-xs">
                          — {m.courseTitle}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </>
      </CommandDialog>
    </div>
  );
}
