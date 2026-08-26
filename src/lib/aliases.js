export const TITLE_ALIASES = {
  185874: ['bleach sennen kessen', 'bleach thousand year blood war'],
  108632: ['re zero kara hajimeru', 'rezero starting life'],
  21: ['one piece'],
  235: ['detective conan', 'meitantei conan']
}

export function aliasTitles (anilistId) {
  const n = Number(anilistId)
  if (!Number.isInteger(n)) return []
  const list = TITLE_ALIASES[n]
  return Array.isArray(list) ? list.slice() : []
}
