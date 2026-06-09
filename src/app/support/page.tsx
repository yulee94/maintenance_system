import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "고객센터 | 정비 렌탈 운영",
  description: "정비 렌탈 운영 시스템 고객센터와 앱 심사 문의 연락처입니다."
};

export default function SupportPage() {
  return (
    <PolicyPage
      eyebrow="Support"
      title="고객센터"
      description="앱 접속, 계정, 권한, 정비 업무, 알림, 오류 신고를 접수하는 지원 채널입니다."
      updatedAt="2026-06-09"
      sections={[
        {
          title: "연락처",
          body: [
            "이메일: support@maintenance.example.co.kr",
            "전화: 02-0000-0000",
            "운영 시간: 평일 09:00-18:00, 긴급 장애는 운영 담당자 비상 연락망으로 접수합니다."
          ]
        },
        {
          title: "문의 유형",
          body: [
            "로그인 불가, OTP/MFA 문제, 권한 오류, 사업장 데이터 접근 문제, 앱 빈 화면, 푸시 알림 미수신, 완료보고 첨부 오류를 접수합니다.",
            "스토어 심사 중 테스트 계정 또는 staging 서버 접속 문제가 있으면 앱 심사 메타데이터의 담당 연락처로 문의해 주세요."
          ]
        }
      ]}
    />
  );
}
