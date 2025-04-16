import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FTU Chatbot Tuyển Sinh",
  description: "FTU Chatbot Tuyển Sinh",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body style={{overflow: 'hidden'}} className={`${inter.className} h-full`}>
        <div
          className="flex flex-col h-full md:p-8"
          style={{ background: "#fff" }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
