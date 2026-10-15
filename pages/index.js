import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import {
  cleanPostSummaries,
  fetchGlobalAllData,
  getPostBlocks
} from '@/lib/db/SiteDataApi'
import { formatNotionBlock } from '@/lib/db/notion/getPostBlocks'
import { generateRobotsTxt } from '@/lib/utils/robots.txt'
import { generateRss, shouldGenerateRssForLocale } from '@/lib/utils/rss'
import { generateSitemapXml } from '@/lib/utils/sitemap.xml'
import { DynamicLayout } from '@/themes/theme'
import { generateRedirectJson } from '@/lib/utils/redirect'
import { checkDataFromAlgolia } from '@/lib/plugins/algolia'
import pLimit from 'p-limit'
import { adapterNotionBlockMap } from '@/lib/utils/notion.util'

const HOME_POST_COUNT = 6

const toText = v => {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(toText).join(',')
  if (typeof v === 'object') return toText(v.name || v.value || '')
  return String(v)
}

const SCAN_SKIP_KEYS = [
  'id', 'title', 'summary', 'slug', 'category', 'tags', 'type', 'status',
  'password', 'icon', 'pageIcon', 'pageCover', 'pageCoverThumbnail',
  'fullWidth', 'content', 'toc', 'blockMap'
]

const getFeaturedText = post => {
  if (!post) return ''
  const direct = toText(
    post.Featured ??
      post.featured ??
      post.properties?.Featured ??
      post.ext?.Featured ??
      post.ext?.featured
  )
  if (direct) return direct
  for (const key of Object.keys(post)) {
    if (SCAN_SKIP_KEYS.includes(key)) continue
    const s = toText(post[key]).trim()
    if (s === '置顶' || s === '精选') return s
  }
  return ''
}

const getTime = p =>
  Number(p?.publishDate) ||
  new Date(p?.publishDay || p?.date?.start_date || p?.date || 0).getTime() ||
  0

const pickHomePosts = (posts = [], size = HOME_POST_COUNT) => {
  const byDate = [...posts].sort((a, b) => getTime(b) - getTime(a))

  const pinned = byDate
    .filter(p => getFeaturedText(p).includes('置顶'))
    .slice(0, 1)
  const pinnedIds = new Set(pinned.map(p => p.id))

  const featured = byDate
    .filter(p => !pinnedIds.has(p.id) && getFeaturedText(p).includes('精选'))
    .slice(0, 3)
  const featuredIds = new Set(featured.map(p => p.id))

  const rest = byDate.filter(p => !pinnedIds.has(p.id) && !featuredIds.has(p.id))
  const latest = rest.slice(0, 1)
  const normal = rest.slice(1)

  return [
    ...pinned.map(p => ({ ...p, featuredType: 'pinned' })),
    ...featured.map(p => ({ ...p, featuredType: 'featured' })),
    ...latest.map(p => ({ ...p, featuredType: 'latest' })),
    ...normal
  ].slice(0, size)
}

const Index = props => {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutIndex' {...props} />
}

export async function getStaticProps(req) {
  const { locale } = req
  const from = 'index'
  const props = await fetchGlobalAllData({ from, locale })

  const POST_PREVIEW_LINES = siteConfig('POST_PREVIEW_LINES', 8, props?.NOTION_CONFIG)
  const POST_PREVIEW_MAX_COUNT = siteConfig('POST_PREVIEW_MAX_COUNT', 4, props?.NOTION_CONFIG)
  const POST_LIST_PREVIEW = siteConfig('POST_LIST_PREVIEW', false, props?.NOTION_CONFIG)

  const publishedPosts = props.allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  ) || []

  // 调试日志
  const marked = publishedPosts.filter(p => getFeaturedText(p))
  console.log(
    'FEATURED_DEBUG 已发布文章数:', publishedPosts.length,
    '| 读到 Featured 的文章数:', marked.length
  )
  console.log(
    'FEATURED_DEBUG 第一篇文章的字段名:',
    JSON.stringify(Object.keys(publishedPosts[0] || {}))
  )
  marked.slice(0, 10).forEach(p =>
    console.log('FEATURED_DEBUG 命中:', p.title, '=>', getFeaturedText(p))
  )

  // ⭐ 修复：1. 先存标记，2. 清理，3. 恢复标记，4. 选文打标签
  const featuredMap = new Map()
  publishedPosts.forEach(p => {
    const text = getFeaturedText(p)
    if (text) featuredMap.set(p.id, text)
  })

  let cleanedPosts = publishedPosts
  if (!POST_LIST_PREVIEW) {
    cleanedPosts = cleanPostSummaries(publishedPosts)
  }

  cleanedPosts.forEach(p => {
    const text = featuredMap.get(p.id)
    if (text) p.Featured = text // 把字段塞回去，让 pickHomePosts 能认出来
  })

  props.posts = pickHomePosts(cleanedPosts, HOME_POST_COUNT)

  if (POST_LIST_PREVIEW) {
    const previewLimit = pLimit(
      siteConfig('POST_PREVIEW_CONCURRENCY', 5, props?.NOTION_CONFIG)
    )
    const previewTargets = props.posts
      .filter(post => !post.password || post.password === '')
      .slice(0, POST_PREVIEW_MAX_COUNT)
    await Promise.all(
      previewTargets.map(post =>
        previewLimit(async () => {
          const rawBlockMap = await getPostBlocks(post.id, 'slug', POST_PREVIEW_LINES)
          post.blockMap = adapterNotionBlockMap(rawBlockMap)
          if (post.blockMap?.block) {
            post.blockMap.block = formatNotionBlock(post.blockMap.block)
          }
        })
      )
    )
  }

  const isBuildLifecycle = ['build', 'export'].includes(process.env.npm_lifecycle_event)
  if (isBuildLifecycle) {
    generateRobotsTxt(props)
    if (shouldGenerateRssForLocale({ locale })) {
      await generateRss(props)
    }
    generateSitemapXml(props)
    await checkDataFromAlgolia(props)
    if (siteConfig('UUID_REDIRECT', false, props?.NOTION_CONFIG)) {
      generateRedirectJson(props)
    }
  }

  // ⭐ 极其重要：这里不能再清理 props.posts 了，否则刚打上的标签又没了！
  props.latestPosts = cleanPostSummaries(props.latestPosts)

  delete props.allPages

  return {
    props,
    revalidate: process.env.EXPORT
      ? undefined
      : siteConfig('NEXT_REVALIDATE_SECOND', BLOG.NEXT_REVALIDATE_SECOND, props.NOTION_CONFIG)
  }
}

export default Index
