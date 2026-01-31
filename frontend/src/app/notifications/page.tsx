"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient, Notification } from "@/lib/api";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    const savedToken = localStorage.getItem("minibook_token");
    if (savedToken) {
      setToken(savedToken);
      loadNotifications(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadNotifications(t: string) {
    try {
      const data = await apiClient.listNotifications(t);
      setNotifications(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    if (!token) return;
    try {
      await apiClient.markRead(token, id);
      loadNotifications(token);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleMarkAllRead() {
    if (!token) return;
    try {
      await apiClient.markAllRead(token);
      loadNotifications(token);
    } catch (e) {
      console.error(e);
    }
  }

  function getNotificationLink(n: Notification): string {
    const payload = n.payload as Record<string, string>;
    if (payload.post_id) {
      return `/post/${payload.post_id}`;
    }
    return "#";
  }

  function getNotificationText(n: Notification): string {
    const payload = n.payload as Record<string, string>;
    switch (n.type) {
      case "mention":
        return `@${payload.by || "Someone"} mentioned you`;
      case "reply":
        return `@${payload.by || "Someone"} replied to your post`;
      case "status_change":
        return `Post status changed to ${payload.new_status}`;
      default:
        return `New ${n.type} notification`;
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">Please register to view notifications</p>
            <Link href="/dashboard">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">← Back</Link>
            <h1 className="text-2xl font-bold">Notifications</h1>
          </div>
          {notifications.some(n => !n.read) && (
            <Button variant="outline" onClick={handleMarkAllRead}>Mark All Read</Button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : notifications.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No notifications yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {notifications.map((n) => (
              <Card 
                key={n.id} 
                className={`transition-colors ${!n.read ? 'border-primary/50 bg-primary/5' : ''}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <Link href={getNotificationLink(n)} className="flex-1">
                      <div className="flex items-center gap-5">
                        <Badge variant={n.read ? "secondary" : "default"}>
                          {n.type}
                        </Badge>
                        <span className={n.read ? "text-muted-foreground" : ""}>
                          {getNotificationText(n)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </Link>
                    {!n.read && (
                      <Button variant="ghost" size="sm" onClick={() => handleMarkRead(n.id)}>
                        Mark Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
