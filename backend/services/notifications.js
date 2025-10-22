/**
 * Real-time Notifications Service
 * Supports WebSockets for live updates
 */

class NotificationService {
  constructor() {
    this.clients = new Map(); // Store WebSocket connections
    this.isEnabled = process.env.ENABLE_WEBSOCKETS === 'true';
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer) {
    if (!this.isEnabled) {
      console.log('⚠️  WebSockets disabled in configuration');
      return;
    }

    try {
      const WebSocket = require('ws');
      this.wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

      this.wss.on('connection', (ws, req) => {
        const clientId = this.generateClientId();
        this.clients.set(clientId, ws);

        console.log(`🔌 WebSocket client connected: ${clientId} (Total: ${this.clients.size})`);

        // Send welcome message
        ws.send(JSON.stringify({
          type: 'connection',
          message: 'Connected to CivicFix live updates',
          clientId
        }));

        // Handle client messages
        ws.on('message', (message) => {
          try {
            const data = JSON.parse(message);
            this.handleClientMessage(clientId, data, ws);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });

        // Handle disconnection
        ws.on('close', () => {
          this.clients.delete(clientId);
          console.log(`🔌 WebSocket client disconnected: ${clientId} (Total: ${this.clients.size})`);
        });

        // Handle errors
        ws.on('error', (error) => {
          console.error(`WebSocket error for client ${clientId}:`, error);
        });
      });

      console.log('✅ WebSocket server initialized on /ws');

    } catch (error) {
      console.error('❌ Failed to initialize WebSocket server:', error);
      console.log('   Install ws package: npm install ws');
    }
  }

  /**
   * Handle messages from clients
   */
  handleClientMessage(clientId, data, ws) {
    const { type, payload } = data;

    switch (type) {
      case 'subscribe':
        // Subscribe to specific report updates
        ws.subscription = payload.reportId;
        ws.send(JSON.stringify({
          type: 'subscribed',
          reportId: payload.reportId
        }));
        break;

      case 'unsubscribe':
        delete ws.subscription;
        ws.send(JSON.stringify({
          type: 'unsubscribed'
        }));
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Unknown message type'
        }));
    }
  }

  /**
   * Broadcast notification to all connected clients
   */
  broadcast(notification) {
    if (!this.isEnabled || !this.wss) return;

    const message = JSON.stringify(notification);
    let sent = 0;

    this.clients.forEach((ws) => {
      if (ws.readyState === 1) { // WebSocket.OPEN = 1
        // If client is subscribed to a specific report, filter notifications
        if (ws.subscription) {
          if (notification.reportId === ws.subscription) {
            ws.send(message);
            sent++;
          }
        } else {
          // Send to all non-subscribed clients
          ws.send(message);
          sent++;
        }
      }
    });

    if (sent > 0) {
      console.log(`📢 Broadcast sent to ${sent} client(s): ${notification.type}`);
    }
  }

  /**
   * Send notification to specific client
   */
  sendToClient(clientId, notification) {
    if (!this.isEnabled) return;

    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(notification));
    }
  }

  /**
   * Notify about new report
   */
  notifyNewReport(report) {
    this.broadcast({
      type: 'new_report',
      reportId: report.id,
      data: {
        id: report.id,
        type: report.type,
        severity: report.severity,
        address: report.address,
        latitude: report.latitude,
        longitude: report.longitude,
        status: report.status
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notify about status change
   */
  notifyStatusChange(reportId, oldStatus, newStatus, details = {}) {
    this.broadcast({
      type: 'status_change',
      reportId,
      data: {
        oldStatus,
        newStatus,
        ...details
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notify about PoF upload
   */
  notifyPofUploaded(reportId, pofImagePath) {
    this.broadcast({
      type: 'pof_uploaded',
      reportId,
      data: {
        pofImagePath
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notify about new verification/upvote
   */
  notifyVerification(reportId, verificationType, count) {
    this.broadcast({
      type: 'verification',
      reportId,
      data: {
        verificationType,
        count
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notify about duplicate detection
   */
  notifyDuplicateDetected(reportId, duplicateOfId, matchScore) {
    this.broadcast({
      type: 'duplicate_detected',
      reportId,
      data: {
        duplicateOfId,
        matchScore
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      enabled: this.isEnabled,
      connectedClients: this.clients.size,
      clients: Array.from(this.clients.keys())
    };
  }
}

module.exports = new NotificationService();

