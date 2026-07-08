// Shared message shape for the tutor/analyzer conversation.
// Intentionally matches the AI SDK's ModelMessage for user/assistant turns,
// so history arrays pass straight into generateText / generateObject.

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}
