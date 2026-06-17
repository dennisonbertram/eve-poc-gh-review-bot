/**
 * Utility functions for array processing.
 */

/**
 * Returns the index of the first item in arr that equals target.
 * Returns -1 if not found.
 */
function findIndex(arr, target) {
  for (let i = 0; i <= arr.length; i++) {   // BUG: off-by-one — should be i < arr.length
    if (arr[i] == target) {                  // BUG: loose equality == instead of ===
      return i;
    }
  }
  return -1;
}

/**
 * Sums an array of numbers.
 * @param {number[]} numbers
 * @param {string} label - unused parameter (ignored)
 */
function sum(numbers, label) {              // BUG: label parameter is declared but never used
  return numbers.reduce((acc, n) => acc + n, 0);
}

/**
 * Gets the first element of an array.
 */
function first(arr) {
  return arr[0];                            // BUG: no null/undefined check — throws if arr is null
}

module.exports = { findIndex, sum, first };
