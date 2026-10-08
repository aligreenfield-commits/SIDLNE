import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIDLNE | Family Sports Calendar",
  description: "Production-ready family sports calendar for managing games, practices, rides, and team coordination.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
