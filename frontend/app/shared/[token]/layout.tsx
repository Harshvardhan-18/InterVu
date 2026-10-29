import type { Metadata } from "next";

// Shared reports are private-by-link: keep them out of search engines and
// never send the URL (which contains the secret token) as a Referer.
export const metadata: Metadata = {
  title: "Shared interview report - InterVu",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
