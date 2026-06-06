import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, JetBrains_Mono } from "next/font/google";
import Navigation from "@/components/Navigation";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wale Adekambi",
  description:
    "Industrial & Systems Engineering grad from George Mason University. Building systems that solve real engineering problems.",
  openGraph: {
    title: "Wale Adekambi",
    description:
      "Industrial & Systems Engineering grad from George Mason University. Building systems that solve real engineering problems.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before React hydrates — prevents flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${instrumentSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <Navigation />
        {children}
      </body>
    </html>
  );
}
