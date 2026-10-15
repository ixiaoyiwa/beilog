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

// 首页展示的文章数量
const HOME_POST_COUNT = 6

// 把各种可能的 Notion 字段格式统一转成文本
const toText = v => {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(toText).join(',')
  if (typeof v === 'object') return toText(v.name || v.value || '')
  return String(v)
}

// 这些字段不参与"兜底扫描"，避免把标题、分类里的"精选"误判成标记
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
  // 兜底：某个顶层字段的值恰好就是 置顶 / 精选
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

/**
 * 首页选文：1 置顶 + 最多 3 精选 + 1 最新 + 普通文章补齐
 */
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

/**
 * 首页布局
 */
const Index = props => {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutIndex' {...props} />
}

/**
 * SSG 获取数据
 */
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

  // ====== 调试日志：在 Cloudflare 构建日志里搜索 FEATURED_DEBUG ======
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
  // =================================================================

  // 首页：只保留最终要展示的几篇，其余不传给前端
  props.posts = pickHomePosts(publishedPosts, HOME_POST_COUNT)

  // 预览文章内容
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

  if (!POST_LIST_PREVIEW) {
    props.posts = cleanPostSummaries(props.posts)
  }
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
