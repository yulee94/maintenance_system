export type LocaleCode = "ko" | "en" | "zh" | "ja";

export type LocaleOption = {
  code: LocaleCode;
  name: string;
  nativeName: string;
  htmlLang: string;
};

export const DEFAULT_LOCALE: LocaleCode = "ko";
export const LOCALE_STORAGE_KEY = "maintenance_system_locale";

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: "ko", name: "Korean", nativeName: "한국어", htmlLang: "ko" },
  { code: "en", name: "English", nativeName: "English", htmlLang: "en" },
  { code: "zh", name: "Chinese", nativeName: "中文", htmlLang: "zh-Hans" },
  { code: "ja", name: "Japanese", nativeName: "日本語", htmlLang: "ja" }
];

const catalogs: Record<LocaleCode, Record<string, string>> = {
  ko: {
    "app.title": "정비 렌탈 운영 시스템",
    "actions.logout": "로그아웃",
    "actions.refresh": "새로고침",
    "i18n.language": "언어",
    "i18n.select": "표시 언어 선택",
    "layout.desktopAria": "데스크톱 업무 화면",
    "login.demoAccounts": "데모 계정",
    "login.demoSubtitle": "임원, 관리자, 정비사 화면을 즉시 전환해 볼 수 있습니다.",
    "login.loginId": "아이디",
    "login.loading": "확인 중",
    "login.password": "비밀번호",
    "login.submit": "로그인",
    "login.subtitle": "역할별 데모 계정으로 실제 운영 화면을 확인할 수 있습니다.",
    "nav.admin": "관리",
    "nav.appwork": "통합업무",
    "nav.approval": "승인",
    "nav.aria": "업무 메뉴",
    "nav.calendar": "일정",
    "nav.dashboard": "현황",
    "nav.daily": "일일현황",
    "nav.equipment": "장비관리",
    "nav.exports": "엑셀",
    "nav.kpi": "보고/KPI",
    "nav.mechanic": "내 작업",
    "nav.reception": "접수",
    "nav.workorders": "정비건"
  },
  en: {
    "app.title": "Maintenance Rental Operations",
    "actions.logout": "Log out",
    "actions.refresh": "Refresh",
    "i18n.language": "Language",
    "i18n.select": "Select display language",
    "layout.desktopAria": "Desktop work screen",
    "login.demoAccounts": "Demo Accounts",
    "login.demoSubtitle": "Switch between executive, admin, and mechanic views instantly.",
    "login.loginId": "Login ID",
    "login.loading": "Checking",
    "login.password": "Password",
    "login.submit": "Log in",
    "login.subtitle": "Use role-based demo accounts to review the live operations screens.",
    "nav.admin": "Admin",
    "nav.appwork": "Unified Work",
    "nav.approval": "Approval",
    "nav.aria": "Work menu",
    "nav.calendar": "Schedule",
    "nav.dashboard": "Dashboard",
    "nav.daily": "Daily Status",
    "nav.equipment": "Equipment",
    "nav.exports": "Excel",
    "nav.kpi": "Reports/KPI",
    "nav.mechanic": "My Work",
    "nav.reception": "Reception",
    "nav.workorders": "Work Orders"
  },
  zh: {
    "app.title": "维修租赁运营系统",
    "actions.logout": "退出登录",
    "actions.refresh": "刷新",
    "i18n.language": "语言",
    "i18n.select": "选择显示语言",
    "layout.desktopAria": "桌面工作画面",
    "login.demoAccounts": "演示账号",
    "login.demoSubtitle": "可立即切换查看高管、管理员、维修人员画面。",
    "login.loginId": "账号",
    "login.loading": "确认中",
    "login.password": "密码",
    "login.submit": "登录",
    "login.subtitle": "可使用不同角色的演示账号确认实际运营画面。",
    "nav.admin": "管理",
    "nav.appwork": "综合业务",
    "nav.approval": "审批",
    "nav.aria": "业务菜单",
    "nav.calendar": "日程",
    "nav.dashboard": "现况",
    "nav.daily": "每日现况",
    "nav.equipment": "设备管理",
    "nav.exports": "Excel",
    "nav.kpi": "报告/KPI",
    "nav.mechanic": "我的工作",
    "nav.reception": "受理",
    "nav.workorders": "维修单"
  },
  ja: {
    "app.title": "整備レンタル運営システム",
    "actions.logout": "ログアウト",
    "actions.refresh": "更新",
    "i18n.language": "言語",
    "i18n.select": "表示言語を選択",
    "layout.desktopAria": "デスクトップ業務画面",
    "login.demoAccounts": "デモアカウント",
    "login.demoSubtitle": "役員、管理者、整備士の画面をすぐに切り替えて確認できます。",
    "login.loginId": "ID",
    "login.loading": "確認中",
    "login.password": "パスワード",
    "login.submit": "ログイン",
    "login.subtitle": "役割別のデモアカウントで実運用画面を確認できます。",
    "nav.admin": "管理",
    "nav.appwork": "統合業務",
    "nav.approval": "承認",
    "nav.aria": "業務メニュー",
    "nav.calendar": "日程",
    "nav.dashboard": "状況",
    "nav.daily": "日次状況",
    "nav.equipment": "設備管理",
    "nav.exports": "Excel",
    "nav.kpi": "報告/KPI",
    "nav.mechanic": "自分の作業",
    "nav.reception": "受付",
    "nav.workorders": "整備件"
  }
};

export function normalizeLocale(value: unknown): LocaleCode {
  return LOCALE_OPTIONS.some((option) => option.code === value) ? (value as LocaleCode) : DEFAULT_LOCALE;
}

export function htmlLangFor(locale: LocaleCode) {
  return LOCALE_OPTIONS.find((option) => option.code === locale)?.htmlLang ?? "ko";
}

export function translate(locale: LocaleCode, key: string, fallback?: string, params?: Record<string, string | number>) {
  const template = catalogs[locale]?.[key] ?? catalogs.ko[key] ?? fallback ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => `${params[name] ?? ""}`);
}
