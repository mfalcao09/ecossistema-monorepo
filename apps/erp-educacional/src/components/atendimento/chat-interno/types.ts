export interface ChatAgent {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  availability_status?: string;
}

export interface ChatMember {
  agent_id: string;
  last_read_at: string;
  muted: boolean;
  atendimento_agents: ChatAgent | ChatAgent[] | null;
}

export type ChatKind = "dm" | "group" | "team";

export interface TeamLite {
  id: string;
  name: string;
  color_hex: string | null;
}

export interface ChatItem {
  id: string;
  kind: ChatKind;
  team_id: string | null;
  title: string | null;
  created_by: string | null;
  last_message_at: string | null;
  created_at: string;
  teams: TeamLite | TeamLite[] | null;
  members: ChatMember[];
  unread_count: number;
  muted: boolean;
  last_read_at: string;
  last_message: { id: string; body: string; author_id: string; created_at: string; deleted_at: string | null } | null;
}

export interface RefItem {
  type: "conversation" | "deal" | "contact";
  id: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  author_id: string;
  body: string;
  reply_to_id: string | null;
  mentions: string[];
  refs: RefItem[];
  reactions: Record<string, string[]>;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  atendimento_agents: ChatAgent | ChatAgent[] | null;
}

export function unwrapAgent(a: ChatAgent | ChatAgent[] | null | undefined): ChatAgent | null {
  if (!a) return null;
  if (Array.isArray(a)) return a[0] ?? null;
  return a;
}

export function unwrapTeam(t: TeamLite | TeamLite[] | null | undefined): TeamLite | null {
  if (!t) return null;
  if (Array.isArray(t)) return t[0] ?? null;
  return t;
}

export function chatDisplayTitle(chat: ChatItem, myAgentId: string | null): string {
  if (chat.kind === "team") {
    const team = unwrapTeam(chat.teams);
    return team?.name ?? chat.title ?? "Equipe";
  }
  if (chat.kind === "group") {
    return chat.title ?? "Grupo";
  }
  // dm: mostra o outro agent
  const other = chat.members.find((m) => m.agent_id !== myAgentId);
  const agent = unwrapAgent(other?.atendimento_agents);
  return agent?.name ?? chat.title ?? "DM";
}

export function chatDisplayAvatar(chat: ChatItem, myAgentId: string | null): string | null {
  if (chat.kind === "dm") {
    const other = chat.members.find((m) => m.agent_id !== myAgentId);
    const agent = unwrapAgent(other?.atendimento_agents);
    return agent?.avatar_url ?? null;
  }
  return null;
}
