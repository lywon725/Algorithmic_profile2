import fs from 'fs';
import path from 'path';

export interface LogEntry {
  type: 'request' | 'response' | 'info';
  timestamp: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  prompt?: string;
  content?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  message?: string;
  data?: any;
}

export class OpenAILogger {
  private static readonly STORAGE_KEY = 'openai-logs';

  private static formatLogEntry(entry: LogEntry): string {
    const lines = [
      `[${entry.timestamp}] ${entry.type.toUpperCase()}`,
      `Model: ${entry.model}`,
    ];

    if (entry.type === 'request') {
      if (entry.temperature) lines.push(`Temperature: ${entry.temperature}`);
      if (entry.maxTokens) lines.push(`Max Tokens: ${entry.maxTokens}`);
      lines.push('Prompt:', entry.prompt || '');
    } else {
      lines.push('Content:', entry.content || '');
      if (entry.usage) {
        lines.push('Usage:', JSON.stringify(entry.usage, null, 2));
      }
    }

    return lines.join('\n') + '\n' + '='.repeat(80) + '\n\n';
  }

  static async log(entry: LogEntry) {
    try {
      // Read existing logs from localStorage
      let logs = '';
      const storedLogs = localStorage.getItem(this.STORAGE_KEY);
      if (storedLogs) {
        logs = storedLogs;
      }

      // Add new log entry
      const formattedEntry = this.formatLogEntry(entry);
      logs += formattedEntry;

      // Store updated logs
      localStorage.setItem(this.STORAGE_KEY, logs);

      // Write to console for immediate feedback
      console.log(`\n=== OpenAI ${entry.type.toUpperCase()} ===`);
      console.log(JSON.stringify(entry, null, 2));
      console.log('=============================\n');
    } catch (error) {
      console.error('Error writing to logs:', error);
    }
  }

  static async logRequest(details: {
    model: string;
    temperature?: number;
    max_tokens?: number;
    prompt: string;
  }) {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'request',
      ...details
    });
  }

  static async logResponse(details: {
    model: string;
    content: string;
    usage?: any;
  }) {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'response',
      ...details
    });
  }

  static getLogs(): string {
    try {
      return localStorage.getItem(this.STORAGE_KEY) || '';
    } catch (error) {
      console.error('Error reading logs:', error);
      return '';
    }
  }

  static clearLogs() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  }

  static exportLogsToFile() {
    try {
      const logs = this.getLogs();
      if (!logs) {
        alert('No logs available to export');
        return;
      }

      // Create a blob with the logs
      const blob = new Blob([logs], { type: 'text/plain' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openai-logs-${new Date().toISOString().split('T')[0]}.txt`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting logs:', error);
      alert('Failed to export logs');
    }
  }
} 