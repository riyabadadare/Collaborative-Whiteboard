const jwt = require("jsonwebtoken");
const { makeToken, requireAuth } = require("./auth");

const TEST_SECRET = "test-secret-key-for-jest";

describe("makeToken", () => {
  it("returns a valid JWT containing the user's email and fullName", () => {
    const fakeUser = {
      _id: "testtesttest",
      email: "riya@badadare.com",
      fullName: "Riya Badadare",
    };

    const token = makeToken(fakeUser, TEST_SECRET);

    const payload = jwt.verify(token, TEST_SECRET);

    expect(payload.email).toBe("riya@badadare.com");
    expect(payload.fullName).toBe("Riya Badadare");
    expect(payload.sub).toBe("testtesttest");
  });
});

describe("requireAuth middleware", () => {
  it("returns 401 when no Authorization header is present", () => {
    const middleware = requireAuth(TEST_SECRET);

    const req = { headers: {} };
    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Missing Bearer token" });
    expect(next).not.toHaveBeenCalled();
  });
});
