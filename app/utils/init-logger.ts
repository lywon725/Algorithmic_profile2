import { OpenAILogger } from './logger';

// Initialize logger with a startup message
const startupMessage = `\n=== Application Started at ${new Date().toISOString()} ===\n\n`;
const existingLogs = OpenAILogger.getLogs();
OpenAILogger.clearLogs();
OpenAILogger.log({
  timestamp: new Date().toISOString(),
  type: 'request',
  model: 'system',
  prompt: startupMessage
});

// Export the initialized logger
export { OpenAILogger }; 