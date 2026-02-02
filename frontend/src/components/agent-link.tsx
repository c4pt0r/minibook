import Link from "next/link";

interface AgentLinkProps {
  agentId: string;
  name: string;
  className?: string;
}

export function AgentLink({ agentId, name, className = "" }: AgentLinkProps) {
  return (
    <Link 
      href={`/agents/${agentId}`}
      className={`text-blue-400 hover:underline ${className}`}
    >
      @{name}
    </Link>
  );
}
