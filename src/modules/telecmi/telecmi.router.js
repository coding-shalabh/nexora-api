import { Router } from 'express';
import { telecmiService } from './telecmi.service.js';

const router = Router();

// ============ TELECMI CONFIGURATION ============

/**
 * Get TeleCMI configuration status
 * GET /api/v1/telecmi
 */
router.get('/', async (req, res) => {
  try {
    // TODO: Implement actual TeleCMI config retrieval
    // For now, return default config status
    res.json({
      success: true,
      data: {
        configured: false,
        apiKeySet: false,
        appId: null,
        agents: [],
        message: 'TeleCMI integration not configured yet',
      },
    });
  } catch (error) {
    console.error('Get TeleCMI config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ AGENTS ============

/**
 * Get all agents
 * GET /api/v1/telecmi/agents
 */
router.get('/agents', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 10); // Max 10 per TeleCMI API
    const result = await telecmiService.getAgents(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create a new agent
 * POST /api/v1/telecmi/agents
 * Body: { extension, name, phoneNumber, password }
 */
router.post('/agents', async (req, res) => {
  try {
    const { extension, name, phoneNumber, password } = req.body;

    if (!extension || !name || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: extension, name, phoneNumber, password',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    const result = await telecmiService.createAgent({
      extension,
      name,
      phoneNumber,
      password,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update an agent
 * PATCH /api/v1/telecmi/agents/:extension
 * Body: { name?, phoneNumber?, password? }
 */
router.patch('/agents/:extension', async (req, res) => {
  try {
    const { extension } = req.params;
    const { name, phoneNumber, password } = req.body;

    if (password && password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters',
      });
    }

    const result = await telecmiService.updateAgent({
      extension,
      name,
      phoneNumber,
      password,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete an agent
 * DELETE /api/v1/telecmi/agents/:extension
 */
router.delete('/agents/:extension', async (req, res) => {
  try {
    const { extension } = req.params;

    const result = await telecmiService.deleteAgent(extension);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ AUTH ============

/**
 * Login agent (get auth token)
 * POST /api/v1/telecmi/auth/login
 * Body: { extension, password }
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { extension, password } = req.body;

    if (!extension || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: extension, password',
      });
    }

    const result = await telecmiService.loginAgent({ extension, password });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Agent login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ CALLS ============

/**
 * Initiate a call (click-to-call)
 * POST /api/v1/telecmi/calls
 * Body: { userId, toNumber, callerId?, webrtc?, followMe? }
 */
router.post('/calls', async (req, res) => {
  try {
    const { userId, toNumber, callerId, webrtc, followMe } = req.body;

    if (!userId || !toNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, toNumber',
      });
    }

    const result = await telecmiService.initiateCall({
      userId,
      toNumber,
      callerId,
      webrtc: webrtc !== false, // Default true
      followMe: followMe !== false, // Default true
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Initiate call error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get call logs
 * GET /api/v1/telecmi/calls
 * Query: { token, from?, to?, page?, limit?, direction? }
 */
router.get('/calls', async (req, res) => {
  try {
    const { token, from, to, page, limit, direction } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query param: token',
      });
    }

    // Default to last 30 days
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

    const params = {
      token,
      from: from ? parseInt(from) : thirtyDaysAgo,
      to: to ? parseInt(to) : now,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    };

    let result;
    if (direction === 'INBOUND') {
      result = await telecmiService.getIncomingCalls(params);
    } else if (direction === 'OUTBOUND') {
      result = await telecmiService.getOutgoingCalls(params);
    } else {
      result = await telecmiService.getAllCallLogs(params);
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get call logs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ RECORDINGS ============

/**
 * Get recording URL for a call
 * GET /api/v1/telecmi/recordings/:callId
 */
router.get('/recordings/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const result = await telecmiService.getRecordingUrl(callId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get recording error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Set recording setting for an agent
 * POST /api/v1/telecmi/recordings/settings
 * Body: { token, enabled }
 */
router.post('/recordings/settings', async (req, res) => {
  try {
    const { token, enabled } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Missing token' });
    }
    const result = await telecmiService.setRecordingSetting({ token, enabled });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Set recording setting error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ TRANSCRIPTION ============

/**
 * Request transcription for a call
 * POST /api/v1/telecmi/transcription/request
 * Body: { callId, language? }
 */
router.post('/transcription/request', async (req, res) => {
  try {
    const { callId, language } = req.body;
    if (!callId) {
      return res.status(400).json({ success: false, error: 'Missing callId' });
    }
    const result = await telecmiService.requestTranscription(callId, language);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Request transcription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get transcription for a call
 * GET /api/v1/telecmi/transcription/:callId
 */
router.get('/transcription/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const result = await telecmiService.getTranscription(callId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get transcription error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ SMS ============

/**
 * Send SMS
 * POST /api/v1/telecmi/sms/send
 * Body: { to, message, from? }
 */
router.post('/sms/send', async (req, res) => {
  try {
    const { to, message, from } = req.body;
    if (!to || !message) {
      return res.status(400).json({ success: false, error: 'Missing to or message' });
    }
    const result = await telecmiService.sendSMS({ to, message, from });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get SMS logs
 * GET /api/v1/telecmi/sms/logs
 * Query: { from?, to?, page?, limit? }
 */
router.get('/sms/logs', async (req, res) => {
  try {
    const { from, to, page, limit } = req.query;
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

    const result = await telecmiService.getSMSLogs({
      from: from ? parseInt(from) : thirtyDaysAgo,
      to: to ? parseInt(to) : now,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get SMS logs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get SMS status
 * GET /api/v1/telecmi/sms/status/:messageId
 */
router.get('/sms/status/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await telecmiService.getSMSStatus(messageId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get SMS status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ IVR ============

/**
 * Get IVR list
 * GET /api/v1/telecmi/ivr
 */
router.get('/ivr', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const result = await telecmiService.getIVRList(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get IVR list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create IVR
 * POST /api/v1/telecmi/ivr
 * Body: { name, flow, welcomeMessage?, menuOptions? }
 */
router.post('/ivr', async (req, res) => {
  try {
    const { name, flow, welcomeMessage, menuOptions } = req.body;
    if (!name || !flow) {
      return res.status(400).json({ success: false, error: 'Missing name or flow' });
    }
    const result = await telecmiService.createIVR({ name, flow, welcomeMessage, menuOptions });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create IVR error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update IVR
 * PATCH /api/v1/telecmi/ivr/:ivrId
 */
router.patch('/ivr/:ivrId', async (req, res) => {
  try {
    const { ivrId } = req.params;
    const { name, flow, welcomeMessage, menuOptions } = req.body;
    const result = await telecmiService.updateIVR({
      ivrId,
      name,
      flow,
      welcomeMessage,
      menuOptions,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update IVR error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete IVR
 * DELETE /api/v1/telecmi/ivr/:ivrId
 */
router.delete('/ivr/:ivrId', async (req, res) => {
  try {
    const { ivrId } = req.params;
    const result = await telecmiService.deleteIVR(ivrId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Delete IVR error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ QUEUES ============

/**
 * Get queue list
 * GET /api/v1/telecmi/queues
 */
router.get('/queues', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const result = await telecmiService.getQueueList(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get queue list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create queue
 * POST /api/v1/telecmi/queues
 * Body: { name, agents, strategy?, timeout? }
 */
router.post('/queues', async (req, res) => {
  try {
    const { name, agents, strategy, timeout } = req.body;
    if (!name || !agents) {
      return res.status(400).json({ success: false, error: 'Missing name or agents' });
    }
    const result = await telecmiService.createQueue({ name, agents, strategy, timeout });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Create queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update queue
 * PATCH /api/v1/telecmi/queues/:queueId
 */
router.patch('/queues/:queueId', async (req, res) => {
  try {
    const { queueId } = req.params;
    const { name, agents, strategy, timeout } = req.body;
    const result = await telecmiService.updateQueue({ queueId, name, agents, strategy, timeout });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Update queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete queue
 * DELETE /api/v1/telecmi/queues/:queueId
 */
router.delete('/queues/:queueId', async (req, res) => {
  try {
    const { queueId } = req.params;
    const result = await telecmiService.deleteQueue(queueId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Delete queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add agent to queue
 * POST /api/v1/telecmi/queues/:queueId/agents
 * Body: { extension }
 */
router.post('/queues/:queueId/agents', async (req, res) => {
  try {
    const { queueId } = req.params;
    const { extension } = req.body;
    if (!extension) {
      return res.status(400).json({ success: false, error: 'Missing extension' });
    }
    const result = await telecmiService.addAgentToQueue({ queueId, extension });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Add agent to queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Remove agent from queue
 * DELETE /api/v1/telecmi/queues/:queueId/agents/:extension
 */
router.delete('/queues/:queueId/agents/:extension', async (req, res) => {
  try {
    const { queueId, extension } = req.params;
    const result = await telecmiService.removeAgentFromQueue({ queueId, extension });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Remove agent from queue error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ LIVE MONITORING ============

/**
 * Get active calls for monitoring
 * GET /api/v1/telecmi/monitoring/active
 */
router.get('/monitoring/active', async (req, res) => {
  try {
    const result = await telecmiService.getActiveCalls();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get active calls error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Listen to a call (silent monitoring)
 * POST /api/v1/telecmi/monitoring/listen
 * Body: { callId, supervisorExtension }
 */
router.post('/monitoring/listen', async (req, res) => {
  try {
    const { callId, supervisorExtension } = req.body;
    if (!callId || !supervisorExtension) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing callId or supervisorExtension' });
    }
    const result = await telecmiService.listenToCall({ callId, supervisorExtension });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Listen to call error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Whisper to agent
 * POST /api/v1/telecmi/monitoring/whisper
 * Body: { callId, supervisorExtension }
 */
router.post('/monitoring/whisper', async (req, res) => {
  try {
    const { callId, supervisorExtension } = req.body;
    if (!callId || !supervisorExtension) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing callId or supervisorExtension' });
    }
    const result = await telecmiService.whisperToAgent({ callId, supervisorExtension });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Whisper to agent error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Barge into call
 * POST /api/v1/telecmi/monitoring/barge
 * Body: { callId, supervisorExtension }
 */
router.post('/monitoring/barge', async (req, res) => {
  try {
    const { callId, supervisorExtension } = req.body;
    if (!callId || !supervisorExtension) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing callId or supervisorExtension' });
    }
    const result = await telecmiService.bargeIntoCall({ callId, supervisorExtension });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Barge into call error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ CALL CONTROL ============

/**
 * Hangup a call
 * POST /api/v1/telecmi/calls/:callId/hangup
 */
router.post('/calls/:callId/hangup', async (req, res) => {
  try {
    const { callId } = req.params;
    const result = await telecmiService.hangupCall(callId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Hangup call error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Transfer a call
 * POST /api/v1/telecmi/calls/:callId/transfer
 * Body: { transferTo }
 */
router.post('/calls/:callId/transfer', async (req, res) => {
  try {
    const { callId } = req.params;
    const { transferTo } = req.body;
    if (!transferTo) {
      return res.status(400).json({ success: false, error: 'Missing transferTo' });
    }
    const result = await telecmiService.transferCall({ callId, transferTo });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Transfer call error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Hold a call
 * POST /api/v1/telecmi/calls/:callId/hold
 */
router.post('/calls/:callId/hold', async (req, res) => {
  try {
    const { callId } = req.params;
    const result = await telecmiService.holdCall(callId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Hold call error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Unhold a call
 * POST /api/v1/telecmi/calls/:callId/unhold
 */
router.post('/calls/:callId/unhold', async (req, res) => {
  try {
    const { callId } = req.params;
    const result = await telecmiService.unholdCall(callId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Unhold call error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ APP SETTINGS ============

/**
 * Get app balance
 * GET /api/v1/telecmi/balance
 */
router.get('/balance', async (req, res) => {
  try {
    const result = await telecmiService.getBalance();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get DID numbers
 * GET /api/v1/telecmi/did
 */
router.get('/did', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const result = await telecmiService.getDIDNumbers(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get DID numbers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ CONFIG ============

/**
 * Get TeleCMI config for frontend SDK
 * GET /api/v1/telecmi/config
 */
router.get('/config', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        appId: telecmiService.getAppId(),
        // SDK URL for loading piopiyjs
        sdkUrl: 'https://cdn.piopiy.com/piopiyjs/latest/piopiy.min.js',
      },
    });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as telecmiRouter };
