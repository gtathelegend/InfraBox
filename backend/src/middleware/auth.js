const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require("jwks-rsa");

// ─── JWT Validation Middleware ──────────────────────────────────────
// Validates the Auth0-issued JWT on every protected request.
// On success the decoded token is attached to `req.auth`.
//
// Uses AUTH0_DOMAIN (v4 env naming) with a fallback to AUTH0_ISSUER_BASE_URL
const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL
  || `https://${process.env.AUTH0_DOMAIN}`;

const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${issuerBaseUrl}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE || "https://infrabox-api",
  issuer: `${issuerBaseUrl}/`,
  algorithms: ["RS256"],
});

module.exports = { checkJwt };
