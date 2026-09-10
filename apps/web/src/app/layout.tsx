import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono, Noto_Sans_KR } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 랜딩/대시보드("ARCLAB.NANGMAN.CLOUD") 화면 전용 폰트. 나머지 화면(에디터 등)은 계속 Geist를 쓰므로
// 여기서는 CSS 변수만 추가하고, 실제로는 그 두 화면 컴포넌트에서만 font-noto-kr/font-jetbrains
// 클래스로 골라 쓴다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nangman ArchLab",
  description: "고가용성 인프라 아키텍처 학습용 시뮬레이션 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansKr.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
