const express = require('express');
const mongoose = require('mongoose');
const { MeiliSearch } = require('meilisearch');
const { isEnabled } = require('@librechat/api');
const { SystemCapabilities } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const { requireCapability } = require('~/server/middleware/roles/capabilities');
const db = require('~/models');
const { batchResetMeiliFlags } = require('~/db/utils');

const router = express.Router();

router.use(requireJwtAuth);

router.get('/enable', async function (req, res) {
  if (!isEnabled(process.env.SEARCH)) {
    return res.send(false);
  }

  try {
    const client = new MeiliSearch({
      host: process.env.MEILI_HOST,
      apiKey: process.env.MEILI_MASTER_KEY,
    });

    const { status } = await client.health();
    return res.send(status === 'available');
  } catch (error) {
    return res.send(false);
  }
});

const requireAdminAccess = requireCapability(SystemCapabilities.ACCESS_ADMIN);

router.get('/index/status', requireAdminAccess, async function (req, res) {
  try {
    if (!isEnabled(process.env.SEARCH)) {
      return res.status(400).json({ error: 'Search is not enabled' });
    }

    const Message = mongoose.models.Message;
    const Conversation = mongoose.models.Conversation;
    if (!Message || !Conversation) {
      return res.status(500).json({ error: 'Database models not initialized' });
    }

    const messageProgress = await Message.getSyncProgress();
    const convoProgress = await Conversation.getSyncProgress();

    const client = new MeiliSearch({
      host: process.env.MEILI_HOST,
      apiKey: process.env.MEILI_MASTER_KEY,
    });

    let indexSettings = null;
    let sampleDoc = null;
    try {
      const messagesIndex = client.index('messages');
      indexSettings = await messagesIndex.getSettings();
      const searchResult = await messagesIndex.search('', { limit: 1 });
      if (searchResult.hits.length > 0) {
        sampleDoc = {
          hasContentTypes: !!searchResult.hits[0].contentTypes,
          contentTypes: searchResult.hits[0].contentTypes || [],
        };
      }
    } catch (indexError) {
      // Index may not exist yet, that's okay
    }

    return res.status(200).json({
      messages: messageProgress,
      conversations: convoProgress,
      indexSettings,
      sampleDoc,
    });
  } catch (error) {
    req.log.error('Error fetching index status:', error);
    return res.status(500).json({ error: 'Failed to fetch index status' });
  }
});

router.post('/index/rebuild', requireAdminAccess, async function (req, res) {
  try {
    if (!isEnabled(process.env.SEARCH)) {
      return res.status(400).json({ error: 'Search is not enabled' });
    }

    const Message = mongoose.models.Message;
    const Conversation = mongoose.models.Conversation;
    if (!Message || !Conversation) {
      return res.status(500).json({ error: 'Database models not initialized' });
    }

    const { force = false } = req.body;

    if (force === true) {
      req.log.info('[Search] Forcing full index rebuild for contentTypes migration');
      await batchResetMeiliFlags(Message.collection);
      await batchResetMeiliFlags(Conversation.collection);
    }

    const messageProgress = await Message.getSyncProgress();
    const convoProgress = await Conversation.getSyncProgress();

    setImmediate(async () => {
      try {
        await Message.syncWithMeili();
        await Conversation.syncWithMeili();
        req.log.info('[Search] Index rebuild completed successfully');
      } catch (syncError) {
        req.log.error('[Search] Index rebuild failed:', syncError);
      }
    });

    return res.status(202).json({
      message: 'Index rebuild started',
      currentProgress: {
        messages: messageProgress,
        conversations: convoProgress,
      },
    });
  } catch (error) {
    req.log.error('Error triggering index rebuild:', error);
    return res.status(500).json({ error: 'Failed to trigger index rebuild' });
  }
});

module.exports = router;
