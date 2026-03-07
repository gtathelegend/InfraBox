require("dotenv").config({ path: ".env.local" });
const express = require("express");
const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require("jwks-rsa");

const app = express();
app.use(express.json());

// Auth middleware to enforce JWT validation
const checkJwt = jwt({
  // Dynamically provide a signing key based on the 'kid' in the token header
  // and the signing keys provided by the JWKS endpoint
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${process.env.AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`
  }),

  // Verify the audience and the Auth0 issuer
  // Usually this would be defined in environment variables as your API Identifier
  audience: process.env.AUTH0_AUDIENCE || "https://infrabox-api",
  issuer: `${process.env.AUTH0_ISSUER_BASE_URL}/`,
  algorithms: ["RS256"]
});

// Example protected API route: GET /api/workspaces
// Only authenticated users should access it
app.get("/api/workspaces", checkJwt, (req, res) => {
  res.json({
    message: "You are authorized!",
    workspaces: [
      { id: "wksp_1", name: "Production Gateway", region: "us-east-1" },
      { id: "wksp_2", name: "Staging Cluster", region: "eu-west-1" }
    ]
  });
});

// Global error handler to catch and reject unauthorized requests gracefully
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      error: "unauthorized",
      message: "Authorization token is missing or invalid"
    });
  } else {
    next(err);
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend Express server listening on http://localhost:${port}`);
  console.log('Ensure process.env.AUTH0_ISSUER_BASE_URL is set matching your Auth0 tenant.');
});
