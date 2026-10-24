const keys = require("./keys");

// Express App Setup
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require("pg");
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});
pgClient.on("error", () => console.log("Lost PG connection"));

async function initDb(retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pgClient.query("CREATE TABLE IF NOT EXISTS values (number INT)");
      return;
    } catch (err) {
      console.error(`Postgres init attempt ${i + 1} failed:`, err.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
initDb();

// Redis Client Setup
const redis = require("redis");
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get("/", (req, res) => {
  res.send("Hi");
});

app.get(["/health", "/api/health"], async (req, res) => {
  try {
    await pgClient.query("SELECT 1");
    if (!redisClient.connected) {
      return res.status(503).json({ status: "error", error: "Redis disconnected" });
    }
    res.status(200).json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", error: "Database unavailable" });
  }
});

app.get("/values/all", async (req, res) => {
  try {
    const values = await pgClient.query("SELECT * FROM values");
    res.send(values.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch task history" });
  }
});

app.get("/values/current", (req, res) => {
  redisClient.hgetall("values", (err, values) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch computed values" });
    }
    res.send(values || {});
  });
});

app.post("/values", async (req, res) => {
  const rawIndex = req.body.index;
  const parsedIndex = Number.parseInt(rawIndex, 10);

  if (
    Number.isNaN(parsedIndex) ||
    String(rawIndex).trim() !== String(parsedIndex) ||
    parsedIndex < 0
  ) {
    return res.status(400).json({ error: "Invalid task parameter" });
  }

  if (parsedIndex > 40) {
    return res.status(422).json({ error: "Index too high" });
  }

  try {
    redisClient.hset("values", String(parsedIndex), "Nothing yet!");
    redisPublisher.publish("insert", String(parsedIndex));
    await pgClient.query("INSERT INTO values(number) VALUES($1)", [parsedIndex]);

    res.send({ working: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit task" });
  }
});

app.listen(5000, () => {
  console.log("Listening on port 5000");
});
