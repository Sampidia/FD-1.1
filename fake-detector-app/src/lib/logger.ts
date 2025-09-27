// Simple logger utility
interface LogData {
  [key: string]: unknown
}

export class Logger {
  private static formatMessage(level: string, message: string, data?: LogData): string {
    const timestamp = new Date().toISOString()
    const dataStr = data ? JSON.stringify(data) : ''
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${dataStr}`
  }

  static info(message: string, data?: LogData): void {
    console.log(this.formatMessage('info', message, data))
  }

  static error(message: string, data?: LogData): void {
    console.error(this.formatMessage('error', message, data))
  }

  static warn(message: string, data?: LogData): void {
    console.warn(this.formatMessage('warn', message, data))
  }

  static debug(message: string, data?: LogData): void {
    console.debug(this.formatMessage('debug', message, data))
  }
}