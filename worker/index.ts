import handler from "vinext/server/app-router-entry";

interface WorkerContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const worker = {
  fetch(request: Request, env: unknown, context: WorkerContext) {
    return handler.fetch(request, env as any, context);
  }
};

export default worker;
