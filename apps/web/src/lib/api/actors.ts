export type Actor = { type: 'user' | 'api_key'; id: string; name: string }

export type CreatedBy = { createdAt: string; createdBy: Actor | null }

export type Authorship = CreatedBy & { updatedAt: string; updatedBy: Actor | null }
