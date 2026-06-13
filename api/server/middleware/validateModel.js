const { handleError } = require('@librechat/api');
const {
  ViolationTypes,
  findModelCapability,
  resolveCapability,
  extractModelNames,
} = require('librechat-data-provider');
const { getModelsConfig } = require('~/server/controllers/ModelController');
const { getEndpointsConfig } = require('~/server/services/Config');
const { logViolation } = require('~/cache');

const MAX_MODEL_STRING_LENGTH = 256;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.:/@+-]*$/;

const validateModel = async (req, res, next) => {
  const { endpoint } = req.body;
  const rawModel = req.body.model;

  if (!rawModel || typeof rawModel !== 'string') {
    return handleError(res, { text: 'Model not provided' });
  }

  const model = rawModel.trim();
  if (!model || model.length > MAX_MODEL_STRING_LENGTH || !MODEL_PATTERN.test(model)) {
    return handleError(res, { text: 'Invalid model identifier' });
  }

  req.body.model = model;

  const endpointsConfig = await getEndpointsConfig(req);
  const endpointConfig = endpointsConfig?.[endpoint];

  if (endpointConfig?.userProvide) {
    return next();
  }

  const modelsConfig = await getModelsConfig(req);

  if (!modelsConfig) {
    return handleError(res, { text: 'Models not loaded' });
  }

  const availableModels = modelsConfig[endpoint];
  if (!availableModels) {
    return handleError(res, { text: 'Endpoint models not loaded' });
  }

  const modelNames = extractModelNames(availableModels);
  let validModel = modelNames.includes(model);

  if (validModel) {
    const endpointCapabilities = endpointConfig?.capabilities;
    const modelConfigs = endpointConfig && typeof endpointConfig.models === 'object' && endpointConfig.models !== null
      ? endpointConfig.models
      : null;
    const modelCapabilities = modelConfigs && modelConfigs[model] ? modelConfigs[model].capabilities : undefined;
    const capsArray = Array.isArray(modelCapabilities) ? modelCapabilities : (Array.isArray(endpointCapabilities) ? endpointCapabilities : undefined);
    const configOverride = capsArray ? capsArray.reduce((acc, key) => {
      acc[key.toLowerCase()] = true;
      return acc;
    }, {}) : undefined;
    const baseURL = typeof endpointConfig?.baseURL === 'string' ? endpointConfig.baseURL : undefined;

    const capability = findModelCapability(availableModels, model)
      ?? resolveCapability({ endpoint, model, baseURL, configOverride });
    req.body.modelCapability = capability;
    return next();
  }

  const { ILLEGAL_MODEL_REQ_SCORE: score = 1 } = process.env ?? {};

  const type = ViolationTypes.ILLEGAL_MODEL_REQUEST;
  const errorMessage = {
    type,
  };

  await logViolation(req, res, type, errorMessage, score);
  return handleError(res, { text: 'Illegal model request' });
};

module.exports = validateModel;
