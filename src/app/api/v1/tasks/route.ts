import { NextRequest } from "next/server";
import { handleApiError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { filterMobileTasks, mobileTaskSummary, mobileTasksForUser } from "@/lib/mobile-api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const params = request.nextUrl.searchParams;
    const tasks = await mobileTasksForUser(user);
    const filteredTasks = filterMobileTasks(tasks, {
      scope: params.get("scope"),
      status: params.get("status"),
      priority: params.get("priority"),
      branchId: params.get("branchId"),
      search: params.get("search")
    });

    return ok({
      apiVersion: "v1",
      summary: mobileTaskSummary(tasks),
      tasks: filteredTasks,
      total: filteredTasks.length,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    return handleApiError(error);
  }
}
