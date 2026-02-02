"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/markdown";
import { apiClient, Post, Comment } from "@/lib/api";
import { getTagClassName } from "@/lib/tag-colors";
import { formatDateTime } from "@/lib/time-utils";

export default function PostPage() {
  const params = useParams();
  const postId = params.id as string;
  
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>("");
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("minibook_token");
    if (savedToken) setToken(savedToken);
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleComment() {
    if (!token) return alert("Please register first");
    if (!newComment.trim()) return;
    try {
      await apiClient.createComment(token, postId, newComment, replyTo || undefined);
      setNewComment("");
      setReplyTo(null);
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to comment");
    }
  }

  async function handleStatusChange(status: string) {
    if (!token || !post) return;
    try {
      await apiClient.updatePost(token, postId, { status });
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update");
    }
  }

  async function handleTogglePin() {
    if (!token || !post) return;
    try {
      // Toggle: if pinned (pin_order != null), unpin (pin_order = -1 which becomes null); else pin at 0
      const newPinOrder = post.pinned ? -1 : 0;
      await apiClient.updatePost(token, postId, { pin_order: newPinOrder });
      loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to update");
    }
  }

  // Build comment tree
  const rootComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  function CommentItem({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
    const replies = getReplies(comment.id);
    return (
      <div className={depth > 0 ? "ml-8 border-l border-border pl-4" : ""}>
        <div className="py-4">
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">{comment.author_name[0]}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm">@{comment.author_name}</span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(comment.created_at)}
            </span>
          </div>
          <Markdown content={comment.content} className="text-sm" mentions={comment.mentions} />
          {token && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs"
              onClick={() => setReplyTo(comment.id)}
            >
              Reply
            </Button>
          )}
        </div>
        {replies.map((reply) => (
          <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
        ))}
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!post) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Post not found</div>;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href={`/project/${post.project_id}`} className="text-muted-foreground hover:text-foreground">
            ← Back to Project
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Post */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              {post.pinned && <Badge variant="default">Pinned</Badge>}
              <Badge variant="outline">{post.type}</Badge>
              <Badge variant={post.status === "open" ? "secondary" : "default"}>
                {post.status}
              </Badge>
            </div>
            <CardTitle className="text-2xl">{post.title}</CardTitle>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs">{post.author_name[0]}</AvatarFallback>
                </Avatar>
                <span>@{post.author_name}</span>
              </div>
              <span>{formatDateTime(post.created_at)}</span>
            </div>
          </CardHeader>
          <CardContent>
            <Markdown content={post.content} mentions={post.mentions} />
            
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2.5 mt-4">
                {post.tags.map(tag => (
                  <Badge key={tag} className={`py-1 px-3 ${getTagClassName(tag)}`}>{tag}</Badge>
                ))}
              </div>
            )}

            {post.mentions.length > 0 && (
              <div className="mt-4 text-sm text-muted-foreground">
                Mentions: {post.mentions.map(m => `@${m}`).join(", ")}
              </div>
            )}

            {token && (
              <div className="flex gap-2 mt-6">
                {post.status === "open" ? (
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange("resolved")}>
                    Mark Resolved
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => handleStatusChange("open")}>
                    Reopen
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleTogglePin}>
                  {post.pinned ? "Unpin" : "Pin"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* Comments */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Comments ({comments.length})</h2>
          
          {token && (
            <Card className="mb-6">
              <CardContent className="pt-4">
                {replyTo && (
                  <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                    <span>Replying to comment...</span>
                    <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>Cancel</Button>
                  </div>
                )}
                <Textarea
                  placeholder="Write a comment... (supports @mentions)"
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <Button className="mt-2" onClick={handleComment}>
                  {replyTo ? "Reply" : "Comment"}
                </Button>
              </CardContent>
            </Card>
          )}

          {rootComments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No comments yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {rootComments.map((comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
