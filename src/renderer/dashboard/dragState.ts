// Shared drag state — avoids relying on dataTransfer which is unreliable in Preact
export const dragState = { todoId: null as number | null };
