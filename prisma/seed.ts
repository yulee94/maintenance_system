import bcrypt from "bcryptjs";
import {
  EquipmentType,
  PrismaClient,
  PriorityLevel,
  RoleCode,
  WorkOrderStatus
} from "@prisma/client";

const prisma = new PrismaClient();

const temporaryPassword = "ChangeMe!2026";

async function main() {
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const roleRows = [
    [RoleCode.ADMIN, "관리자", "운영 설정, 배정, 승인, KPI 전체 권한"],
    [RoleCode.MECHANIC, "정비사", "전체 업무 조회, 작업 시작, 완료보고, 계획업무 요청"],
    [RoleCode.RECEPTIONIST, "접수자", "정비의뢰 접수 및 접수 내용 수정"],
    [RoleCode.EXECUTIVE, "임원/대표", "KPI 조회 및 KPI 제외 판단"]
  ] as const;

  const roles = new Map<RoleCode, string>();
  for (const [code, name, description] of roleRows) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name, description },
      create: { code, name, description }
    });
    roles.set(code, role.id);
  }

  type UserSeed = {
    loginId: string;
    name: string;
    title: string;
    team: string;
    phone: string;
    roleCodes: RoleCode[];
  };

  const users: UserSeed[] = [
    { loginId: "jegal.ts", name: "제갈태수", title: "책임", team: "정비팀", phone: "010-3871-5725", roleCodes: [RoleCode.MECHANIC] },
    { loginId: "jung.mg", name: "정민규", title: "책임", team: "정비팀", phone: "010-8694-9887", roleCodes: [RoleCode.MECHANIC] },
    { loginId: "kim.yh", name: "김용현", title: "선임", team: "정비팀", phone: "010-3934-1429", roleCodes: [RoleCode.MECHANIC] },
    { loginId: "kim.jb", name: "김진봉", title: "매니저", team: "예방점검팀", phone: "010-3558-5593", roleCodes: [RoleCode.MECHANIC] },
    { loginId: "lee.sj", name: "이승준", title: "매니저", team: "예방점검팀", phone: "010-4029-4341", roleCodes: [RoleCode.MECHANIC] },
    { loginId: "kim.ms", name: "김민식", title: "전무", team: "관리자", phone: "010-8520-5984", roleCodes: [RoleCode.ADMIN, RoleCode.EXECUTIVE] },
    { loginId: "ko.ms", name: "고민서", title: "책임", team: "관리자", phone: "010-9360-7590", roleCodes: [RoleCode.ADMIN] },
    { loginId: "son.hn", name: "손화나", title: "선임", team: "접수/관리", phone: "010-8388-8356", roleCodes: [RoleCode.RECEPTIONIST, RoleCode.ADMIN] }
  ];

  const usersByLogin = new Map<string, string>();
  for (const userSeed of users) {
    const user = await prisma.user.upsert({
      where: { loginId: userSeed.loginId },
      update: {
        name: userSeed.name,
        title: userSeed.title,
        team: userSeed.team,
        phone: userSeed.phone,
        isActive: true
      },
      create: {
        loginId: userSeed.loginId,
        name: userSeed.name,
        title: userSeed.title,
        team: userSeed.team,
        phone: userSeed.phone,
        passwordHash,
        mustChangePassword: true
      }
    });
    usersByLogin.set(user.loginId, user.id);

    if (userSeed.roleCodes.includes(RoleCode.MECHANIC)) {
      await prisma.mechanicProfile.upsert({
        where: { userId: user.id },
        update: { team: userSeed.team, canReceiveWork: true },
        create: { userId: user.id, team: userSeed.team, canReceiveWork: true }
      });
    }

    for (const code of userSeed.roleCodes) {
      const roleId = roles.get(code);
      if (!roleId) continue;
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId }
      });
    }
  }

  const priorityRows = [
    {
      level: PriorityLevel.P1,
      label: "Priority #1 긴급",
      color: "#ef4444",
      criteria: "긴급사항, Line stop 가능, 환경문제 유발, 안전 관련 사항",
      sortOrder: 1
    },
    {
      level: PriorityLevel.P2,
      label: "Priority #2 중요",
      color: "#eab308",
      criteria: "생산 차질, 일반 고장발생 사항",
      sortOrder: 2
    },
    {
      level: PriorityLevel.P3,
      label: "Priority #3 일반",
      color: "#22c55e",
      criteria: "사업장 협조요청, Lamp류 정비 등",
      sortOrder: 3
    },
    {
      level: PriorityLevel.OUTSOURCE,
      label: "외주",
      color: "#2563eb",
      criteria: "외주 협력업체 진행사항",
      sortOrder: 4
    }
  ];

  for (const priority of priorityRows) {
    await prisma.priorityConfig.upsert({
      where: { level: priority.level },
      update: priority,
      create: priority
    });
  }

  const faultCategories = [
    "시동안걸림",
    "누유",
    "브레이크",
    "타이어",
    "배터리",
    "충전기",
    "유압",
    "체인",
    "포크",
    "라이트/Lamp",
    "에어컨",
    "DPF/엔진경고등",
    "시트",
    "도어/커버",
    "정기검사",
    "예방점검",
    "기타"
  ];

  for (const [index, name] of faultCategories.entries()) {
    await prisma.faultCategory.upsert({
      where: { name },
      update: { isActive: true, sortOrder: index + 1 },
      create: { name, isActive: true, sortOrder: index + 1 }
    });
  }

  const taesung = await prisma.customer.upsert({
    where: { name: "태성이엔지" },
    update: {},
    create: { name: "태성이엔지", memo: "초기 샘플 고객사" }
  });

  const defaultMechanicId = usersByLogin.get("jegal.ts");
  const cylSite = await prisma.site.upsert({
    where: { customerId_name: { customerId: taesung.id, name: "CYL 도장물류" } },
    update: { defaultMechanicId },
    create: {
      customerId: taesung.id,
      name: "CYL 도장물류",
      defaultMechanicId,
      contactPhone: "010-2625-0987"
    }
  });

  if (defaultMechanicId) {
    await prisma.mechanicSiteAssignment.upsert({
      where: { siteId_mechanicId: { siteId: cylSite.id, mechanicId: defaultMechanicId } },
      update: { isPrimary: true },
      create: { siteId: cylSite.id, mechanicId: defaultMechanicId, isPrimary: true }
    });
  }

  const equipment290 = await prisma.equipment.upsert({
    where: { normalizedNo: "290" },
    update: {
      customerId: taesung.id,
      siteId: cylSite.id,
      equipmentNo: "CFO25-0290",
      placementNo: "태성-290",
      modelName: "GTS25DE",
      serialNo: "GTS232D15859820KF",
      tonnage: "2.5T",
      maker: "클라크",
      location: "CYL 도장물류",
      vehicleRegistrationNo: "경남04노6321"
    },
    create: {
      normalizedNo: "290",
      klRegistration: "290",
      customerId: taesung.id,
      siteId: cylSite.id,
      equipmentNo: "CFO25-0290",
      placementNo: "태성-290",
      modelName: "GTS25DE",
      serialNo: "GTS232D15859820KF",
      tonnage: "2.5T",
      maker: "클라크",
      location: "CYL 도장물류",
      vehicleRegistrationNo: "경남04노6321",
      status: "운영"
    }
  });

  const fault = await prisma.faultCategory.findUnique({ where: { name: "시동안걸림" } });
  const receptionistId = usersByLogin.get("son.hn");

  await prisma.workOrder.upsert({
    where: { requestNo: "20260608-001" },
    update: {},
    create: {
      requestNo: "20260608-001",
      customerId: taesung.id,
      siteId: cylSite.id,
      equipmentId: equipment290.id,
      equipmentNoNormalized: "290",
      equipmentInput: "290호기",
      requestDate: new Date("2026-06-08T00:00:00.000Z"),
      contactPhone: "010-2625-0987",
      faultCategoryId: fault?.id,
      faultDescription: "시동안걸림-지금은 점프해서 사용중(와서 점검은 해달라고 합니다)",
      equipmentType: EquipmentType.RENTAL,
      priorityLevel: PriorityLevel.P1,
      status: WorkOrderStatus.ASSIGNED,
      assignedMechanicId: defaultMechanicId,
      targetDueDate: new Date("2026-06-08T00:00:00.000Z"),
      createdById: receptionistId,
      updatedById: receptionistId,
      memo: "seed sample"
    }
  });

  await prisma.auditLog.create({
    data: {
      action: "seed.completed",
      targetType: "system",
      after: {
        temporaryPassword,
        note: "All seed users require password change on first login."
      }
    }
  });

  console.log(`Seed completed. Temporary password for all seed users: ${temporaryPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
