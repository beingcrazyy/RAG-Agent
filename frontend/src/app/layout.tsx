import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import '@fontsource-variable/mona-sans';
import { ThemeProvider } from "../components/ThemeProvider";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Loomind - AI Workspace",
  description: "Enterprise Productivity Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
