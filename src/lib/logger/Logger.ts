import { SensitiveDataObfuscator } from "./SensitiveDataObfuscator";
import { LogLevel, Logger } from "./types";
import type { ConfigurableLogger, LogLevelToggles, ObfuscatingLogger, TaggableLogger } from "./types";

/**
 * A configurable logger that wraps another logger and provides additional functionality for toggling log outputs, setting log levels, and obfuscating sensitive data.
 */
export class ConfigurableWrappedLogger implements ObfuscatingLogger, ConfigurableLogger, TaggableLogger {
  private readonly logState: LogLevelToggles;
  private readonly logPrecedence: LogLevel[] = [
    LogLevel.DEBUG,
    LogLevel.INFO,
    LogLevel.WARN,
    LogLevel.ERROR,
  ];
  private enableObfuscation: boolean;

  /**
   * Creates an instance of ConfigurableWrappedLogger.
   * @param logger - The logger to wrap.
   * @param logLevel - The log level to set. Defaults to LogLevel.INFO.
   * @param obfuscator - The sensitive data obfuscator to use. Defaults to a new instance of SensitiveDataObfuscator.
   */
  constructor(
    private logger: Logger,
    private logLevel: LogLevel = LogLevel.INFO,
    private readonly obfuscator?: SensitiveDataObfuscator,
    private readonly alwaysTagWith: string[] = [],
    enableObfuscation: boolean = true,
  ) {
    this.logState = {
      [LogLevel.ERROR]: true,
      [LogLevel.WARN]: true,
      [LogLevel.INFO]: true,
      [LogLevel.DEBUG]: false,
    };
    this.setLogLevel(logLevel);
    this.enableObfuscation = enableObfuscation;
    this.obfuscator = new SensitiveDataObfuscator();
  }

  /**
   * Adds a tag to the logger instance.
   * @param tag - The tag to be added.
   */
  addTag(tag: string): void {
    this.alwaysTagWith.push(tag);
  }

  /**
   * Removes a tag from the list of tags that are always added to log messages.
   * @param tag - The tag to be removed.
   */
  removeTag(tag: string): void {
    const index = this.alwaysTagWith.indexOf(tag);
    if (index !== -1) {
      this.alwaysTagWith.splice(index, 1);
    }
  }

  /**
   * Toggles the obfuscation of sensitive data in log messages.
   * @param silent A boolean indicating whether to silence obfuscation.
   * @returns void
   */
  toggleObfuscation(silent: boolean): void {
    this.enableObfuscation = silent;
  }

  /**
   * Toggles the output of debug log messages.
   * @param silent A boolean indicating whether to silence debug log messages.
   */
  toggleDebugOutput(silent: boolean): void {
    this.logState[LogLevel.DEBUG] = silent;
  }

  /**
   * Toggles the output of error log messages.
   * @param silent A boolean indicating whether to silence error log messages.
   */
  toggleErrorOutput(silent: boolean): void {
    this.logState[LogLevel.ERROR] = silent;
  }

  /**
   * Toggles the output of warn log messages.
   * @param silent A boolean indicating whether to silence warn log messages.
   */
  toggleWarnOutput(silent: boolean): void {
    this.logState[LogLevel.WARN] = silent;
  }

  /**
   * Toggles the output of info log messages.
   * @param silent A boolean indicating whether to silence info log messages.
   */
  toggleInfoOutput(silent: boolean): void {
    this.logState[LogLevel.INFO] = silent;
  }

  /**
   * Sets the log level.
   * @param level The log level to set.
   * @throws An error if the specified log level is invalid.
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    const precedenceIndex = this.logPrecedence.indexOf(level);
    if (precedenceIndex === -1) {
      throw new Error(`Invalid log level: ${level}`);
    }
    this.logPrecedence.forEach((logLevel, index) => {
      this.logState[logLevel] = index >= precedenceIndex;
    });
  }

  private extractLogLevels(arr: string[]): string[] {
    const logLevels = ['debug', 'info', 'warn', 'error'];
    return arr.filter(item => logLevels.includes(item));
  }

  private filterArray(baseArray: string[], filterArray: string[]): string[] {
    return baseArray.filter(item => !filterArray.includes(item));
  }

  private inverseFilterArray(baseArray: string[], filterArray: string[]): string[] {
    return baseArray.filter(item => filterArray.includes(item));
  }

  /**
   * Prepares a message for logging.
   * @param message The message to prepare.
   * @param tags The tags to include in the message.
   * @returns The prepared message.
   */
  private prepareMessage(message: string|string[], tags?: string[]): string {
    // console.error("@@@@@@@",tags, message)
    let formattedMessage = Array.isArray(message) ? message.join(' ') : message;
    const concatTags = tags ? [...tags, ...this.alwaysTagWith] : this.alwaysTagWith;
    if (concatTags && concatTags.length > 0) {
      // formattedMessage = `[${concatTags.join(', ')}] ${message}`;
      const logLevels = this.inverseFilterArray(concatTags, ['debug', 'info', 'warn', 'error']);
      formattedMessage = JSON.stringify({type: logLevels, tags: this.filterArray(concatTags, logLevels), message: formattedMessage});

    }
    return this.enableObfuscation && this.obfuscator ? this.obfuscator.obfuscate(formattedMessage) : formattedMessage;
  }

  debug(message: string | string[]): void;
  debug(message: string | string[], tags: string[]): void;
  debug(message: string | string[], tags?: string[]): void {
    if (this.logState[LogLevel.DEBUG]) {
      this.logger.debug(this.prepareMessage(message, ['debug', ...tags??[]]));
    }
  }

  error(message: string | string[]): void;
  error(message: string | string[], tags: string[]): void;
  error(message: string | string[], tags?: string[]): void {
    if (this.logState[LogLevel.ERROR]) {
      this.logger.error(this.prepareMessage(message, ['error', ...tags??[]]));
    }
  }

  warn(message: string | string[]): void;
  warn(message: string | string[], tags: string[]): void;
  warn(message: string | string[], tags?: string[]): void {
    if (this.logState[LogLevel.WARN]) {
      this.logger.warn(this.prepareMessage(message, ['warn', ...tags??[]]));
    }
  }

  info(message: string | string[]): void;
  info(message: string | string[], tags: string[]): void;
  info(message: string | string[], tags?: string[]): void {
    if (this.logState[LogLevel.INFO]) {
      // console.info('^^^^^ info', message, tags, this.alwaysTagWith, 'info state is', this.logState[LogLevel.INFO], 'prepared: ', this.prepareMessage(message, ['info', ...tags??[]]));
      const prepared = this.prepareMessage(message, ['info', ...(tags??[])])
      // console.error('>>> Info tags:',['info', ...(tags??[])], "prepared: ", prepared)
      this.logger.info(prepared);
    }
  }
}
