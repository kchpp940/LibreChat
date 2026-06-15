const express = require('express');
const { buildCapabilities, getTenantId } = require('@librechat/api');
const { getAppConfig } = require('~/server/services/Config');
const { getEndpointsConfig } = require('~/server/services/Endpoints');
const { getModelsConfig } = require('~/server/services/Models');

const router = express.Router();

let cachedCapabilities = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getFreshCapabilities(tenantId) {
  const now = Date.now();
  if (cachedCapabilities && now < cacheExpiry) {
    return cachedCapabilities;
  }

  const appConfig = await getAppConfig(tenantId ? { tenantId, baseOnly: true } : { baseOnly: true });
  const endpointsConfig = await getEndpointsConfig().catch(() => undefined);
  const modelsConfig = await getModelsConfig().catch(() => undefined);

  cachedCapabilities = buildCapabilities({
    appConfig,
    endpointsConfig,
    modelsConfig,
  });
  cacheExpiry = now + CACHE_TTL;

  return cachedCapabilities;
}

function invalidateCapabilitiesCache() {
  cachedCapabilities = null;
  cacheExpiry = 0;
}

router.get('/', async function (req, res) {
  try {
    const tenantId = getTenantId();
    const capabilities = await getFreshCapabilities(tenantId);
    return res.status(200).send(capabilities);
  } catch (err) {
    console.error('[capabilities] Error:', err);
    return res.status(500).send({ error: err.message });
  }
});

module.exports = router;
module.exports.invalidateCapabilitiesCache = invalidateCapabilitiesCache;
