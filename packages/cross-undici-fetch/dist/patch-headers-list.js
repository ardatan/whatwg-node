const { validateHeaderName, validateHeaderValue } = require('http')
const binarySearch = require('./binary-search')

module.exports = function patchHeadersList(HeadersList) {
  Object.defineProperties(HeadersList.prototype, {
    append: {
      configurable: true,
      enumerable: true,
      value: function append(name, value) {
        const normalizedName = normalizeAndValidateHeaderName(name)
        const normalizedValue = normalizeAndValidateHeaderValue(name, value)

        const index = binarySearch(this, normalizedName)

        if (this[index] === normalizedName) {
          this[index + 1] += `, ${normalizedValue}`
        } else {
          this.splice(index, 0, normalizedName, normalizedValue)
        }
      }
    },
    delete: {
      configurable: true,
      enumerable: true,
      value: function headersListDelete(name) {
        const normalizedName = normalizeAndValidateHeaderName(name)

        const index = binarySearch(this, normalizedName)

        if (this[index] === normalizedName) {
          this.splice(index, 2)
        }
      }
    },
    get: {
      configurable: true,
      enumerable: true,
      value: function get(name) {
        const normalizedName = normalizeAndValidateHeaderName(name)

        const index = binarySearch(this, normalizedName)

        if (this[index] === normalizedName) {
          return this[index + 1]
        }

        return null
      }
    },
    has: {
      configurable: true,
      enumerable: true,
      value: function has(name) {
        const normalizedName = normalizeAndValidateHeaderName(name)

        const index = binarySearch(this, normalizedName)

        return this[index] === normalizedName
      }
    },
    set: {
      configurable: true,
      enumerable: true,
      value: function set(name, value) {
        const normalizedName = normalizeAndValidateHeaderName(name)
        const normalizedValue = normalizeAndValidateHeaderValue(name, value)

        const index = binarySearch(this, normalizedName)
        if (this[index] === normalizedName) {
          this[index + 1] = normalizedValue
        } else {
          this.splice(index, 0, normalizedName, normalizedValue)
        }
      }
    }
  })
}
