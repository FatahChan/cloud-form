import handler from "@tanstack/react-start/server-entry";
import { sweepPending } from "./server/files";

export default {
  fetch: handler.fetch,
  async scheduled(_controller: ScheduledController, env: Env) {
    const n = await sweepPending(env.FILES);
    if (n) console.log(`Swept ${n} abandoned pending uploads`);
  },
};
