export const isNumeric = (s) => /^[+-]?\d+(\.\d+)?$/.test(s)

export const stringTemplate = (string, data, useBrackets = false) => {
  if (useBrackets) {
    return string.replace(/\$\[([^\[\]]*)\]/g,
      function (a, b) {
          var r = data[b]
          return typeof r === 'string' || typeof r === 'number' ? r : a
      }
    )
  }
  return string.replace(/\${([^{}]*)}/g,
      function (a, b) {
          var r = data[b]
          return typeof r === 'string' || typeof r === 'number' ? r : a
      }
  )
}