/**
 * TeleCMI Service
 * Handles agent management and call operations via TeleCMI API
 * Documentation: https://doc.telecmi.com/chub/docs/get-started/
 */

const TELECMI_BASE_URL = 'https://rest.telecmi.com/v2';
const TELECMI_APP_ID = 33337109; // Must be a number
const TELECMI_SECRET = '7f58c15e-e903-41c1-8a66-8867c390b965';

class TeleCMIService {
  constructor() {
    this.baseUrl = TELECMI_BASE_URL;
    this.appId = TELECMI_APP_ID;
    this.secret = TELECMI_SECRET;
  }

  /**
   * Make API request to TeleCMI
   */
  async makeRequest(endpoint, method = 'POST', body = null, token = null) {
    const url = this.baseUrl + endpoint;
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log('[TeleCMI] ' + method + ' ' + endpoint, body ? JSON.stringify(body) : '');

    const response = await fetch(url, options);
    const data = await response.json();

    // TeleCMI returns code 200 for success, non-200 for errors
    if (data.code && data.code !== 200) {
      console.error('[TeleCMI] API Error:', JSON.stringify(data, null, 2));
      const errorMsg =
        data.msg?.body?.[0]?.message || data.msg || data.status || 'TeleCMI API request failed';
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }

    if (!response.ok) {
      console.error('[TeleCMI] HTTP Error:', data);
      throw new Error(data.message || data.error || 'TeleCMI API request failed');
    }

    return data;
  }

  /**
   * Create a new agent/user
   * POST /user/add
   * @param {string} extension - Agent extension (e.g., "101")
   * @param {string} name - Agent name
   * @param {string} phoneNumber - Agent phone number
   * @param {string} password - Agent password (min 8 chars)
   */
  async createAgent({ extension, name, phoneNumber, password }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      extension: parseInt(extension, 10), // Must be number
      name,
      phone_number: phoneNumber,
      password,
    };

