import { NextRequest } from "next/server";
import { Prisma, RoleCode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { numberFromEquipmentText, pick, readMasterListRows, templateFiles } from "@/lib/excel";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request, [RoleCode.ADMIN]);
    const rows = await readMasterListRows();
    let successCount = 0;
    const errors: unknown[] = [];

    for (const row of rows) {
      try {
        const normalizedNo = numberFromEquipmentText(pick(row, ["K&L 등록", "No.", "배치No", "장비 No"]));
        if (!normalizedNo) continue;
        const customerName = pick(row, ["사업장", "계약처"]) || "미지정";
        const siteName = pick(row, ["배치장소", "사업장"]) || customerName;
        const customer = await prisma.customer.upsert({
          where: { name: customerName },
          update: {},
          create: { name: customerName }
        });
        const site = await prisma.site.upsert({
          where: { customerId_name: { customerId: customer.id, name: siteName } },
          update: {},
          create: { customerId: customer.id, name: siteName }
        });
        await prisma.equipment.upsert({
          where: { normalizedNo },
          update: {
            klRegistration: pick(row, ["K&L 등록"]),
            equipmentNo: pick(row, ["장비 No"]),
            placementNo: pick(row, ["배치No"]),
            customerId: customer.id,
            siteId: site.id,
            manufacturer: pick(row, ["제조"]),
            powerType: pick(row, ["동력"]),
            kind: pick(row, ["종류"]),
            status: pick(row, ["상태"]),
            managerName: pick(row, ["담당자"]),
            location: pick(row, ["배치장소"]),
            operationType: pick(row, ["운영"]),
            spec: pick(row, ["규격"]),
            tonnage: pick(row, ["톤수"]),
            maker: pick(row, ["제작처"]),
            modelName: pick(row, ["모델명"]),
            serialNo: pick(row, ["차대번호"]),
            year: pick(row, ["년식"]),
            operatingHours: pick(row, ["가동시간"]),
            vehicleRegistrationNo: pick(row, ["차량등록 No."]),
            raw: row
          },
          create: {
            normalizedNo,
            klRegistration: pick(row, ["K&L 등록"]),
            equipmentNo: pick(row, ["장비 No"]),
            placementNo: pick(row, ["배치No"]),
            customerId: customer.id,
            siteId: site.id,
            manufacturer: pick(row, ["제조"]),
            powerType: pick(row, ["동력"]),
            kind: pick(row, ["종류"]),
            status: pick(row, ["상태"]),
            managerName: pick(row, ["담당자"]),
            location: pick(row, ["배치장소"]),
            operationType: pick(row, ["운영"]),
            spec: pick(row, ["규격"]),
            tonnage: pick(row, ["톤수"]),
            maker: pick(row, ["제작처"]),
            modelName: pick(row, ["모델명"]),
            serialNo: pick(row, ["차대번호"]),
            year: pick(row, ["년식"]),
            operatingHours: pick(row, ["가동시간"]),
            vehicleRegistrationNo: pick(row, ["차량등록 No."]),
            raw: row
          }
        });
        successCount += 1;
      } catch (error) {
        errors.push({ row, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const log = await prisma.equipmentImportLog.create({
      data: {
        fileName: templateFiles.masterList,
        sheetName: "K&L 지게차 Master list",
        rowCount: rows.length,
        successCount,
        errorCount: errors.length,
        errors: JSON.parse(JSON.stringify({ items: errors.slice(0, 50) })) as Prisma.InputJsonValue,
        importedById: user.id
      }
    });
    await auditLog({ user, request, action: "equipment.import_master_list", targetType: "equipmentImportLog", targetId: log.id, after: log });
    return ok(log);
  } catch (error) {
    return handleApiError(error);
  }
}
