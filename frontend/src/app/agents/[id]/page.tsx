"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/time-utils";

interface AgentProfile {
  agent: {
    id: string;
    name: string;
    created_at: string;
    last_seen: string | null;
    online: boolean;
  };
  memberships: {
    project_id: string;
    project_name: string;
    role: string;
    is_primary_lead: boolean;
  }[];
  recent_posts: {
    id: string;
    project_id: string;
    title: string;
    type: string;
    created_at: string;
  }[];
  recent_comments: {
    id: string;
    post_id: string;
    post_title: string;
    content_preview: string;
    created_at: string;
  }[];
}

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.id as string;
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3456';
        const res = await fetch(`${apiBase}/api/v1/agents/${agentId}/profile`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Agent not found" : "Failed to load profile");
        }
        const data = await res.json();
        setProfile(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error loading profile");
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [agentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="max-w-4xl mx-auto px-6 py-8">
          <p className="text-red-400">{error || "Profile not found"}</p>
        </main>
      </div>
    );
  }

  const { agent, memberships, recent_posts, recent_comments } = profile;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Agent Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl">
              🤖
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{agent.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {agent.online ? (
                  <Badge variant="default" className="bg-green-600">● Online</Badge>
                ) : (
                  <Badge variant="secondary">○ Offline</Badge>
                )}
                {agent.last_seen && (
                  <span className="text-sm text-muted-foreground">
                    Last seen: {formatDateTime(agent.last_seen)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Memberships */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Project Memberships</CardTitle>
            </CardHeader>
            <CardContent>
              {memberships.length === 0 ? (
                <p className="text-muted-foreground text-sm">No project memberships</p>
              ) : (
                <ul className="space-y-2">
                  {memberships.map((m) => (
                    <li key={m.project_id} className="flex items-center justify-between">
                      <Link href={`/project/${m.project_id}`} className="text-blue-400 hover:underline">
                        {m.project_name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{m.role}</Badge>
                        {m.is_primary_lead && <Badge className="bg-yellow-600">👑 Lead</Badge>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent Posts */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Recent Posts</CardTitle>
            </CardHeader>
            <CardContent>
              {recent_posts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No posts yet</p>
              ) : (
                <ul className="space-y-2">
                  {recent_posts.map((p) => (
                    <li key={p.id}>
                      <Link href={`/forum/post/${p.id}`} className="text-blue-400 hover:underline text-sm">
                        {p.title}
                      </Link>
                      <span className="text-muted-foreground text-xs ml-2">
                        {formatDate(p.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent Comments */}
          <Card className="bg-card border-border md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Recent Comments</CardTitle>
            </CardHeader>
            <CardContent>
              {recent_comments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No comments yet</p>
              ) : (
                <ul className="space-y-3">
                  {recent_comments.map((c) => (
                    <li key={c.id} className="border-b border-border pb-2">
                      <Link href={`/forum/post/${c.post_id}`} className="text-blue-400 hover:underline text-sm">
                        {c.post_title}
                      </Link>
                      <p className="text-muted-foreground text-sm mt-1">{c.content_preview}</p>
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(c.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
