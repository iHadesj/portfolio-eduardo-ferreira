"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import {
  ArrowUpRight,
  Copy,
  Download,
  Flame,
  Languages,
  Palette,
} from "lucide-react";
import { navItems, siteConfig } from "@/lib/site-config";
import { useSmoothScroll } from "@/hooks/use-smooth-scroll";
import { downloadFile } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { discover } from "@/lib/anomalies";
import { useI18n } from "@/lib/i18n/locale-provider";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { sectionPath, switchLocalePath } from "@/lib/i18n/routes";

interface CommandMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const CommandMenuContext = createContext<CommandMenuContextValue | null>(null);

export function useCommandMenu(): CommandMenuContextValue {
  const ctx = useContext(CommandMenuContext);
  if (!ctx)
    throw new Error("useCommandMenu must be used within CommandMenuProvider");
  return ctx;
}

export function CommandMenuProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <CommandMenuContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      <CommandMenu />
    </CommandMenuContext.Provider>
  );
}

function CommandMenu() {
  const { open, setOpen } = useCommandMenu();
  const { setTheme, resolvedTheme } = useTheme();
  const scrollTo = useSmoothScroll();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { locale, dict } = useI18n();
  const [search, setSearch] = useState("");
  const showSecret = search.toLowerCase().includes("hades");

  useEffect(() => {
    if (showSecret) discover("secret");
  }, [showSecret]);

  const t = dict.commandMenu;
  const target: Locale = locale === defaultLocale ? "en" : defaultLocale;

  const run = useCallback(
    (action: () => void) => {
      setOpen(false);
      action();
    },
    [setOpen],
  );

  const goToSection = useCallback(
    (href: string) => {
      if (document.querySelector(href)) {
        scrollTo(href);
        return;
      }
      router.push(sectionPath(locale, href));
    },
    [scrollTo, router, locale],
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t.label}
      shouldFilter
    >
      <Command.Input
        value={search}
        onValueChange={setSearch}
        placeholder={t.placeholder}
      />
      <Command.List>
        <Command.Empty>{t.empty}</Command.Empty>

        <Command.Group heading={t.groupNav}>
          {navItems.map((item) => (
            <Command.Item
              key={item.id}
              value={`${t.keywords.nav} ${item.label[locale]}`}
              onSelect={() => run(() => goToSection(item.href))}
            >
              {item.label[locale]}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading={t.groupActions}>
          <Command.Item
            value={t.keywords.copyEmail}
            onSelect={() =>
              run(() => {
                void navigator.clipboard?.writeText(siteConfig.email);
                toast(dict.common.emailCopied);
              })
            }
          >
            <Copy size={16} strokeWidth={1.5} /> {t.copyEmail}
          </Command.Item>
          <Command.Item
            value={t.keywords.downloadCv}
            onSelect={() =>
              run(() => {
                downloadFile(siteConfig.cvUrl, siteConfig.cvFileName);
                toast(dict.common.downloadingCv);
              })
            }
          >
            <Download size={16} strokeWidth={1.5} /> {t.downloadCv}
          </Command.Item>
          <Command.Item
            value={t.keywords.switchLanguage}
            onSelect={() =>
              run(() => router.push(switchLocalePath(pathname, target)))
            }
          >
            <Languages size={16} strokeWidth={1.5} /> {t.switchLanguage}
          </Command.Item>
          <Command.Item
            value={t.keywords.openGithub}
            onSelect={() =>
              run(() => window.open(siteConfig.links.github, "_blank"))
            }
          >
            <ArrowUpRight size={16} strokeWidth={1.5} /> {t.openGithub}
          </Command.Item>
          <Command.Item
            value={t.keywords.switchTheme}
            onSelect={() =>
              run(() => setTheme(resolvedTheme === "light" ? "dark" : "light"))
            }
          >
            <Palette size={16} strokeWidth={1.5} /> {t.switchTheme}
          </Command.Item>
        </Command.Group>

        {showSecret ? (
          <Command.Group heading={t.groupSecret}>
            <Command.Item
              value={t.keywords.descend}
              onSelect={() =>
                run(() => {
                  setTheme("underworld");
                  toast(t.descendToast);
                })
              }
            >
              <Flame size={16} strokeWidth={1.5} /> {t.descend}
            </Command.Item>
          </Command.Group>
        ) : null}
      </Command.List>
    </Command.Dialog>
  );
}
