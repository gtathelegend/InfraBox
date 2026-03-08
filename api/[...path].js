function buildTargetUrl(baseUrl, pathSegments, reqUrl) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const joinedPath = (pathSegments || []).join("/");
  const queryIndex = reqUrl.indexOf("?");
  const query = queryIndex >= 0 ? reqUrl.slice(queryIndex) : "";
  return `${normalizedBase}/${joinedPath}${query}`;
}

function copyHeaders(req) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (!value) {
      continue;
    }

    if (key.toLowerCase() === "host") {
      continue;
    }

    headers[key] = value;
  }
  return headers;
}

export default async function handler(req, res) {
  const backendBaseUrl = process.env.API_BASE_URL || process.env.BACKEND_API_URL;

  if (!backendBaseUrl) {
    return res.status(500).json({
      message:
        "Backend API base URL is not configured. Set API_BASE_URL (or BACKEND_API_URL) in Vercel project environment variables.",
    });
  }

  const targetUrl = buildTargetUrl(backendBaseUrl, req.query.path, req.url || "");

  try {
    const method = req.method || "GET";
    const headers = copyHeaders(req);
    const shouldSendBody = method !== "GET" && method !== "HEAD";

    let body;
    if (shouldSendBody && req.body != null) {
      body = typeof req.body === "string" || req.body instanceof Buffer
        ? req.body
        : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") {
        return;
      }
      res.setHeader(key, value);
    });

    return res.send(responseBody);
  } catch (error) {
    return res.status(502).json({
      message: "Failed to reach backend API from Vercel proxy.",
      detail: error instanceof Error ? error.message : "Unknown proxy error",
      targetUrl,
    });
  }
}
