import { siteConfig } from '@/lib/config'

function getCategoryMapping(NOTION_CONFIG = {}) {
  const mapping = siteConfig(
    'POST_URL_PREFIX_MAPPING_CATEGORY',
    {},
    NOTION_CONFIG
  )

  return mapping && typeof mapping === 'object' && !Array.isArray(mapping)
    ? mapping
    : {}
}

export function getCategorySlug(category, NOTION_CONFIG = {}) {
  const mapping = getCategoryMapping(NOTION_CONFIG)
  return mapping[category] || category
}

export function getCategoryNameFromSlug(slug, NOTION_CONFIG = {}) {
  let decoded = String(slug || '')

  try {
    decoded = decodeURIComponent(decoded)
  } catch (e) {
    // ignore
  }

  const mapping = getCategoryMapping(NOTION_CONFIG)

  const matched = Object.entries(mapping).find(
    ([, value]) => value === decoded
  )

  return matched ? matched[0] : decoded
}

export function getCategoryUrl(category, NOTION_CONFIG = {}) {
  return `/category/${encodeURIComponent(
    getCategorySlug(category, NOTION_CONFIG)
  )}`
}
