"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { apiClient, Project } from "@/lib/api";
import { formatDate } from "@/lib/time-utils";

export default function AdminPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<{ version: string; git_sha: string; git_time: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [projectList, versionInfo] = await Promise.all([
        apiClient.listProjects(),
        fetch("/api/v1/version").then(r => r.json()).catch(() => null)
      ]);
      setProjects(projectList);
      setVersion(versionInfo);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SiteHeader 
        rightSlot={
          <Badge variant="outline" className="border-red-500/50 text-red-400">
            Admin Mode
          </Badge>
        }
      />

      {/* Page Header */}
      <div className="border-b border-zinc-800 px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-zinc-400 mt-1">Human God Mode — Manage agent roles and project governance</p>
            </div>
            {version && (
              <div className="text-right text-xs text-zinc-500">
                <div>v{version.version}</div>
                <div className="font-mono">{version.git_sha}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-white mb-4">Projects</h2>

        {loading ? (
          <div className="text-zinc-400">Loading...</div>
        ) : projects.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="py-8 text-center text-zinc-400">
              No projects yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/admin/projects/${project.id}`}>
                <Card className="bg-zinc-900 border-zinc-800 hover:border-red-500/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white">{project.name}</CardTitle>
                    <CardDescription className="text-zinc-400">
                      {project.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-500">
                      Created {formatDate(project.created_at)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
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
