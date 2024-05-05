import { CommonRegExes } from "./constants";
import { ObfuscateRegexps } from "./types";

/**
 * Class responsible for obfuscating sensitive data in a string.
 */
export class SensitiveDataObfuscator {
  private symbol: string;

  /**
   * Creates an instance of SensitiveDataObfuscator.
   * @param matchers - Regular expressions used to match sensitive data.
   * @param symbol - Symbol used for obfuscation. Defaults to '*'.
   */
  constructor(private readonly matchers: ObfuscateRegexps = CommonRegExes, symbol: string = '*') {
    this.symbol = symbol;
  }

  /**
   * Obfuscates sensitive data in a string.
   * @param sensitiveData - The sensitive data to obfuscate.
   * @returns The obfuscated string.
   */
  private obfuscateSensitiveData(sensitiveData: string): string {
    return sensitiveData.replace(/./g, this.symbol);
  }

  /**
   * Obfuscates sensitive data in the input string.
   * @param input - The input string containing sensitive data.
   * @returns The obfuscated string.
   */
  public obfuscate(input: string): string {
    let obfuscated = input;

    for (const key in this.matchers) {
      obfuscated = obfuscated.replace(this.matchers[key], (match) => this.obfuscateSensitiveData(match));
    }

    return obfuscated;
  }
}