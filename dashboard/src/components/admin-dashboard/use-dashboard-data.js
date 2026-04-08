import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/auth";

export function useDashboardData() {
  const [threads, setThreads] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      setError("");
      const [t, b, e, s] = await Promise.allSettled([
        api("/threads"),
        api("/booking/today"),
        api("/escalations"),
        api("/waha/sessions")
      ]);

      if (t.status === "fulfilled") setThreads(t.value.threads || []);
      if (b.status === "fulfilled") setBookings(b.value.bookings || []);
      if (e.status === "fulfilled") setEscalations(e.value.escalations || []);

      if (s.status === "fulfilled") {
        const value = s.value;
        setSessions(Array.isArray(value) ? value : value.sessions || []);
        if (value?.authError) {
          setError("WAHA unauthorized. Cek kredensial WAHA di .env lalu recreate backend+waha.");
        }
      } else {
        setSessions([]);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 10000);
    return () => clearInterval(timer);
  }, [loadAll]);

  const stats = useMemo(() => {
    const openEscalations = escalations.filter((e) => e.status === "open").length;
    return {
      totalThreads: threads.length,
      todayBookings: bookings.length,
      openEscalations,
      wahaSessions: sessions.length
    };
  }, [threads, bookings, escalations, sessions]);

  return { threads, bookings, escalations, sessions, error, stats, loadAll };
}
