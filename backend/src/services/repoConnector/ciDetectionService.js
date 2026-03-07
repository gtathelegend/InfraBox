async function detectCiCdConfig(adapter, repository, accessToken) {
  const detected = await adapter.detectCiConfigs(repository, accessToken);
  return [...new Set(detected)];
}

module.exports = { detectCiCdConfig };
