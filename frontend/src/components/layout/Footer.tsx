import Link from "next/link";

interface FooterLink {
  name: string;
  href: string;
  comingSoon?: boolean;
}

const footerLinks: Record<string, FooterLink[]> = {
  product: [
    { name: "Features", href: "/features", comingSoon: true },
    { name: "Pricing", href: "/pricing", comingSoon: true },
    { name: "FAQ", href: "/faq", comingSoon: true },
  ],
  company: [
    { name: "About", href: "/about", comingSoon: true },
    { name: "Blog", href: "/blog", comingSoon: true },
    { name: "Contact", href: "/contact", comingSoon: true },
  ],
  legal: [
    { name: "Privacy", href: "/privacy", comingSoon: true },
    { name: "Terms", href: "/terms", comingSoon: true },
  ],
};

export function Footer() {
  return (
    <footer className="bg-card border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">RZ</span>
              </div>
              <span className="font-semibold text-foreground">
                re-zoo-me
              </span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              AI-powered resume customization for job applications.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-foreground capitalize">
                {category}
              </h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    {link.comingSoon ? (
                      <span className="text-sm text-muted-foreground/50 cursor-default flex items-center gap-2">
                        {link.name}
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 border border-muted-foreground/20 rounded px-1 py-0.5 leading-none">
                          Soon
                        </span>
                      </span>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {link.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} re-zoo-me. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
