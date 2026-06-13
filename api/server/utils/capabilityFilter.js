function filterPayloadByCapability(payload, capability) {
  if (!capability) {
    return payload;
  }

  const filtered = { ...payload };

  if (capability.vision === false) {
    if (filtered.files && Array.isArray(filtered.files)) {
      filtered.files = filtered.files.filter((file) => {
        if (!file || !file.type) {
          return true;
        }
        return !file.type.startsWith('image/');
      });
    }
    if (filtered.attachments && Array.isArray(filtered.attachments)) {
      filtered.attachments = filtered.attachments.filter((att) => {
        if (!att || !att.type) {
          return true;
        }
        return !att.type.startsWith('image/');
      });
    }
    if (filtered.image_urls) {
      delete filtered.image_urls;
    }
  }

  if (capability.tool_calling === false) {
    if (filtered.tools) {
      filtered.tools = [];
    }
    if (filtered.tool_choice) {
      delete filtered.tool_choice;
    }
  }

  if (capability.file_search === false) {
    if (filtered.file_ids) {
      delete filtered.file_ids;
    }
    if (filtered.file_search) {
      delete filtered.file_search;
    }
  }

  if (capability.json_mode === false && capability.structured_output === false) {
    if (filtered.response_format) {
      delete filtered.response_format;
    }
  }

  if (capability.streaming === false) {
    filtered.stream = false;
  }

  if (capability.reasoning_effort === false) {
    if (filtered.reasoning_effort) {
      delete filtered.reasoning_effort;
    }
  }

  if (capability.supports_temperature === false && 'temperature' in filtered) {
    delete filtered.temperature;
  }

  if (capability.supports_top_p === false && 'top_p' in filtered) {
    delete filtered.top_p;
  }

  if (capability.supports_frequency_penalty === false && 'frequency_penalty' in filtered) {
    delete filtered.frequency_penalty;
  }

  if (capability.supports_presence_penalty === false && 'presence_penalty' in filtered) {
    delete filtered.presence_penalty;
  }

  if (capability.supports_top_k === false && 'top_k' in filtered) {
    delete filtered.top_k;
  }

  if (capability.supports_stop === false && 'stop' in filtered) {
    delete filtered.stop;
  }

  return filtered;
}

module.exports = { filterPayloadByCapability };
