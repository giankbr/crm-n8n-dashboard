"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { api } from "@/lib/auth";

export function InboxSection({ threads, onDataChanged }) {
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threadPage, setThreadPage] = useState(1);
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(8);
  const selectedThreadId = useMemo(() => selectedThread?.thread_id || "", [selectedThread]);
  const filteredThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (thread) =>
        String(thread.wa_number || "").toLowerCase().includes(q) ||
        String(thread.last_message || "").toLowerCase().includes(q)
    );
  }, [threads, query]);
  const totalThreadPages = Math.max(1, Math.ceil(filteredThreads.length / pageSize));
  const pagedThreads = useMemo(() => {
    const start = (threadPage - 1) * pageSize;
    return filteredThreads.slice(start, start + pageSize);
  }, [filteredThreads, threadPage, pageSize]);

  async function loadMessages(threadId) {
    const data = await api(`/threads/${threadId}/messages`);
    setMessages(data.messages || []);
  }

  async function pauseAi(threadId) {
    try {
      await api("/chat/pause", { method: "POST", body: JSON.stringify({ threadId }) });
      toast.success("AI paused untuk thread ini");
      await onDataChanged();
    } catch (error) {
      toast.error(`Gagal pause AI: ${String(error.message || error)}`);
    }
  }

  async function toggleNonAi(threadId, nonAi) {
    try {
      await api("/chat/non-ai", { method: "POST", body: JSON.stringify({ threadId, nonAi }) });
      toast.success(nonAi ? "Thread di-set Non-AI" : "Non-AI dihapus");
      await onDataChanged();
    } catch (error) {
      toast.error(`Gagal update Non-AI: ${String(error.message || error)}`);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Threads</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setThreadPage(1);
              }}
              placeholder="Cari nomor atau pesan terakhir..."
              className="h-8"
            />
            <RowsPerPageSelect
              value={pageSize}
              onChange={(next) => {
                setPageSize(next);
                setThreadPage(1);
              }}
            />
          </div>
          {pagedThreads.map((thread) => (
            <button
              key={thread.thread_id}
              className="w-full rounded-md border p-3 text-left hover:bg-muted"
              onClick={async () => {
                setSelectedThread(thread);
                await loadMessages(thread.thread_id);
              }}
            >
              <p className="font-medium">{thread.wa_number}</p>
              <p className="text-xs text-muted-foreground">{thread.last_message || "-"}</p>
            </button>
          ))}
          <PaginationControls page={threadPage} totalPages={totalThreadPages} onPageChange={setThreadPage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conversation Actions</CardTitle></CardHeader>
        <CardContent>
          {!selectedThreadId ? (
            <p className="text-sm text-muted-foreground">Pilih thread dulu.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => pauseAi(selectedThreadId)}>Pause AI</Button>
                <Button size="sm" variant="secondary" onClick={() => toggleNonAi(selectedThreadId, true)}>Set Non-AI</Button>
                <Button size="sm" variant="outline" onClick={() => toggleNonAi(selectedThreadId, false)}>Remove Non-AI</Button>
              </div>
              <div className="max-h-[340px] space-y-2 overflow-auto">
                {messages.map((m) => (
                  <div key={m.id} className="rounded-md border p-2">
                    <p className="text-xs text-muted-foreground">{m.direction}</p>
                    <p className="text-sm">{m.body}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function BookingSection({ bookings }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const filteredBookings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      const matchesQuery =
        !q ||
        String(booking.vehicle || "").toLowerCase().includes(q) ||
        String(booking.plate || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || String(booking.status || "").toLowerCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [bookings, query, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const pagedBookings = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, page, pageSize]);
  const bookingStatuses = useMemo(
    () => ["all", ...new Set(bookings.map((booking) => String(booking.status || "").toLowerCase()).filter(Boolean))],
    [bookings]
  );

  return (
    <Card>
      <CardHeader><CardTitle>Today Booking Queue</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Cari vehicle atau plate..."
            className="h-8 max-w-xs"
          />
          <SimpleFilterSelect
            value={statusFilter}
            onChange={(next) => {
              setStatusFilter(next);
              setPage(1);
            }}
            options={bookingStatuses}
          />
          <RowsPerPageSelect
            value={pageSize}
            onChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Vehicle</TableHead><TableHead>Plate</TableHead><TableHead>Status</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {pagedBookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.vehicle}</TableCell>
                <TableCell>{b.plate}</TableCell>
                <TableCell>{b.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
      </CardContent>
    </Card>
  );
}

export function EscalationsSection({ escalations }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const filteredEscalations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return escalations.filter((escalation) => {
      const matchesQuery =
        !q ||
        String(escalation.type || "").toLowerCase().includes(q) ||
        String(escalation.thread_id || "").toLowerCase().includes(q) ||
        String(escalation.target_role || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" || String(escalation.status || "").toLowerCase() === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [escalations, query, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredEscalations.length / pageSize));
  const pagedEscalations = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEscalations.slice(start, start + pageSize);
  }, [filteredEscalations, page, pageSize]);
  const escalationStatuses = useMemo(
    () => ["all", ...new Set(escalations.map((escalation) => String(escalation.status || "").toLowerCase()).filter(Boolean))],
    [escalations]
  );

  return (
    <Card>
      <CardHeader><CardTitle>Escalation Monitor</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Cari type, target, atau thread..."
            className="h-8 max-w-xs"
          />
          <SimpleFilterSelect
            value={statusFilter}
            onChange={(next) => {
              setStatusFilter(next);
              setPage(1);
            }}
            options={escalationStatuses}
          />
          <RowsPerPageSelect
            value={pageSize}
            onChange={(next) => {
              setPageSize(next);
              setPage(1);
            }}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Type</TableHead><TableHead>Target</TableHead><TableHead>Status</TableHead><TableHead>Thread</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {pagedEscalations.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.type}</TableCell>
                <TableCell>{e.target_role}</TableCell>
                <TableCell>{e.status}</TableCell>
                <TableCell>{e.thread_id}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
      </CardContent>
    </Card>
  );
}

export function WahaSection({ sessions, onRefresh }) {
  const [newSessionName, setNewSessionName] = useState("");
  const [sessionQr, setSessionQr] = useState("");
  const [qrSessionName, setQrSessionName] = useState("");
  const [wahaError, setWahaError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (session) =>
        String(session.name || "").toLowerCase().includes(q) ||
        String(session.status || "").toLowerCase().includes(q)
    );
  }, [sessions, query]);
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const pagedSessions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, page, pageSize]);

  async function createSession() {
    if (!newSessionName.trim()) return;
    try {
      setWahaError("");
      const result = await api("/waha/sessions", {
        method: "POST",
        body: JSON.stringify({ name: newSessionName.trim(), start: true })
      });
      if (result?.alreadyExists) {
        setWahaError("Session 'default' sudah ada. Lanjut klik Start atau QR.");
        toast.info("Session sudah ada, lanjut Start atau QR.");
      }
      setNewSessionName("");
      toast.success("Session berhasil dibuat");
      await onRefresh();
    } catch (error) {
      setWahaError(error.message);
      toast.error(`Gagal create session: ${String(error.message || error)}`);
    }
  }

  async function startSession(name) {
    try {
      setWahaError("");
      await api(`/waha/sessions/${name}/start`, { method: "POST" });
      toast.success(`Session ${name} berhasil di-start`);
      await onRefresh();
    } catch (error) {
      setWahaError(error.message);
      toast.error(`Gagal start session: ${String(error.message || error)}`);
    }
  }

  async function fetchQr(name) {
    try {
      setWahaError("");
      const data = await api(`/waha/sessions/${name}/qr`);
      if (data?.qrUnavailable) {
        setWahaError(`${data.message} (${data.dashboardUrl})`);
        return;
      }
      setQrSessionName(name);
      setSessionQr(data.qr || data.base64 || "");
      toast.success(`QR session ${name} berhasil di-load`);
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("Cannot GET /api/sessions/") && message.includes("/auth/qr")) {
        setWahaError("QR API tidak tersedia di WAHA Core. Scan QR lewat WAHA dashboard: http://localhost:3000");
      } else {
        setWahaError(message);
      }
      toast.error(`Gagal load QR: ${message}`);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Session Management</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {wahaError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {wahaError}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Input
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="default"
              className="max-w-xs"
            />
            <Button onClick={createSession}>Create</Button>
            <Button variant="outline" onClick={onRefresh}>Reload</Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Cari nama session atau status..."
              className="h-8 max-w-xs"
            />
            <RowsPerPageSelect
              value={pageSize}
              onChange={(next) => {
                setPageSize(next);
                setPage(1);
              }}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {pagedSessions.map((s, idx) => (
                <TableRow key={s.name || idx}>
                  <TableCell>{s.name || "-"}</TableCell>
                  <TableCell>{s.status || "unknown"}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="secondary" onClick={() => startSession(s.name)}>Start</Button>
                    <Button size="sm" variant="outline" onClick={() => fetchQr(s.name)}>QR</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>

      {sessionQr ? (
        <Card>
          <CardHeader><CardTitle>QR {qrSessionName}</CardTitle></CardHeader>
          <CardContent>
            <img
              alt="WAHA QR"
              className="h-56 w-56 rounded border object-contain"
              src={sessionQr.startsWith("data:") ? sessionQr : `data:image/png;base64,${sessionQr}`}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PaginationControls({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="sticky bottom-0 mt-3 flex items-center justify-end gap-2 rounded-md border bg-background/95 p-2 backdrop-blur">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Prev
      </Button>
      <span className="text-xs text-muted-foreground">
        Page {page} / {totalPages}
      </span>
      <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </Button>
    </div>
  );
}

function RowsPerPageSelect({ value, onChange }) {
  return (
    <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
      <SelectTrigger className="h-8 w-24">
        <SelectValue placeholder="Rows" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="5">5 rows</SelectItem>
        <SelectItem value="10">10 rows</SelectItem>
        <SelectItem value="25">25 rows</SelectItem>
        <SelectItem value="50">50 rows</SelectItem>
      </SelectContent>
    </Select>
  );
}

function SimpleFilterSelect({ value, onChange, options }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-28">
        <SelectValue placeholder="Filter" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option === "all" ? "All status" : option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const defaultWorkflowRules = {
  autoReplyFallback: true,
  autoReplyBooking: true,
  autoEscalateComplaint: true,
  pauseAiWhenHumanActive: true,
  enforceBookingCutoff: true,
  enableBridgePolling: true
};

export function WorkflowRulesSection() {
  const [rules, setRules] = useState(defaultWorkflowRules);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRules() {
      try {
        setError("");
        const data = await api("/workflow-rules");
        setRules({ ...defaultWorkflowRules, ...(data.rules || {}) });
      } catch (err) {
        setError(String(err.message || "Failed to load workflow rules"));
      } finally {
        setLoading(false);
      }
    }
    loadRules();
  }, []);

  async function updateRule(key, value) {
    const next = { ...rules, [key]: value };
    setRules(next);
    setSaving(true);
    try {
      setError("");
      const data = await api("/workflow-rules", {
        method: "PUT",
        body: JSON.stringify({ rules: { [key]: value } })
      });
      setRules({ ...defaultWorkflowRules, ...(data.rules || next) });
    } catch (err) {
      setRules(rules);
      setError(String(err.message || "Failed to save workflow rule"));
    } finally {
      setSaving(false);
    }
  }

  const ruleItems = [
    {
      key: "autoReplyFallback",
      title: "Auto reply fallback (Subflow H)",
      description: "Kirim balasan otomatis ketika intent masuk fallback_admin."
    },
    {
      key: "autoReplyBooking",
      title: "Auto reply booking (Subflow A)",
      description: "Kirim konfirmasi otomatis setelah booking dibuat."
    },
    {
      key: "autoEscalateComplaint",
      title: "Auto escalate complaint",
      description: "Eskalasi komplain ke admin tanpa approval manual."
    },
    {
      key: "pauseAiWhenHumanActive",
      title: "Pause AI saat admin aktif",
      description: "Terapkan AI pause jika thread diambil alih manusia."
    },
    {
      key: "enforceBookingCutoff",
      title: "Enforce booking cutoff",
      description: "Aktifkan validasi cutoff jam tutup untuk booking."
    },
    {
      key: "enableBridgePolling",
      title: "Enable WAHA bridge polling",
      description: "Gunakan bridge polling WAHA -> n8n saat webhook event tidak tersedia."
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {ruleItems.map((rule) => (
          <div
            key={rule.key}
            className="flex items-start justify-between gap-3 rounded-md border border-border/80 bg-muted/20 p-3"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">{rule.title}</p>
              <p className="text-xs text-muted-foreground">{rule.description}</p>
            </div>
            <Button
              size="sm"
              variant={rules[rule.key] ? "secondary" : "outline"}
              className={rules[rule.key] ? "border border-border/60" : ""}
              onClick={() => updateRule(rule.key, !rules[rule.key])}>
              {rules[rule.key] ? "Enabled" : "Disabled"}
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {loading
            ? "Memuat rules dari server..."
            : saving
              ? "Menyimpan perubahan ke server..."
              : "Rules disimpan di database dan shared ke semua admin."}
        </p>
      </CardContent>
    </Card>
  );
}
