"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json();
}

export function CrmControlPanels({
  threads,
  bookings,
  escalations,
  sessions,
  onRefresh,
  onDataChanged,
  activeView = "inbox",
  onActiveViewChange = () => {}
}) {
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newSessionName, setNewSessionName] = useState("");
  const [sessionQr, setSessionQr] = useState("");
  const [qrSessionName, setQrSessionName] = useState("");
  const [wahaError, setWahaError] = useState("");

  const selectedThreadId = useMemo(() => selectedThread?.thread_id || "", [selectedThread]);

  async function loadMessages(threadId) {
    const data = await api(`/threads/${threadId}/messages`);
    setMessages(data.messages || []);
  }

  async function pauseAi(threadId) {
    await api("/chat/pause", { method: "POST", body: JSON.stringify({ threadId }) });
    await onDataChanged();
  }

  async function toggleNonAi(threadId, nonAi) {
    await api("/chat/non-ai", { method: "POST", body: JSON.stringify({ threadId, nonAi }) });
    await onDataChanged();
  }

  async function createSession() {
    if (!newSessionName.trim()) return;
    try {
      setWahaError("");
      await api("/waha/sessions", {
        method: "POST",
        body: JSON.stringify({ name: newSessionName.trim(), start: true })
      });
      setNewSessionName("");
      await onDataChanged();
    } catch (error) {
      setWahaError(error.message);
    }
  }

  async function startSession(name) {
    try {
      setWahaError("");
      await api(`/waha/sessions/${name}/start`, { method: "POST" });
      await onDataChanged();
    } catch (error) {
      setWahaError(error.message);
    }
  }

  async function fetchQr(name) {
    try {
      setWahaError("");
      const data = await api(`/waha/sessions/${name}/qr`);
      setQrSessionName(name);
      setSessionQr(data.qr || data.base64 || "");
    } catch (error) {
      setWahaError(error.message);
    }
  }

  return (
    <Tabs value={activeView} onValueChange={onActiveViewChange} className="px-4 lg:px-6">
      <TabsList>
        <TabsTrigger value="inbox">Inbox Control</TabsTrigger>
        <TabsTrigger value="bookings">Booking</TabsTrigger>
        <TabsTrigger value="escalations">Escalations</TabsTrigger>
        <TabsTrigger value="waha">WAHA Sessions</TabsTrigger>
      </TabsList>

      <TabsContent value="inbox" className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Threads</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {threads.map((thread) => (
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
      </TabsContent>

      <TabsContent value="bookings" className="mt-4">
        <Card>
          <CardHeader><CardTitle>Today Booking Queue</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Vehicle</TableHead><TableHead>Plate</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.vehicle}</TableCell>
                    <TableCell>{b.plate}</TableCell>
                    <TableCell>{b.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="escalations" className="mt-4">
        <Card>
          <CardHeader><CardTitle>Escalation Monitor</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Type</TableHead><TableHead>Target</TableHead><TableHead>Status</TableHead><TableHead>Thread</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {escalations.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.type}</TableCell>
                    <TableCell>{e.target_role}</TableCell>
                    <TableCell>{e.status}</TableCell>
                    <TableCell>{e.thread_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="waha" className="mt-4 space-y-4">
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
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s, idx) => (
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
      </TabsContent>
    </Tabs>
  );
}
