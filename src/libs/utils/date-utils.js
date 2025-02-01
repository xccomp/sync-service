export function createDate () {
  const date  = new Date()
  date.setHours(12, 0, 0, 0)
}


export function parseServerDateParameter (serverDateParameter) {
  if (!serverDateParameter) return null
  const arrDate = serverDateParameter.split('-')
  return new Date(Number(arrDate[0]), Number(arrDate[1]) - 1, Number(arrDate[2]), 12, 0)
}