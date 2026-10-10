<script setup lang="ts">
const snippet = `import { Webhook } from "standardwebhooks";

const wh = new Webhook(process.env.ATLAIR_WEBHOOK_SECRET);
const event = wh.verify(rawBody, {
  "webhook-id": req.headers["webhook-id"],
  "webhook-timestamp": req.headers["webhook-timestamp"],
  "webhook-signature": req.headers["webhook-signature"],
});`
</script>

<template>
  <div class="grid gap-3 text-sm text-slate-600">
    <p class="m-0 leading-relaxed">
      Requests follow <a href="https://www.standardwebhooks.com/" target="_blank" rel="noopener" class="font-medium text-slate-800 underline decoration-slate-300 underline-offset-4">Standard Webhooks</a>.
      Verify the raw body before parsing it, answer with any 2xx, and use <span class="font-mono text-slate-800">webhook-id</span> to drop duplicates. Failed deliveries retry 8 times over about 27 hours.
    </p>
    <pre class="m-0 overflow-x-auto rounded-sm bg-[#14171a] p-3 font-mono text-[12px] leading-relaxed text-[#d6dbe0]"><code>{{ snippet }}</code></pre>
  </div>
</template>
