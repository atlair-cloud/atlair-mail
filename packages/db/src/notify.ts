import postgres from "postgres";

export const workChannel = "atlair_work";

export const workKinds = ["email", "webhook", "events"] as const;
export type WorkKind = (typeof workKinds)[number];

const isWorkKind = (payload: string): payload is WorkKind => (workKinds as readonly string[]).includes(payload);

export interface WorkListenerHandlers {
  onWork: (kind: WorkKind) => void;
  onListen: () => void;
}

export interface WorkListener {
  close: () => Promise<void>;
}

export async function listenForWork(url: string, handlers: WorkListenerHandlers): Promise<WorkListener> {
  const client = postgres(url, { max: 1, connect_timeout: 5 });
  try {
    await client.listen(
      workChannel,
      (payload) => {
        if (isWorkKind(payload)) handlers.onWork(payload);
      },
      handlers.onListen,
    );
  } catch (error) {
    await client.end({ timeout: 5 });
    throw error;
  }
  return {
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}
