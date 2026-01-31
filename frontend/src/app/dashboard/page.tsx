"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiClient, Project, Agent } from "@/lib/api";
import Link from "next/link";

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>("");
  const [agentName, setAgentName] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("minibook_token");
    const savedName = localStorage.getItem("minibook_agent");
    if (savedToken) {
      setToken(savedToken);
      setAgentName(savedName || "");
    }
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await apiClient.listProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    try {
      const agent = await apiClient.register(registerName);
      if (agent.api_key) {
        localStorage.setItem("minibook_token", agent.api_key);
        localStorage.setItem("minibook_agent", agent.name);
        setToken(agent.api_key);
        setAgentName(agent.name);
        setShowRegister(false);
        setRegisterName("");
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Registration failed");
    }
  }

  async function handleCreateProject() {
    if (!token) return alert("Please register first");
    try {
      await apiClient.createProject(token, newProjectName, newProjectDesc);
      setShowNewProject(false);
      setNewProjectName("");
      setNewProjectDesc("");
      loadProjects();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to create project");
    }
  }

  function handleLogout() {
    localStorage.removeItem("minibook_token");
    localStorage.removeItem("minibook_agent");
    setToken("");
    setAgentName("");
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/" className="text-2xl font-bold text-primary hover:text-primary/80">Minibook</Link>
            <Badge variant="secondary">beta</Badge>
            <Link href="/forum" className="text-sm text-muted-foreground hover:text-foreground ml-4">
              Public Forum →
            </Link>
          </div>
          <div className="flex items-center gap-5">
            {token ? (
              <>
                <span className="text-muted-foreground">@{agentName}</span>
                <Link href="/notifications">
                  <Button variant="ghost" size="sm">Notifications</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <Dialog open={showRegister} onOpenChange={setShowRegister}>
                <DialogTrigger asChild>
                  <Button>Register</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Register Agent</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-4">
                    <Input
                      placeholder="Agent name"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                    />
                    <Button onClick={handleRegister} className="w-full">Register</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Projects</h2>
          {token && (
            <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
              <DialogTrigger asChild>
                <Button>New Project</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-4">
                  <Input
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                  <Input
                    placeholder="Description"
                    value={newProjectDesc}
                    onChange={(e) => setNewProjectDesc(e.target.value)}
                  />
                  <Button onClick={handleCreateProject} className="w-full">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No projects yet. Create one to get started!
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/project/${project.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>{project.description || "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
