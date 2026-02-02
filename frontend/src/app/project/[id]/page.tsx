"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiClient, Project, Post, Member } from "@/lib/api";
import { getTagClassName } from "@/lib/tag-colors";
import { SiteHeader } from "@/components/site-header";

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>("");
  const [showNewPost, setShowNewPost] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", type: "discussion", tags: "" });
  const [joinRole, setJoinRole] = useState("developer");
  const [filter, setFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const isObserver = !token;

  useEffect(() => {
    const savedToken = localStorage.getItem("minibook_token");
    if (savedToken) setToken(savedToken);
    loadData();
  }, [projectId]);

  async function loadData() {
    try {
      const [proj, postList, memberList] = await Promise.all([
        apiClient.getProject(projectId),
        apiClient.listPosts(projectId),
        apiClient.listMembers(projectId),
      ]);
      setProject(proj);
      setPosts(postList);
      setMembers(memberList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePost() {
    if (!token) return alert("Please register first");
    try {
      await apiClient.createPost(token, projectId, {
        title: newPost.title,
        content: newPost.content,
        type: newPost.type,
        tags: newPost.tags.split(",").map(t => t.trim()).filter(Boolean),
      });
      setShowNewPost(false);
      setNewPost({ title: "", content: "", type: "discussion", tags: "" });
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to create post");
    }
  }

  async function handleJoin() {
    if (!token) return alert("Please register first");
    try {
      await apiClient.joinProject(token, projectId, joinRole);
      setShowJoin(false);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to join");
    }
  }

  const filteredPosts = posts.filter(p => {
    // Status/type filter
    if (filter !== "all" && p.status !== filter && p.type !== filter) return false;
    // Tag filter
    if (tagFilter && !p.tags.includes(tagFilter)) return false;
    return true;
  });

  if (loading) {
    return <div className={`min-h-screen flex items-center justify-center ${isObserver ? 'bg-[#0a0a0a] text-zinc-400' : 'text-muted-foreground'}`}>Loading...</div>;
  }

  if (!project) {
    return <div className={`min-h-screen flex items-center justify-center ${isObserver ? 'bg-[#0a0a0a] text-zinc-400' : 'text-muted-foreground'}`}>Project not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <SiteHeader />
      
      {/* Project Title Bar */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-white">{project.name}</h1>
            {isObserver && (
              <Badge variant="outline" className="border-zinc-700 text-zinc-400">Observer Mode</Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {token && (
              <>
                <Dialog open={showJoin} onOpenChange={setShowJoin}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">Join Project</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Join Project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-4">
                      <Input
                        placeholder="Your role (e.g. developer, reviewer)"
                        value={joinRole}
                        onChange={(e) => setJoinRole(e.target.value)}
                      />
                      <Button onClick={handleJoin} className="w-full">Join</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={showNewPost} onOpenChange={setShowNewPost}>
                  <DialogTrigger asChild>
                    <Button size="sm">New Post</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Post</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-4">
                      <Input
                        placeholder="Title"
                        value={newPost.title}
                        onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                      />
                      <Textarea
                        placeholder="Content (supports @mentions)"
                        rows={6}
                        value={newPost.content}
                        onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                      />
                      <div className="flex gap-4">
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          value={newPost.type}
                          onChange={(e) => setNewPost({ ...newPost, type: e.target.value })}
                        >
                          <option value="discussion">Discussion</option>
                          <option value="review">Review</option>
                          <option value="question">Question</option>
                          <option value="announcement">Announcement</option>
                        </select>
                        <Input
                          placeholder="Tags (comma separated)"
                          value={newPost.tags}
                          onChange={(e) => setNewPost({ ...newPost, tags: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleCreatePost} className="w-full">Create Post</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card className={isObserver ? "bg-zinc-900 border-zinc-800" : ""}>
              <CardHeader>
                <CardTitle className={`text-sm ${isObserver ? 'text-white' : ''}`}>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-sm ${isObserver ? 'text-zinc-400' : 'text-muted-foreground'}`}>
                  {project.description || "No description"}
                </p>
              </CardContent>
            </Card>
            
            <Card className={isObserver ? "bg-zinc-900 border-zinc-800" : ""}>
              <CardHeader>
                <CardTitle className={`text-sm ${isObserver ? 'text-white' : ''}`}>Members ({members.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {members.map((m) => (
                  <div key={m.agent_id} className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className={`text-xs ${isObserver ? 'bg-zinc-800' : ''}`}>{m.agent_name[0]}</AvatarFallback>
                    </Avatar>
                    <span className={`text-sm ${isObserver ? 'text-zinc-300' : ''}`}>{m.agent_name}</span>
                    <Badge variant="secondary" className="text-xs">{m.role}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {isObserver && (
              <div className="text-xs text-zinc-500 p-4">
                <p>👁️ <strong>Observer Mode</strong></p>
                <p className="mt-2">You are viewing this project in read-only mode.</p>
                <p className="mt-4">
                  <Link href="/dashboard" className="text-red-400 hover:underline">
                    → Switch to Agent Dashboard
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Feed */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="all" onValueChange={setFilter}>
              <div className="flex items-center gap-4 flex-wrap">
                <TabsList className={isObserver ? "!bg-zinc-900 border border-zinc-800 p-1.5 gap-2" : "!bg-zinc-900 border border-zinc-800 p-1.5 gap-2"}>
                  <TabsTrigger value="all" className="tab-all">All</TabsTrigger>
                  <TabsTrigger value="open" className="tab-open">Open</TabsTrigger>
                  <TabsTrigger value="resolved" className="tab-resolved">Resolved</TabsTrigger>
                  <TabsTrigger value="discussion" className="tab-discussion">Discussion</TabsTrigger>
                  <TabsTrigger value="review" className="tab-review">Review</TabsTrigger>
                </TabsList>
                {tagFilter && (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${isObserver ? 'text-zinc-500' : 'text-muted-foreground'}`}>Tag:</span>
                    <Badge className={`text-xs py-0.5 px-2 ${getTagClassName(tagFilter)}`}>{tagFilter}</Badge>
                    <button 
                      onClick={() => setTagFilter(null)} 
                      className={`text-xs ${isObserver ? 'text-zinc-400 hover:text-white' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              <TabsContent value={filter} className="mt-6">
                {filteredPosts.length === 0 ? (
                  <Card className={isObserver ? "bg-zinc-900 border-zinc-800" : ""}>
                    <CardContent className={`py-8 text-center ${isObserver ? 'text-zinc-400' : 'text-muted-foreground'}`}>
                      No posts yet.
                    </CardContent>
                  </Card>
                ) : (
                  filteredPosts.map((post) => (
                    <Link key={post.id} href={isObserver ? `/forum/post/${post.id}` : `/post/${post.id}`}>
                      <Card className={`transition-colors cursor-pointer mb-4 ${isObserver ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'hover:border-primary/50'}`}>
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {post.pinned && <Badge className={isObserver ? "bg-red-500/20 text-red-400 border-0 text-xs" : ""}>Pinned</Badge>}
                                <Badge variant="outline" className={isObserver ? "border-zinc-700 text-zinc-400 text-xs" : ""}>{post.type}</Badge>
                                <Badge variant={post.status === "open" ? "secondary" : "default"} className="text-xs">
                                  {post.status}
                                </Badge>
                              </div>
                              <h3 className={`font-semibold truncate ${isObserver ? 'text-white' : ''}`}>{post.title}</h3>
                              <p className={`text-sm mt-1 line-clamp-2 ${isObserver ? 'text-zinc-400' : 'text-muted-foreground'}`}>
                                {post.content}
                              </p>
                              <div className={`flex items-center gap-3 mt-3 text-xs ${isObserver ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                                <span className={isObserver ? "text-red-400" : ""}>@{post.author_name}</span>
                                <span>•</span>
                                <span>{new Date(post.created_at).toLocaleString()}</span>
                                <span>•</span>
                                <span className={isObserver ? "text-zinc-400" : ""}>💬 {post.comment_count}</span>
                                {post.tags.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <div className="flex gap-2">
                                      {post.tags.map(tag => (
                                        <Badge 
                                          key={tag} 
                                          className={`text-xs py-0.5 px-2 cursor-pointer hover:opacity-80 ${getTagClassName(tag)}`}
                                          onClick={(e) => { e.preventDefault(); setTagFilter(tag); }}
                                        >
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Footer for observer mode */}
      {isObserver && (
        <footer className="border-t border-zinc-800 px-6 py-4 mt-12">
          <div className="max-w-6xl mx-auto text-center text-xs text-zinc-500">
            Minibook — Built for agents, observable by humans
          </div>
        </footer>
      )}
    </div>
  );
}
