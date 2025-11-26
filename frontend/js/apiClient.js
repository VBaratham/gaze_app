// API Client for Backend Communication
const APIClient = {
  baseURL: CONFIG.api.endpoint,
  timeout: CONFIG.api.timeout,

  /**
   * Make HTTP request with timeout
   */
  async _request(method, endpoint, data = null) {
    const url = `${this.baseURL}${endpoint}`;

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    Utils.log(`API ${method} ${url}`, data);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), this.timeout);
      });

      // Race between fetch and timeout
      const response = await Promise.race([
        fetch(url, options),
        timeoutPromise
      ]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      Utils.log(`API response:`, result);

      return result;

    } catch (error) {
      Utils.log(`API error:`, error);
      throw error;
    }
  },

  /**
   * Create a new experiment session
   */
  async createSession(sessionData) {
    return await this._request('POST', '/sessions', sessionData);
  },

  /**
   * Save trial data for a session
   */
  async saveTrial(sessionId, trialData) {
    return await this._request('POST', `/sessions/${sessionId}/trials`, trialData);
  },

  /**
   * Mark session as complete
   */
  async completeSession(sessionId) {
    return await this._request('PUT', `/sessions/${sessionId}/complete`);
  },

  /**
   * Get aggregate statistics (for dashboard)
   */
  async getStatistics() {
    return await this._request('GET', '/statistics');
  },

  /**
   * Get all sessions (for dashboard)
   */
  async getSessions() {
    return await this._request('GET', '/sessions');
  },

  /**
   * Export all data (for dashboard)
   */
  async exportData() {
    return await this._request('GET', '/export');
  },

  /**
   * Health check
   */
  async healthCheck() {
    return await this._request('GET', '/health');
  },

  /**
   * Upload gaze points to S3 (production only)
   * For now, this is a placeholder
   */
  async uploadGazePoints(sessionId, trialId, gazePoints) {
    // In production, this would:
    // 1. Compress gaze points
    // 2. Get pre-signed S3 URL from backend
    // 3. Upload to S3

    Utils.log(`Would upload ${gazePoints.length} gaze points for trial ${trialId}`);

    // For local development, just log
    return { success: true };
  }
};

// Make APIClient globally available
window.APIClient = APIClient;
