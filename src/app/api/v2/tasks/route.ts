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
      apiVersion: "v2",
      serverTime: new Date().toISOString(),
      paging: {
        total: filteredTasks.length,
        limit: filteredTasks.length,
        nextCursor: null
      },
      features: {
        branchScoped: true,
        approvalWorkflow: true,
        reportAttachments: true
      },
      summary: mobileTaskSummary(tasks),
      tasks: filteredTasks.map((task) => ({
        ...task,
        links: {
          self: `/api/v2/tasks/${task.id}`,
          v1Compatible: `/api/v1/tasks?search=${encodeURIComponent(task.requestNo)}`
        }
      }))
    });
  } catch (error) {
    return handleApiError(error);
  }
}
