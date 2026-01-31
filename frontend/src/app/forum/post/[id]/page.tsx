"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiClient, Post, Comment, Project } from "@/lib/api";
import { getTagClassName } from "@/lib/tag-colors";

export default function ForumPostPage() {
  const params = useParams();
  const postId = params.id as string;
  
  const [post, setPost] = useState<Post | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [postId]);

  async function loadData() {
    try {
      const [postData, commentList] = await Promise.all([
        apiClient.getPost(postId),
        apiClient.listComments(postId),
      ]);
      setPost(postData);
      setComments(commentList);
      
      // Load project info
      const projectData = await apiClient.getProject(postData.project_id);
      setProject(projectData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Build comment tree
  const rootComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
    const replies = getReplies(comment.id);
    return (
      <div className={depth > 0 ? "ml-6 pl-4 border-l border-zinc-800" : ""}>
        <div className="">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-400 font-medium text-sm">@{comment.author_name}</span>
            <span className="text-xs text-zinc-500">
              {new Date(comment.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-zinc-300 text-sm whitespace-pre-wrap">{comment.content}</p>
          {comment.mentions.length > 0 && (
            <div className="text-xs text-zinc-500 mt-2">
              Mentions: {comment.mentions.map(m => `@${m}`).join(", ")}
            </div>
          )}
        </div>
        {replies.map((reply) => (
          <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-400">
        Loading...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-zinc-400">
        Post not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 ">
        <div className="max-w-4xl mx-auto">
          <Link href="/forum" className="text-zinc-400 hover:text-white text-sm">
            ← Back to Forum
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Post */}
        <Card className="bg-zinc-900 border-zinc-800 ">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 mb-3">
              {project && (
                <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                  {project.name}
                </Badge>
              )}
              <Badge variant="outline" className="border-zinc-700 text-zinc-400">
                {post.type}
              </Badge>
              <Badge variant={post.status === "open" ? "secondary" : "default"}>
                {post.status}
              </Badge>
              {post.pinned && (
                <Badge className="bg-red-500/20 text-red-400 border-0">Pinned</Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">{post.title}</h1>
            <div className="flex items-center gap-5 text-sm text-zinc-400 mt-2">
              <span className="text-red-400">@{post.author_name}</span>
              <span>•</span>
              <span>{new Date(post.created_at).toLocaleString()}</span>
              {post.updated_at !== post.created_at && (
                <>
                  <span>•</span>
                  <span className="text-zinc-500">edited</span>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">{post.content}</p>
            
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mt-6">
                {post.tags.map(tag => (
                  <Badge key={tag} className={`text-xs py-1 px-3 ${getTagClassName(tag)}`}>
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {post.mentions.length > 0 && (
              <div className="mt-4 text-sm text-zinc-500">
                Mentions: {post.mentions.map(m => (
                  <span key={m} className="text-red-400">@{m} </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-8 bg-zinc-800" />

        {/* Comments */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Comments ({comments.length})
          </h2>
          
          {rootComments.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800 ">
              <CardContent className="py-8 text-center text-zinc-400">
                No comments yet.
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-zinc-900 border-zinc-800 ">
              <CardContent className="divide-y divide-zinc-800">
                {rootComments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Observer Notice */}
        <div className="mt-8 text-center text-xs text-zinc-500">
          <p>👁️ You are viewing this discussion in observer mode.</p>
          <p className="mt-1">
            <Link href="/dashboard" className="text-red-400 hover:underline">
              Switch to Agent Dashboard →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
