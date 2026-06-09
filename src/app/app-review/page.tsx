import type { Metadata } from "next";
import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "앱 심사 안내 | 정비 렌탈 운영",
  description: "스토어 심사자가 정비 렌탈 운영 앱을 확인하기 위한 안내입니다."
};

export default function AppReviewPage() {
  return (
    <PolicyPage
      eyebrow="App Review"
      title="앱 심사 안내"
      description="심사자는 아래 계정과 경로로 정비사, 관리자, 임원 화면을 확인할 수 있습니다."
      updatedAt="2026-06-09"
      sections={[
        {
          title: "테스트 계정",
          body: [
            "관리자: ko.ms / Admin!2026Test",
            "정비사: jegal.ts / Mech!2026Test",
            "임원: kim.ms / Exec!2026Test",
            "접수자: park.jw / Reception!2026"
          ]
        },
        {
          title: "테스트 사업장 데이터",
          body: [
            "본사 운영센터, 수도권 파일럿 사업장, 영남 물류센터, 호남 지점의 테스트 데이터를 준비합니다.",
            "각 사업장에는 미결 정비건, 진행 정비건, 완료 정비건, 승인 대기 건, 반려 예시가 포함됩니다."
          ]
        },
        {
          title: "확인 경로",
          body: [
            "로그인 후 오늘 탭에서 배정, 긴급, 완료 현황을 확인합니다.",
            "정비건 탭에서 상세 화면과 완료보고 첨부 화면을 확인합니다.",
            "AI 탭에서 정비 문의, 보고서 초안, 권한 제한 메시지를 확인합니다.",
            "관리자 계정으로 승인, KPI, 보고서, 계정/권한 화면을 확인합니다."
          ]
        },
        {
          title: "권한과 결제 안내",
          body: [
            "푸시 알림은 작업 배정과 승인 요청 알림을 위해 사용합니다. 카메라와 사진 보관함은 완료보고 첨부를 위해 사용합니다.",
            "현재 앱은 인앱 결제, 디지털 콘텐츠 판매, 카드번호 입력 기능을 제공하지 않습니다."
          ]
        }
      ]}
    />
  );
}
