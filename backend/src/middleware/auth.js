const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require("jwks-rsa");

// ─── JWT Validation Middleware ──────────────────────────────────────
// Validates the Auth0-issued JWT on every protected request.
// On success the decoded token is attached to `req.auth`.
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${process.env.AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE || "https://infrabox-api",
  issuer: `${process.env.AUTH0_ISSUER_BASE_URL}/`,
  algorithms: ["RS256"],
});

module.exports = { checkJwt };
