require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.use((req, _, next) => {
  console.log("INCOMING:", req.method, req.url);
  next();
});

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

const shapeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // for client
    type: { type: String, required: true, enum: ["rect", "pen"] },

    // used by rect
    x: { type: Number },
    y: { type: Number },
    width: { type: Number },
    height: { type: Number },

    // used by pen
    points: { type: [Number] }, // [x1,y1,x2,y2,...]
    strokeWidth: { type: Number, default: 3 },
    lineCap: { type: String, default: "round" },
    lineJoin: { type: String, default: "round" },

    // shared
    fill: { type: String, default: "#93c5fd" },
    stroke: { type: String, default: "#1f2937" }
  },
  { _id: false } // don’t create Mongo _id for each shape subdoc
);

const boardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, default: "Untitled board" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    shapes: { type: [shapeSchema], default: [] }
  },
  { timestamps: true }
);

const Board = mongoose.model("Board", boardSchema);

function makeToken(user) {
  return jwt.sign(
    { email: user.email, fullName: user.fullName },
    process.env.JWT_SECRET,
    { subject: user._id.toString(), expiresIn: "1h" }
  );
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const token = auth.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, fullName: payload.fullName };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.post("/auth/signup", async (req, res) => {
  try {
    const { email, fullName, password } = req.body;

    if (!email || !fullName || !password) {
      return res.status(400).json({ error: "Email, full name, password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await User.findOne({ email: email });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email: email,
      fullName,
      passwordHash,
    });

    return res.status(201).json({
      user: { id: user._id, email: user.email, fullName: user.fullName },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = makeToken(user);

    return res.json({
      token,
      user: { id: user._id, email: user.email, fullName: user.fullName },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/boards", requireAuth, async (req, res) => {
  try {
    const title = (req.body?.title || "Untitled board").trim();

    const board = await Board.create({
      title,
      owner: req.user.id
    });

    return res.status(201).json({
      board: { id: board._id, title: board.title, updatedAt: board.updatedAt },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/boards", requireAuth, async (req, res) => {
  try {
    const boards = await Board.find({ owner: req.user.id })
      .sort({ updatedAt: -1 })
      .select("_id title createdAt updatedAt");

    return res.json({
      boards: boards.map((b) => ({
        id: b._id,
        title: b.title,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/boards/:id", requireAuth, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    return res.json({
      board: {
        id: board._id,
        title: board.title,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt
      },
      shapes: board.shapes || []
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Invalid board id" });
  }
});

app.delete("/boards/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await Board.findOneAndDelete({
      _id: req.params.id,
      owner: req.user.id,
    });

    if (!deleted) return res.status(404).json({ error: "Board not found" });

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Invalid board id" });
  }
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("---------- MongoDB connected");

  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`Server on http://localhost:${port}`));
}

app.get("/ping", (req, res) => res.send("pong"));

start().catch((err) => {
  console.error("---------- Startup error:", err);
  process.exit(1);
});
