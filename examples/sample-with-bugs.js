// Example input for the review bot. Open a PR that adds/changes a file like this,
// then run:  node review-pr.mjs <owner> <repo> <pr-number>
// The bot will flag the off-by-one, the loose equality, the unused parameter,
// and the missing null check — the kinds of correctness bugs it's prompted to catch.

export function findIndex(arr, target) {
  // BUG: loose equality (==) instead of ===
  // BUG: off-by-one — `i <= arr.length` reads past the end of the array
  for (let i = 0; i <= arr.length; i++) {
    if (arr[i] == target) return i;
  }
  return -1;
}

export function sum(numbers, result) {
  // BUG: `result` parameter is ignored / shadowed
  let total = 0;
  for (const n of numbers) total += n;
  return total;
}

export function first(arr) {
  // BUG: no null/undefined check before indexing
  return arr[0];
}
