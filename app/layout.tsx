import type { Metadata } from "next";
import { Bebas_Neue, Rubik } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  variable: "--font-heading",
  weight: "400",
  subsets: ["latin"],
});

const rubik = Rubik({
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Caleb's Tour Co. - Passeios em Arraial do Cabo",
  description: "Passeios de barco, transfer, jet ski, buggy e muito mais no Caribe Brasileiro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${bebasNeue.variable} ${rubik.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
