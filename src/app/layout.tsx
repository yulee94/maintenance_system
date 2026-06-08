import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maintenance Rental System",
  description: "정비/렌탈 업무 접수, 배정, 완료보고, KPI 관리 시스템",
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#1f6f5f",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
