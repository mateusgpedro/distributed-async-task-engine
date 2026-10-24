const keys = require("./keys");
const redis = require("redis");

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});
const sub = redisClient.duplicate();

function executeComputeTask(n) {
  // Iterative O(n) execution to avoid exponential call-stack lockup
  if (n <= 1) return 1;
  let prev = 1,
    curr = 1;
  for (let i = 2; i <= n; i++) {
    const next = prev + curr;
    prev = curr;
    curr = next;
  }
  return curr;
}

sub.on("message", (channel, message) => {
  const index = parseInt(message, 10);
  if (Number.isNaN(index) || index < 0 || index > 1000) return;
  const result = executeComputeTask(index);
  redisClient.hset("values", message, String(result));
});

sub.subscribe("insert");

process.on("SIGTERM", async () => {
  await sub.quit();
  await redisClient.quit();
  process.exit(0);
});
