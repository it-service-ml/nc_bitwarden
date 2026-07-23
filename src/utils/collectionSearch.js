export function normalizeCollectionSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('de')
    .trim()
}

export function normalizeCollectionPath(value) {
  return String(value ?? '')
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .join('/')
}

export function collectionMatchesQuery(collection, query) {
  const normalizedQuery = normalizeCollectionSearch(query)

  if (!normalizedQuery) {
    return true
  }

  return normalizeCollectionSearch(
    normalizeCollectionPath(collection?.name)
  ).includes(normalizedQuery)
}

export function collectionNameParts(collection) {
  const path = normalizeCollectionPath(collection?.name)
  const parts = path.split('/').filter(Boolean)

  return {
    path,
    label: parts.pop() || '(ohne Name)',
    parent: parts.join(' / '),
  }
}
