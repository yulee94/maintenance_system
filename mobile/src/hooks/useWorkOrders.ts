import { useCallback, useEffect, useMemo, useState } from "react";
import { getTaskBundle } from "../api/client";
import type { Summary, WorkOrder } from "../api/types";
import { isClosed, isToday, sortWorkOrders } from "../utils";

export function useWorkOrders() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const taskBundle = await getTaskBundle();
    setSummary(taskBundle.summary);
    setWorkOrders(sortWorkOrders(taskBundle.tasks));
  }, []);

  useEffect(() => {
    void load()
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "데이터를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load()
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "데이터를 불러오지 못했습니다."))
      .finally(() => setRefreshing(false));
  }, [load]);

  const todayRows = useMemo(() => sortWorkOrders(workOrders.filter(isToday)), [workOrders]);
  const openRows = useMemo(() => sortWorkOrders(workOrders.filter((row) => !isClosed(row))), [workOrders]);
  const completedRows = useMemo(() => sortWorkOrders(workOrders.filter(isClosed)), [workOrders]);

  return {
    summary,
    workOrders,
    todayRows,
    openRows,
    completedRows,
    loading,
    refreshing,
    error,
    refresh
  };
}
