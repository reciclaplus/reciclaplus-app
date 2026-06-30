import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { Providers } from "./providers";
import { strings } from "@/lib/strings";

const hankenGrotesk = Hanken_Grotesk({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const bricolageGrotesque = Bricolage_Grotesque({
  weight: ["700", "800"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: strings.appName,
  description: strings.landing.tagline,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${hankenGrotesk.variable} ${bricolageGrotesque.variable}`}
    >
      <body className={hankenGrotesk.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
