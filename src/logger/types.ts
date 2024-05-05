
/**
 * Represents a logger interface with different log levels.
 */
export interface Logger {
  /**
   * Logs an error message.
   * @param message - The error message to log.
   */
  error(message: string): void;

  /**
   * Logs a warning message.
   * @param message - The warning message to log.
   */
  warn(message: string): void;

  /**
   * Logs an informational message.
   * @param message - The informational message to log.
   */
  info(message: string): void;

  /**
   * Logs a debug message.
   * @param message - The debug message to log.
   */
  debug(message: string): void;
}

/**
 * Represents different log levels.
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Represents a configurable logger interface with additional methods for toggling log outputs and setting log levels.
 */
export interface ConfigurableLogger extends Logger {
  /**
   * Toggles the debug log output.
   * @param silent - If true, the debug log output will be silenced. If false, the debug log output will be enabled.
   */
  toggleDebugOutput: (silent: boolean) => void;

  /**
   * Toggles the error log output.
   * @param silent - If true, the error log output will be silenced. If false, the error log output will be enabled.
   */
  toggleErrorOutput: (silent: boolean) => void;

  /**
   * Toggles the warning log output.
   * @param silent - If true, the warning log output will be silenced. If false, the warning log output will be enabled.
   */
  toggleWarnOutput: (silent: boolean) => void;

  /**
   * Toggles the info log output.
   * @param silent - If true, the info log output will be silenced. If false, the info log output will be enabled.
   */
  toggleInfoOutput: (silent: boolean) => void;

  /**
   * Sets the log level.
   * @param level - The log level to set.
   */
  setLogLevel: (level: LogLevel) => void;
}

/**
 * Represents an object with toggles for each log level.
 */
export type LogLevelToggles = { [key in LogLevel]: boolean };

/**
 * Represents an object with regular expressions for obfuscation.
 */
export type ObfuscateRegexps = { [key: string]: RegExp };

/**
 * Represents a configurable logger interface with additional method for toggling obfuscation.
 */
export interface ObfuscatingLogger {
  toggleObfuscation(silent: boolean): void;
}

export interface TaggableLogger {
  addTag(tag: string): void;
  removeTag(tag: string): void;
}