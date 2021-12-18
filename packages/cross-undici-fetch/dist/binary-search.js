module.exports = function binarySearch(arr, val) {
  let low = 0
  let high = Math.floor(arr.length / 2)

  while (high > low) {
    const mid = (high + low) >>> 1

    if (val > arr[mid * 2]) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  return low * 2
}