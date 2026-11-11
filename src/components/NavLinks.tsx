"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDueCount } from "@/lib/applications";

const LINKS = [
  { href: "/tailor", label: "Tailor" },
  { href: "/role-finder", label: "Role finder" },
  { href: "/applications", label: "Application log" },
  { href: "/settings", label: "Model settings" },
];

/** The top navigation, with the current page highlighted. Scrolls sideways on a phone. */
export function NavLinks() {
  const pathname = usePathname();
  // Follow-ups that have come due, shown on the Application log link from any page.
  const due = useDueCount();
  return (
    <div className="scroll-x -mx-4 flex gap-1 px-4 text-sm sm:mx-0 sm:px-0">
      {LINKS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-1.5 whitespace-nowrap transition ${
              active
                ? "bg-card font-medium text-foreground"
                : "text-muted hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            {label}
            {href === "/applications" && due > 0 && (
              <span
                className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-on-accent"
                title={`${due} follow-up${due === 1 ? "" : "s"} due`}
              >
                {due}
                <span className="sr-only"> follow-up{due === 1 ? "" : "s"} due</span>
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
