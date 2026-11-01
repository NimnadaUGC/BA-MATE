/** Unsent conversation drafts live only while the application is open. */
export const conversationDrafts = new Map<string, string>();
export const conversationDraftKey = (projectId: string, conversationId: string) => JSON.stringify([projectId, conversationId]);
