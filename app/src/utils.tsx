import { ARNS_TX_ID_REGEX } from './constants';
import { isAddress } from 'viem';

/**
 * Splits a string into two segments, each containing a specified number of characters, and separates them with an ellipsis ('...'). If the `maxCharCount` parameter is not provided or if the string length is less than `maxCharCount`, the original string is returned.
 *
 * @param {string} str - The string to be split.
 * @param {number} [maxCharCount] - The maximum number of characters for the split segments. If provided, the function will split the string into two segments, each containing approximately half of the specified `maxCharCount`, separated by an ellipsis ('...').
 * @returns {string} - The split string with an ellipsis ('...') inserted in the middle, or the original string if `maxCharCount` is not provided or if the string length is less than `maxCharCount`.
 *
 * @example
 * // Returns 'He...lo'
 * formatForMaxCharCount('Hello', 4);
 *
 * @example
 * // Returns 'Hello World'
 * formatForMaxCharCount('Hello World');
 */
export function formatForMaxCharCount(
  str: string,
  maxCharCount?: number,
): string {
  if (!str?.length) return '';
  if (maxCharCount && str.length > maxCharCount) {
    const shownCount = Math.round(maxCharCount / 2);
    return `${str.slice(0, shownCount)}...${str.slice(
      str.length - shownCount,
      str.length,
    )}`;
  }

  return str;
}

export function camelToReadable(camel: string) {
  const words = camel.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function isArweaveTransactionID(id?: string) {
  if (!id) {
    return false;
  }
  if (!ARNS_TX_ID_REGEX.test(id)) {
    return false;
  }
  return true;
}

export function isEthAddress(address: string) {
  return isAddress(address, {
    strict: true,
  });
}

export function isValidAoAddress(address: string) {
  return isEthAddress(address) || isArweaveTransactionID(address);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