    return this.makeRequest('/user/add', 'POST', body);
  }

  /**
   * Login an agent to get auth token
   * POST /user/login
   * @param {string} extension - Agent extension (e.g., "101")
   * @param {string} password - Agent password
   * @returns Token valid for 30 days
   */
  async loginAgent({ extension, password }) {
    // TeleCMI expects id as "extension_appid" format
    // If extension already contains "_", assume it's a full agent ID (e.g., "5001_33337140")
    const agentId = extension.includes('_') ? extension : extension + '_' + this.appId;

    const body = {
      id: agentId,
      password,
    };

    return this.makeRequest('/user/login', 'POST', body);
  }

  /**
   * Initiate a click-to-call
   * POST /webrtc/click2call
   * @param {string} userId - Agent user ID (extension_appid format)
   * @param {string} toNumber - Number to call
   * @param {object} options - Additional options
   */
  async initiateCall({ userId, toNumber, callerId, webrtc = true, followMe = true }) {
    const body = {
      user_id: userId,
      secret: this.secret,
      to: toNumber,
      webrtc,
      followme: followMe,
    };

    if (callerId) {
      body.callerid = callerId;
    }

    return this.makeRequest('/webrtc/click2call', 'POST', body);
  }

  /**
   * Get incoming call logs
   * POST /user/in_cdr
   * @param {string} token - Agent auth token
   * @param {number} from - Start timestamp (Unix)
   * @param {number} to - End timestamp (Unix)
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   */
  async getIncomingCalls({ token, from, to, page = 1, limit = 50 }) {
    const body = {
      token,
      from,
      to,
      page,
      limit,
    };

    return this.makeRequest('/user/in_cdr', 'POST', body);
  }

  /**
   * Get outgoing call logs
   * POST /user/out_cdr
   * @param {string} token - Agent auth token
   * @param {number} from - Start timestamp (Unix)
   * @param {number} to - End timestamp (Unix)
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   */
  async getOutgoingCalls({ token, from, to, page = 1, limit = 50 }) {
    const body = {
      token,
      from,
      to,
      page,
      limit,
    };

    return this.makeRequest('/user/out_cdr', 'POST', body);
  }

  /**
   * Get all call logs (incoming + outgoing)
   */
  async getAllCallLogs({ token, from, to, page = 1, limit = 50 }) {
    const [incoming, outgoing] = await Promise.all([
      this.getIncomingCalls({ token, from, to, page, limit }),
      this.getOutgoingCalls({ token, from, to, page, limit }),
    ]);

    // Combine and sort by timestamp
    const allCalls = [
      ...(incoming.data || []).map((c) => ({ ...c, direction: 'INBOUND' })),
      ...(outgoing.data || []).map((c) => ({ ...c, direction: 'OUTBOUND' })),
    ].sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

    return {
      data: allCalls,
      total: (incoming.total || 0) + (outgoing.total || 0),
    };
  }

  /**
   * Get contacts from TeleCMI
   * POST /user/contact/get
   */
  async getContacts({ token, page = 1, limit = 50 }) {
    const body = {
      token,
      page,
      limit,
    };

    return this.makeRequest('/user/contact/get', 'POST', body);
  }

  /**
   * Get agent list
   * POST /user/list
   */
  async getAgents(page = 1, limit = 10) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      page,
      limit,
    };

    return this.makeRequest('/user/list', 'POST', body);
  }

  /**
   * Update agent
   * POST /user/update
   */
  async updateAgent({ extension, name, phoneNumber, password }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      extension: parseInt(extension, 10), // Must be number
    };

    if (name) body.name = name;
    if (phoneNumber) body.phone_number = phoneNumber;
    if (password) body.password = password;

    return this.makeRequest('/user/update', 'POST', body);
  }

  /**
   * Delete agent
   * POST /user/delete
   */
  async deleteAgent(extension) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      extension: parseInt(extension, 10), // Must be number
    };

    return this.makeRequest('/user/delete', 'POST', body);
  }

  /**
   * Get app ID for frontend SDK initialization
   */
  getAppId() {
    return String(this.appId); // Return as string for SDK use
  }

  // =====================
  // CALL RECORDINGS
  // =====================

  /**
   * Get call recording URL
   * POST /admin/call/recording
   * @param {string} callId - The call UUID from CDR
   */
  async getRecordingUrl(callId) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
    };

    return this.makeRequest('/admin/call/recording', 'POST', body);
  }

  /**
   * Enable/disable call recording for an agent
   * POST /user/setting/recording
   */
  async setRecordingSetting({ token, enabled }) {
    const body = {
      token,
      recording: enabled ? 1 : 0,
    };

    return this.makeRequest('/user/setting/recording', 'POST', body);
  }

  // =====================
  // CALL TRANSCRIPTION
  // =====================

  /**
   * Request transcription for a call
   * POST /admin/call/transcribe
   * @param {string} callId - The call UUID
   * @param {string} language - Language code (default: en-IN)
   */
  async requestTranscription(callId, language = 'en-IN') {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
      language,
    };

    return this.makeRequest('/admin/call/transcribe', 'POST', body);
  }

  /**
   * Get transcription for a call
   * POST /admin/call/transcription
   * @param {string} callId - The call UUID
   */
  async getTranscription(callId) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
    };

    return this.makeRequest('/admin/call/transcription', 'POST', body);
  }

  // =====================
  // SMS
  // =====================

  /**
   * Send SMS
   * POST /sms/send
   * @param {string} to - Recipient phone number
   * @param {string} message - SMS content
   * @param {string} from - Sender ID (optional)
   */
  async sendSMS({ to, message, from }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      to,
      message,
    };

    if (from) {
      body.from = from;
    }

    return this.makeRequest('/sms/send', 'POST', body);
  }

  /**
   * Get SMS logs
   * POST /sms/logs
   * @param {number} from - Start timestamp
   * @param {number} to - End timestamp
   * @param {number} page - Page number
   * @param {number} limit - Records per page
   */
  async getSMSLogs({ from, to, page = 1, limit = 50 }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      from,
      to,
      page,
      limit,
    };

    return this.makeRequest('/sms/logs', 'POST', body);
  }

  /**
   * Get SMS delivery status
   * POST /sms/status
   * @param {string} messageId - SMS message ID
   */
  async getSMSStatus(messageId) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      message_id: messageId,
    };

    return this.makeRequest('/sms/status', 'POST', body);
  }

  // =====================
  // IVR MANAGEMENT
  // =====================

  /**
   * Create IVR flow
   * POST /ivr/create
   * @param {string} name - IVR name
   * @param {object} flow - IVR flow configuration
   */
  async createIVR({ name, flow, welcomeMessage, menuOptions }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      name,
      flow,
      welcome_message: welcomeMessage,
      menu_options: menuOptions,
    };

    return this.makeRequest('/ivr/create', 'POST', body);
  }

  /**
   * Get IVR list
   * POST /ivr/list
   */
  async getIVRList(page = 1, limit = 10) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      page,
      limit,
    };

    return this.makeRequest('/ivr/list', 'POST', body);
  }

  /**
   * Update IVR
   * POST /ivr/update
   */
  async updateIVR({ ivrId, name, flow, welcomeMessage, menuOptions }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      ivr_id: ivrId,
      name,
      flow,
      welcome_message: welcomeMessage,
      menu_options: menuOptions,
    };

    return this.makeRequest('/ivr/update', 'POST', body);
  }

  /**
   * Delete IVR
   * POST /ivr/delete
   */
  async deleteIVR(ivrId) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      ivr_id: ivrId,
    };

    return this.makeRequest('/ivr/delete', 'POST', body);
  }

  // =====================
  // CALL QUEUES
  // =====================

  /**
   * Create a call queue
   * POST /queue/create
   */
  async createQueue({ name, agents, strategy = 'round_robin', timeout = 30 }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      name,
      agents, // Array of agent extensions
      strategy, // round_robin, ring_all, longest_idle
      timeout, // Ring timeout in seconds
    };

    return this.makeRequest('/queue/create', 'POST', body);
  }

  /**
   * Get queue list
   * POST /queue/list
   */
  async getQueueList(page = 1, limit = 10) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      page,
      limit,
    };

    return this.makeRequest('/queue/list', 'POST', body);
  }

  /**
   * Update queue
   * POST /queue/update
   */
  async updateQueue({ queueId, name, agents, strategy, timeout }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      queue_id: queueId,
    };

    if (name) body.name = name;
    if (agents) body.agents = agents;
    if (strategy) body.strategy = strategy;
    if (timeout) body.timeout = timeout;

    return this.makeRequest('/queue/update', 'POST', body);
  }

  /**
   * Add agent to queue
   * POST /queue/agent/add
   */
  async addAgentToQueue({ queueId, extension }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      queue_id: queueId,
      extension: parseInt(extension, 10),
    };

    return this.makeRequest('/queue/agent/add', 'POST', body);
  }

  /**
   * Remove agent from queue
   * POST /queue/agent/remove
   */
  async removeAgentFromQueue({ queueId, extension }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      queue_id: queueId,
      extension: parseInt(extension, 10),
    };

    return this.makeRequest('/queue/agent/remove', 'POST', body);
  }

  /**
   * Delete queue
   * POST /queue/delete
   */
  async deleteQueue(queueId) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      queue_id: queueId,
    };

    return this.makeRequest('/queue/delete', 'POST', body);
  }

  // =====================
  // LIVE CALL MONITORING
  // =====================

  /**
   * Listen to an active call (silent monitoring)
   * POST /admin/call/listen
   * @param {string} callId - The active call ID
   * @param {string} supervisorExtension - Supervisor's extension
   */
  async listenToCall({ callId, supervisorExtension }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
      supervisor_extension: parseInt(supervisorExtension, 10),
    };

    return this.makeRequest('/admin/call/listen', 'POST', body);
  }

  /**
   * Whisper to agent during call (agent can hear, customer cannot)
   * POST /admin/call/whisper
   */
  async whisperToAgent({ callId, supervisorExtension }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
      supervisor_extension: parseInt(supervisorExtension, 10),
    };

    return this.makeRequest('/admin/call/whisper', 'POST', body);
  }

  /**
   * Barge into call (all parties can hear)
   * POST /admin/call/barge
   */
  async bargeIntoCall({ callId, supervisorExtension }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
      supervisor_extension: parseInt(supervisorExtension, 10),
    };

    return this.makeRequest('/admin/call/barge', 'POST', body);
  }

  /**
   * Get active calls for monitoring
   * POST /admin/call/active
   */
  async getActiveCalls() {
    const body = {
      appid: this.appId,
      secret: this.secret,
    };

    return this.makeRequest('/admin/call/active', 'POST', body);
  }

  // =====================
  // CALL CONTROL
  // =====================

  /**
   * End an active call
   * POST /admin/call/hangup
   */
  async hangupCall(callId) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
    };

    return this.makeRequest('/admin/call/hangup', 'POST', body);
  }

  /**
   * Transfer a call
   * POST /admin/call/transfer
   */
  async transferCall({ callId, transferTo }) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
      transfer_to: transferTo,
    };

    return this.makeRequest('/admin/call/transfer', 'POST', body);
  }

  /**
   * Hold a call
   * POST /admin/call/hold
   */
  async holdCall(callId) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
    };

    return this.makeRequest('/admin/call/hold', 'POST', body);
  }

  /**
   * Resume a held call
   * POST /admin/call/unhold
   */
  async unholdCall(callId) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      call_id: callId,
    };

    return this.makeRequest('/admin/call/unhold', 'POST', body);
  }

  // =====================
  // APP SETTINGS
  // =====================

  /**
   * Get app balance
   * POST /app/balance
   */
  async getBalance() {
    const body = {
      appid: this.appId,
      secret: this.secret,
    };

    return this.makeRequest('/app/balance', 'POST', body);
  }

  /**
   * Get DID numbers
   * POST /app/did/list
   */
  async getDIDNumbers(page = 1, limit = 10) {
    const body = {
      appid: this.appId,
      secret: this.secret,
      page,
      limit,
    };

    return this.makeRequest('/app/did/list', 'POST', body);
  }

  /**
   * Auto-provision a TeleCMI agent for a new user
   * Creates agent and stores credentials
   * @param {object} params - Provisioning parameters
   * @param {string} params.tenantId - Tenant ID
   * @param {string} params.userId - User ID
   * @param {string} params.name - User's full name
   * @param {string} params.phoneNumber - User's phone number
   * @param {string} params.password - Password for TeleCMI login
   * @returns {object} Agent details and credentials
   */
  async provisionUserAgent({ tenantId, userId, name, phoneNumber, password }) {
    try {
      // Get next available extension (start from 100)
      let nextExtension = 100;
      try {
        const existingAgents = await this.getAgents(1, 10);
        if (existingAgents?.data?.length > 0) {
          const maxExtension = Math.max(
            ...existingAgents.data.map((a) => parseInt(a.extension) || 0)
          );
          nextExtension = maxExtension + 1;
        }
      } catch (e) {
        console.log('[TeleCMI] Could not get agents, using default extension 100');
      }

      // Create agent in TeleCMI
      const agentResult = await this.createAgent({
        extension: nextExtension.toString(),
        name,
        phoneNumber: phoneNumber.replace(/[^0-9]/g, ''), // Remove non-digits
        password,
      });

      if (!agentResult || agentResult.code !== 200) {
        throw new Error(agentResult?.msg || 'Failed to create TeleCMI agent');
      }

      // Login to get token
      const loginResult = await this.loginAgent({
        extension: nextExtension.toString(),
        password,
      });

      // Return credentials for storage
      const credentials = {
        agentId: agentResult.agent?.agent_id || nextExtension + '_' + this.appId,
        extension: nextExtension,
        userId: agentResult.agent?.agent_id,
        secret: this.secret,
        token: loginResult?.token,
        createdAt: new Date().toISOString(),
      };

      console.log('[TeleCMI] Provisioned agent for user:', userId, 'Extension:', nextExtension);

      return {
        success: true,
        agent: agentResult.agent,
        credentials,
        extension: nextExtension,
      };
    } catch (error) {
      console.error('[TeleCMI] Failed to provision agent:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export const telecmiService = new TeleCMIService();
