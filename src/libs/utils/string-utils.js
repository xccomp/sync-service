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

export const sanitizeName = (name, alternativeName = 'UNKNOWN_NAME', whiteList = [/^[\p{L}0-9\s\-'’().\/]+$/u], fatalList = [], maxSuspicionScore = 1) => {
  if (!name || typeof name !== 'string') return alternativeName

  const isWithinFatalList = fatalList.some(regEx => regEx.test(name))
  if (isWithinFatalList) {
    console.warn(`[Sanitization] The name "${name}" was invalidated during the sanitization process and replaced with "${alternativeName}".`)
    return alternativeName
  }

  let cleanText = name
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[‘’`´]/g, "'")
    .replace(/_/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  let suspicionScore = 0
  const suspiciousPatterns = [
    /(--|;|--)/g,
    /\/\*|\*\//g,
    /\$(?!\s)/g,
    /[<>{}[\]\\]/g,
    /\b(select|insert|delete|update|drop|union|script)\b/gi
  ]
  suspiciousPatterns.forEach(pattern => {
    const matches = cleanText.match(pattern)
    if (matches) suspicionScore += matches.length
  })
  if (suspicionScore > maxSuspicionScore) {
    console.warn(`[Sanitization] The name "${name}" was invalidated during the sanitization process and replaced with "${alternativeName}".`)
    return alternativeName
  }

  const isWithinWhiteList = whiteList.some(regEx => regEx.test(cleanText))
  if (!isWithinWhiteList) {
    console.warn(`[Sanitization] The name "${name}" was invalidated during the sanitization process and replaced with "${alternativeName}".`)
    return alternativeName
  }

  return cleanText
}