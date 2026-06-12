require("dotenv").config();
const http = require("http");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const cors = require("cors");
const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

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
    type: { type: String, required: true, enum: ["rect", "circle", "pen", "text"] },

    // position (rect / circle / text)
    x: { type: Number },
    y: { type: Number },

    // rect
    width: { type: Number },
    height: { type: Number },

    // circle
    radius: { type: Number },

    // pen
    points: { type: [Number] },
    strokeWidth: { type: Number },
    lineCap: { type: String },
    lineJoin: { type: String },

    // text
    text: { type: String },
    fontSize: { type: Number },
    fontFamily: { type: String },

    // shared
    fill: { type: String },
    stroke: { type: String },
    draggable: { type: Boolean }
  },
  { _id: false } // don’t create Mongo _id for each shape subdoc
);

const versionSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Version" },
    shapes: { type: [shapeSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const boardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, default: "Untitled board" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    collaborators: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    ],
    shapes: { type: [shapeSchema], default: [] },
    versions: { type: [versionSchema], default: [] }
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

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

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
    const boards = await Board.find({
      $or: [
        { owner: req.user.id },
        { collaborators: req.user.id },
      ],
    })
      .sort({ updatedAt: -1 })
      .select("_id title owner createdAt updatedAt")
      .populate("owner", "fullName email");

    return res.json({
      boards: boards.map((board) => ({
        id: board._id,
        title: board.title,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        owner: {
          id: board.owner._id,
          fullName: board.owner.fullName,
          email: board.owner.email,
        },
        isOwner: board.owner._id.toString() === req.user.id,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/boards/:id", requireAuth, async (req, res) => {
  try {
    // Load board by ID and automatically enroll the user as a collaborator if not already added
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    // Add user as a collaborator if they are not the owner and not already a collaborator
    if (board.owner.toString() !== req.user.id && !board.collaborators.some(c => c.toString() === req.user.id)) {
      board.collaborators.push(req.user.id);
      await board.save();
    }

    return res.json({
      board: {
        id: board._id,
        title: board.title,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        isOwner: board.owner.toString() === req.user.id,
        versions: board.versions.map((v) => ({
          id: v._id,
          label: v.label,
          createdAt: v.createdAt,
        })),
      },
      shapes: board.shapes || []
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Invalid board id" });
  }
});

// Save (replace) all shapes on a board
app.put("/boards/:id/shapes", requireAuth, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user.id },
        { collaborators: req.user.id }
      ]
    });
    if (!board) return res.status(404).json({ error: "Board not found" });

    board.shapes = req.body.shapes || [];
    await board.save();

    return res.json({ ok: true, savedAt: board.updatedAt });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Could not save board" });
  }
});

// Save a new version snapshot
app.post("/boards/:id/versions", requireAuth, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user.id },
        { collaborators: req.user.id }
      ]
    });
    if (!board) return res.status(404).json({ error: "Board not found" });

    const label = (req.body.label || `Version ${board.versions.length + 1}`).trim();
    const shapes = req.body.shapes || [];

    board.versions.push({ label, shapes, createdAt: new Date() });

    // keep only 10 most recent versions
    if (board.versions.length > 10) {
      board.versions = board.versions.slice(board.versions.length - 10);
    }

    await board.save();

    const saved = board.versions[board.versions.length - 1];
    return res.status(201).json({
      version: { id: saved._id, label: saved.label, createdAt: saved.createdAt }
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Could not save version" });
  }
});

app.post("/boards/:id/versions/:versionId/restore", requireAuth, async (req, res) => {
  try {
    const board = await Board.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.user.id },
        { collaborators: req.user.id }
      ]
    });

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    const version = board.versions.id(req.params.versionId);

    if (!version) {
      return res.status(404).json({ error: "Version not found" });
    }

    return res.json({
      shapes: version.shapes || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Could not restore version" });
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

app.get("/ping", (req, res) => res.send("pong"));

const boardRooms = new Map();

// JWT auth middleware for sockets
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Missing token"));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.sub;
    socket.userFullName = payload.fullName;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
});

function broadcastPresence(boardId) {
  const room = boardRooms.get(boardId);
  const users = room ? Array.from(room.values()) : [];
  const seen = new Set();
  const unique = users.filter((user) => {
    if (seen.has(user.userId)) return false;
    seen.add(user.userId);
    return true;
  });
  io.to(`board-${boardId}`).emit("presence-update", { users: unique });
}

function leaveBoard(socket, boardId) {
  socket.leave(`board-${boardId}`);
  const room = boardRooms.get(boardId);
  if (!room) return;
  room.delete(socket.id);
  if (room.size === 0) boardRooms.delete(boardId);
  broadcastPresence(boardId);
}

io.on("connection", (socket) => {
  console.log("[ws] connected:", socket.id, socket.userFullName);

  socket.on("join-board", ({ boardId }) => {
    if (!boardId) return;
    socket.join(`board-${boardId}`);
    socket.currentBoardId = boardId;
    if (!boardRooms.has(boardId)) boardRooms.set(boardId, new Map());
    boardRooms.get(boardId).set(socket.id, {
      userId: socket.userId,
      fullName: socket.userFullName,
    });
    broadcastPresence(boardId);
  });

  socket.on("shapes-update", ({ boardId, shapes }) => {
    if (!boardId || !Array.isArray(shapes)) return;
    socket.to(`board-${boardId}`).emit("shapes-update", { shapes });
  });

  socket.on("request-shapes", ({ boardId }) => {
    if (!boardId) return;
    socket.to(`board-${boardId}`).emit("request-shapes");
  });

  socket.on("leave-board", ({ boardId }) => {
    leaveBoard(socket, boardId);
    socket.currentBoardId = null;
  });

  socket.on("disconnect", () => {
    console.log("[ws] disconnected:", socket.id);
    if (socket.currentBoardId) leaveBoard(socket, socket.currentBoardId);
  });
});

async function start() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("---------- MongoDB connected");

  const port = process.env.PORT || 4000;
  httpServer.listen(port, () => console.log(`Server on http://localhost:${port}`));
}

start().catch((err) => {
  console.error("---------- Startup error:", err);
  process.exit(1);
});
