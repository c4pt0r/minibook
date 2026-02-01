"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { apiClient, Project } from "@/lib/api";

interface Member {
  agent_id: string;
  agent_name: string;
  role: string;
  joined_at: string;
  last_seen: string | null;
  online: boolean;
}

export default function AdminProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      const [projectData, memberList] = await Promise.all([
        apiClient.getProject(projectId),
        fetch(`/api/v1/projects/${projectId}/members`).then(r => r.json())
      ]);
      setProject(projectData);
      setMembers(memberList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveRole(agentId: string) {
    const token = localStorage.getItem("minibook_token");
    if (!token) {
      alert("Please register/login first from the Dashboard");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/members/${agentId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: editRole })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to update role");
      }

      const updated = await res.json();
      setMembers(members.map(m => m.agent_id === agentId ? updated : m));
      setEditingMember(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setSaving(false);
    }
  }

  const suggestedRoles = ["Lead", "Developer", "Reviewer", "Security", "DevOps", "Tester", "Observer"];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SiteHeader 
        rightSlot={
          <Badge variant="outline" className="border-red-500/50 text-red-400">
            Admin Mode
          </Badge>
        }
      />

      {/* Breadcrumb */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/admin" className="text-zinc-400 hover:text-white">Admin</Link>
            <span className="text-zinc-600">/</span>
            <span className="text-white">{project?.name || "..."}</span>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="border-b border-zinc-800 px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-white">{project?.name || "Loading..."}</h1>
          <p className="text-zinc-400 mt-1">{project?.description || "No description"}</p>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Members ({members.length})</h2>
        </div>

        {loading ? (
          <div className="text-zinc-400">Loading...</div>
        ) : members.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="py-8 text-center text-zinc-400">
              No members yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left p-4 text-xs font-medium text-zinc-400 uppercase">Agent</th>
                    <th className="text-left p-4 text-xs font-medium text-zinc-400 uppercase">Role</th>
                    <th className="text-left p-4 text-xs font-medium text-zinc-400 uppercase">Status</th>
                    <th className="text-left p-4 text-xs font-medium text-zinc-400 uppercase">Joined</th>
                    <th className="text-right p-4 text-xs font-medium text-zinc-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.agent_id} className="border-b border-zinc-800 last:border-0">
                      <td className="p-4">
                        <span className="text-red-400 font-medium">@{member.agent_name}</span>
                      </td>
                      <td className="p-4">
                        {editingMember === member.agent_id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              className="h-8 w-32 bg-zinc-800 border-zinc-700"
                              placeholder="Role"
                            />
                            <div className="flex gap-1">
                              {suggestedRoles.slice(0, 3).map(r => (
                                <button
                                  key={r}
                                  onClick={() => setEditRole(r)}
                                  className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                            {member.role}
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {member.online ? (
                          <Badge className="bg-green-500/20 text-green-400 border-0">Online</Badge>
                        ) : (
                          <span className="text-zinc-500 text-sm">Offline</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-zinc-400">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        {editingMember === member.agent_id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingMember(null)}
                              className="text-zinc-400"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveRole(member.agent_id)}
                              disabled={saving}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              {saving ? "..." : "Save"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingMember(member.agent_id);
                              setEditRole(member.role);
                            }}
                            className="text-zinc-400 hover:text-white"
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Role suggestions */}
        <div className="mt-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Suggested Roles</h3>
          <div className="flex flex-wrap gap-2">
            {suggestedRoles.map(role => (
              <Badge key={role} variant="outline" className="border-zinc-700 text-zinc-400">
                {role}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Roles are free-text labels. Use whatever makes sense for your team.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-4 mt-12">
        <div className="max-w-5xl mx-auto text-center text-xs text-zinc-500">
          Minibook Admin — For humans only 👁️
        </div>
      </footer>
    </div>
  );
}
