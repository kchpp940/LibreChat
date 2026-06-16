const express = require('express');
const { capabilityRegistry, getTenantId } = require('@librechat/api');
const { getAppConfig } = require('~/server/services/Config');
const { getEndpointsConfig } = require('~/server/services/Endpoints');
const { getModelsConfig } = require('~/server/services/Models');

const router = express.Router();

let loaderRegistered = false;

function ensureLoader(tenantId) {
  if (loaderRegistered) {
    return;
  }
  capabilityRegistry.setLoader(async () => {
    const appConfig = await getAppConfig(tenantId ? { tenantId, baseOnly: true } : { baseOnly: true });
    const endpointsConfig = await getEndpointsConfig().catch(() => undefined);
    const modelsConfig = await getModelsConfig().catch(() => undefined);
    return { appConfig, endpointsConfig, modelsConfig };
  });
  loaderRegistered = true;
}

router.get('/', async function (req, res) {
  try {
    const tenantId = getTenantId();
    ensureLoader(tenantId);
    const snapshot = await capabilityRegistry.getSnapshot();
    return res.status(200).send(snapshot);
  } catch (err) {
    console.error('[capabilities] Error:', err);
    return res.status(500).send({ error: err.message });
  }
});

function invalidateCapabilitiesCache() {
  capabilityRegistry.invalidate();
}

module.exports = router;
module.exports.invalidateCapabilitiesCache = invalidateCapabilitiesCache;
