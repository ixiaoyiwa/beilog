import BLOG from '@/blog.config'
import { marked } from 'marked' // 修改 C
import { getOrSetDataWithCache } from '../cache/cache_manager'
import { getAllCategories } from '@/lib/db/notion/getAllCategories'
import getAllPageIds from '@/lib/db/notion/getAllPageIds'
import { getAllTags } from '@/lib/db/notion/getAllTags'
import { getConfigMapFromConfigPage } from '@/lib/db/notion/getNotionConfig'
import getPageProperties, {
  adjustPageProperties
} from '@/lib/db/notion/getPageProperties'
import {
  getCustomMenu,
  getSourcePageSlugs
} from '@/lib/db/notion/getCustomMenu'
import {
  fetchInBatches,
  fetchNotionPageBlocks,
  formatNotionBlock
} from '@/lib/db/notion/getPostBlocks'
import { compressImage, mapImgUrl } from '@/lib/db/notion/mapImage'
import { deepClone } from '@/lib/utils'
import { idToUuid } from 'notion-utils'
import { siteConfig } from '../config'
import { extractLangId, extractLangPrefix, getShortId } from '../utils/pageId'
import {
  normalizeNotionMetadata,
  normalizeCollection,
  normalizeSchema,
  normalizePageBlock
} from './notion/normalizeUtil'
import { filterCollectionViewData } from './notion/filterCollectionViewData'
import { fetchPageFromNotion } from './notion/getNotionPost'
import { processPostData } from '../utils/post'
import { writePwaManifest } from '../pwa.server'
import { adapterNotionBlockMap } from '../utils/notion.util'
import { sortPinnedPostsByLatestUpdate } from '@/lib/utils/pinnedPosts'
import { slimGlobalData } from '@/lib/utils/slimPageData' // <-- 新增导入
import { redactPost, redactSiteData } from '@/lib/utils/publicPost'
import { resolveUuidPostAccess, normalizePostId, redactProtectedBlocks, verifyPostPassword } from '@/lib/server/postAccess'
import { isExport } from '@/lib/utils/buildMode'
import { fetchMembersFromOfficialAPI } from './notion/memberDataSource'
import {
  getPublishedTypedPages,
  sortTypedPagesByPublishDate
} from '@/lib/site/typedCollections'

export { getAllTags } from './notion/getAllTags'
export { fetchPageFromNotion as getPost } from './notion/getNotionPost'
export { fetchNotionPageBlocks as getPostBlocks } from './notion/getPostBlocks'

/**
 * 获取全站数据；基于 Notion 实现
 * 支持多站点（pageId 逗号分隔）和多语言（locale 前缀）
 */
export async function fetchGlobalAllData({
  pageId = BLOG.NOTION_PAGE_ID,
  from,
  locale,
  includePasswordHashes = false,
  requireAvailableData = false,
  includeInnerLinkPages = false // <-- 新增参数
}) {
  if (BLOG.BUNDLE_ANALYZER) {
    const data = EmptyData(pageId)
    delete data.__notionDataUnavailable
    return data
  }

  const cacheKey = getGlobalDataCacheKey({ pageId, locale })
  const cachedData = await getOrSetDataWithCache(cacheKey, async () => {
    const siteIds = pageId?.split(',') || []
    let data = EmptyData(pageId)

    try {
      for (let index = 0; index < siteIds.length; index++) {
        const siteId = siteIds[index]
        const id = extractLangId(siteId)
        const prefix = extractLangPrefix(siteId)

        if (index === 0 || locale === prefix) {
          data = await getSiteDataByPageId({ pageId: id, from })
        }
      }
    } catch (error) {
      console.error('异常', error)
      data = EmptyData(pageId)
    }

    return handleDataBeforeReturn(deepClone(data))
  })

  const data = deepClone(cachedData)
  if (requireAvailableData && data?.__notionDataUnavailable) {
    throw new Error('Site catalog is temporarily unavailable')
  }
  delete data.__notionDataUnavailable
  slimGlobalData(data, { includeInnerLinkPages }) // <-- 新增瘦身逻辑
  data.latestPosts = cleanPostSummaries(data.latestPosts)
  if (data.notice?.blockMap) redactProtectedBlocks(data.notice, data.allPages || [])
  data.notice = cleanNoticeForClient(data.notice)
  if (data.notice) delete data.notice.id
  return includePasswordHashes ? data : redactSiteData(data)
}

function getGlobalDataCacheKey({ pageId, locale }) {
  const safePageId = String(pageId || BLOG.NOTION_PAGE_ID).replace(
    /[^a-z0-9,_:-]/gi,
    '_'
  )
  const safeLocale = String(locale || 'default').replace(/[^a-z0-9_-]/gi, '_')
  return `global_data_${safeLocale}_${safePageId}`
}

export async function getSiteDataByPageId({ pageId, from }) {
  const cacheKey = `site_${pageId}`

  const data = await getOrSetDataWithCache(cacheKey,
    async () => {
      console.log('获取全站数据 ', pageId)
      const originalPageRecordMap = await fetchNotionPageBlocks(pageId, from)
      const r = await convertNotionToSiteData(pageId, from, originalPageRecordMap)
      return Array.isArray(r?.allPages) ? r : EmptyData(pageId)
    }
  )
  if (process.env.NODE_ENV === 'development') {
    console.log(
      '[ThemeResolver][site-data]',
      JSON.stringify({
        from,
        pageId,
        notionTheme: data?.NOTION_CONFIG?.THEME || null,
        configTheme: BLOG.THEME,
        cacheEnabled: BLOG.ENABLE_CACHE
      })
    )
  }
  return data
}

async function getNotice(post) {
  if (!post) return null

  try {
    const rawBlockMap = await fetchNotionPageBlocks(post.id, 'data-notice', {
      cacheVersion: post.lastEditedDate
    })
    const adapted = adapterNotionBlockMap(rawBlockMap)
    post.blockMap = {
      ...adapted,
      block: formatNotionBlock(adapted.block)
    }
  } catch (e) {
    console.warn('[getNotice] fetchNotionPageBlocks failed:', post.id, e)
    post.blockMap = null
  }

  return post
}

const CLIENT_POST_SUMMARY_FIELDS = [
  'id',
  'short_id',
  'title',
  'name',
  'slug',
  'href',
  'target',
  'pageIcon',
  'icon',
  'pageCover',
  'pageCoverThumbnail',
  'date',
  'publishDate',
  'publishDay',
  'lastEditedDate',
  'lastEditedDay',
  'category',
  'tags',
  'tagItems',
  'summary',
  'description',
  'type',
  'status',
  'featuredType', // ✨ 核心修改：放行标签字段
  'password',
  'readTime',
  'wordCount',
  'ext',
  'audio'
]

export function cleanPostSummary(post) {
  if (!post || typeof post !== 'object') return post

  const result = {}
  CLIENT_POST_SUMMARY_FIELDS.forEach(field => {
    if (post[field] !== undefined) result[field] = post[field]
  })
  return redactPost(result)
}

export function cleanPostSummaries(posts) {
  if (!Array.isArray(posts)) return posts
  return posts.map(cleanPostSummary)
}

function cleanPostForClient(post) {
  if (!post?.blockMap) return post
  const cleanedPost = cleanBlock(post)
  delete cleanedPost.content
  cleanRecordMapMetadata(cleanedPost.blockMap)
  filterCollectionViewData(cleanedPost.blockMap)
  pruneUnusedCollectionRecords(cleanedPost.blockMap)
  return cleanedPost
}

function cleanNoticeForClient(notice) {
  if (!notice?.blockMap) return notice
  const cleanedNotice = cleanBlock(notice)
  pruneBlockMapToRootPage(cleanedNotice.blockMap, cleanedNotice.id)
  cleanRecordMapMetadata(cleanedNotice.blockMap)
  filterCollectionViewData(cleanedNotice.blockMap)
  pruneUnusedCollectionRecords(cleanedNotice.blockMap)
  return cleanedNotice
}

function pruneBlockMapToRootPage(blockMap, rootId) {
  if (!blockMap?.block) return

  const rootBlockId = rootId || findRootPageBlockId(blockMap.block)
  if (!rootBlockId) return

  const keepIds = new Set([rootBlockId])
  let changed = true
  while (changed) {
    changed = false
    Object.entries(blockMap.block).forEach(([id, entry]) => {
      const block = entry?.value || entry
      if (!keepIds.has(id) && keepIds.has(block?.parent_id)) {
        keepIds.add(id)
        changed = true
      }
    })
  }

  Object.keys(blockMap.block).forEach(id => {
    if (!keepIds.has(id)) delete blockMap.block[id]
  })
}

function findRootPageBlockId(blockRecord) {
  return Object.values(blockRecord)
    .map(entry => entry?.value || entry)
    .find(block => block?.type === 'page' && Array.isArray(block.content))
    ?.id
}

function cleanRecordMapMetadata(blockMap) {
  if (!blockMap) return

  delete blockMap.__version__
  if (blockMap.notion_user && Object.keys(blockMap.notion_user).length === 0) {
    delete blockMap.notion_user
  }

  cleanRecordEntries(blockMap.collection)
  cleanRecordEntries(blockMap.collection_view)
}

function pruneUnusedCollectionRecords(blockMap) {
  if (!blockMap?.block) return

  const collectionIds = new Set()
  const viewIds = new Set()
  Object.values(blockMap.block).forEach(entry => {
    const block = entry?.value || entry
    if (!block || typeof block !== 'object') return
    if (block.collection_id) collectionIds.add(block.collection_id)
    block.view_ids?.forEach(viewId => viewIds.add(viewId))
  })

  pruneRecordByIds(blockMap.collection, collectionIds)
  pruneRecordByIds(blockMap.collection_view, viewIds)
  pruneRecordByIds(blockMap.collection_query, collectionIds)
}

function pruneRecordByIds(record, ids) {
  if (!record || typeof record !== 'object') return
  Object.keys(record).forEach(id => {
    if (!ids.has(id)) delete record[id]
  })
}

function cleanRecordEntries(record) {
  if (!record || typeof record !== 'object') return

  Object.values(record).forEach(entry => {
    const value = entry?.value || entry
    if (!value || typeof value !== 'object') return

    delete value.version
    delete value.created_by_table
    delete value.created_by_id
    delete value.last_edited_by_table
    delete value.last_edited_by_id
    delete value.space_id
    delete value.parent_table
    delete value.permissions
    delete value.alive
    delete value.role
    delete value.copied_from_pointer
    delete value.copied_from
  })
}

const EmptyData = pageId => ({
  // Persist the failure distinction in the cache, never in public page props.
  __notionDataUnavailable: true,
  notice: null,
  siteInfo: getSiteInfo({}),
  allPages: [
    {
      id: 1,
      title: `无法获取Notion数据，请检查Notion_ID： \n 当前 ${pageId}`,
      summary:
        '访问文档获取帮助 → https://docs.tangly1024.com/article/vercel-deploy-notion-next',
      status: 'Published',
      type: 'Post',
      slug: 'oops',
      publishDay: '2024-11-13',
      pageCoverThumbnail: BLOG.HOME_BANNER_IMAGE || '/bg_image.jpg',
      date: {
        start_date: '2023-04-24',
        lastEditedDay: '2023-04-24',
        tagItems: []
      }
    }
  ],
  allNavPages: [],
  allLinkPages: [],
  collection: [],
  collectionQuery: {},
  collectionId: null,
  collectionView: {},
  viewIds: [],
  block: {},
  schema: {},
  tagOptions: [],
  categoryOptions: [],
  rawMetadata: {},
  customNav: [],
  customMenu: [],
  allMembers: [],
  allEvents: [],
  postCount: 1,
  pageIds: [],
  latestPosts: []
})

export async function resolvePostProps({ prefix, slug, suffix, locale, from, password, revalidateReason }) {
  const segments = [prefix, slug].filter(Boolean)
  if (Array.isArray(suffix)) segments.push(...suffix)
  const fullSlug = segments.join('/')
  const lastSegment = segments.at(-1)
  const source = from || `slug-props-${fullSlug}`
  const allowPublicFallback = isExport() || revalidateReason === 'build'
  const taskId = `${fullSlug || lastSegment}-${Date.now()}`

  const startTime = Date.now()
  console.log(`[${taskId}] 🕒 开始解析文章: ${fullSlug || lastSegment} @ ${new Date().toISOString()}`)

  const step1Start = Date.now()
  const props = await fetchGlobalAllData({
    from: source,
    locale,
    includePasswordHashes: true,
    requireAvailableData: !allowPublicFallback,
    includeInnerLinkPages: true // <-- 新增参数开启内链支持
  })
  const step1End = Date.now()
  console.log(`[${taskId}] ⏱ fetchGlobalAllData 耗时: ${step1End - step1Start}ms @ ${new Date().toISOString()}`)

  const findPost = () => {
    if (!props?.allPages) return null
    return (
      props.allPages.find(p => p && !p.type?.includes('Menu') && p.slug === fullSlug) ||
      props.allPages.find(p => /^[a-f0-9-]{32,36}$/i.test(lastSegment) && normalizePostId(p.id) === normalizePostId(lastSegment)) ||
      props.allPages.find(p => p.id === fullSlug) ||
      null
    )
  }

  let post
  post = findPost()

  if (!post && typeof lastSegment === 'string' && /^[a-f0-9-]{32,36}$/i.test(lastSegment)) {
    const step3Start = Date.now()
    try {
      post = await fetchPageFromNotion(lastSegment, {
        throwOnUnavailable: !allowPublicFallback
      })
      if (post) {
        const { allowed, ancestor } = await resolveUuidPostAccess(post, props.allPages || [])
        if (!allowed) post = null
        else if (ancestor?.password) {
          post = { ...post, password: ancestor.password, accessSource: ancestor }
        }
      }
    } catch (error) {
      // An unresolved UUID's protection is unknown; never return its raw body.
      console.warn('[Post access] Unable to verify UUID page ancestry')
      if (!allowPublicFallback) throw error
      post = null
    }
    const step3End = Date.now()
    console.log(`[${taskId}] ⏱ fetchPageFromNotion 耗时: ${step3End - step3Start}ms @ ${new Date().toISOString()}`)
  }

  const ensureBlockMap = async (post) => {
    if (!post?.id) throw new Error('Article id is missing')
    const step4Start = Date.now()
    try {
      const rawBlockMap = deepClone(post.blockMap || await fetchNotionPageBlocks(post.id, source, {
        cacheVersion: post.lastEditedDate
      }))
      const adapted = adapterNotionBlockMap(rawBlockMap)
      post.blockMap = {
        ...adapted,
        block: formatNotionBlock(adapted.block)
      }
      const root = Object.entries(post.blockMap.block || {}).find(
        ([id]) => normalizePostId(id) === normalizePostId(post.id)
      )?.[1]?.value
      if (!root || root.alive === false) throw new Error('Article body is unavailable')
    } catch (e) {
      // ISR keeps the last successful page when regeneration throws.
      throw new Error(`Unable to load article body: ${post.id}`, { cause: e })
    }
    const step4End = Date.now()
    console.log(`[${taskId}] ⏱ ensureBlockMap 耗时: ${step4End - step4Start}ms @ ${new Date().toISOString()}`)
    return post
  }

  if (post) {
    if (post.password && (isExport() || !verifyPostPassword(post.accessSource || post, password))) {
      props.post = cleanPostSummary(post)
      if (isExport()) props.postUnlockUnavailable = true
      delete props.allPages
      return redactSiteData(props)
    }
    const isProtected = Boolean(post.password)
    let fallbackPost = cleanPostSummary(post)
    delete post.accessSource
    try {
      post = await ensureBlockMap(post)
      redactProtectedBlocks(post, props.allPages || [])
      // During builds, retain only a fully filtered snapshot if optional
      // post-processing fails. Never reuse its partially mutated input.
      if (allowPublicFallback && !isProtected) {
        fallbackPost = cleanPostForClient(deepClone(post))
      }
      props.post = post
      await processPostData(props, source)
      props.post = cleanPostForClient(props.post)
    } catch (error) {
      // Protected requests fail closed; ISR keeps the last successful version.
      if (isProtected || !allowPublicFallback) throw error
      console.warn('[Post access] Article processing failed; rendering safe build fallback')
      props.post = fallbackPost
    }
    // ========== 修改 C:Markdown 正文(只在有内容且文章未加密时生效) ==========
    if (!isProtected && props.post?.id) {
      try {
        const md = (await getMarkdownBodyMap()).get(normalizePostId(props.post.id))
        if (md) {
          props.post.markdownHtml = renderMarkdownBody(md)
          // 目录由 Notion 原正文生成,Markdown 正文暂不生成目录,避免显示过期目录
          props.post.toc = []
          const words = Array.from(md.replace(/\s+/g, '')).length
          props.post.wordCount = words
          props.post.readTime = Math.floor(words / 400) + 1
        }
      } catch (e) {
        console.error('[请求失败] Markdown 渲染失败:', e?.message)
      }
      // 原始 Markdown 不下发到浏览器,只下发渲染后的 HTML,避免页面数据翻倍
      delete props.post.MarkdownBody
    }
    // ========== 修改 C 结束 ==========
    if (props.post.password) props.post.password = 'protected'
    props.prev = cleanPostSummary(props.prev)
    props.next = cleanPostSummary(props.next)
    props.recommendPosts = cleanPostSummaries(props.recommendPosts)
  } else {
    props.post = null
  }

  props.latestPosts = cleanPostSummaries(props.latestPosts)
  delete props.allPages
  const endTime = Date.now()
  console.log(`[${taskId}] ✅ 完成解析文章: ${fullSlug || lastSegment}, 总耗时: ${endTime - startTime}ms @ ${new Date().toISOString()}`)

  return redactSiteData(props)
}

async function convertNotionToSiteData(
  SITE_DATABASE_PAGE_ID,
  from,
  pageRecordMap
) {
  const traceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const overallStart = Date.now()
  console.log(`[${traceId}] 🕒 开始 convertNotionToSiteData from: ${from} @ ${new Date().toISOString()}`)

  if (!pageRecordMap) {
    console.error(`[${traceId}] can't get Notion Data ; pageId:`, SITE_DATABASE_PAGE_ID)
    return {}
  }

  SITE_DATABASE_PAGE_ID = idToUuid(SITE_DATABASE_PAGE_ID)

  const stepStart2 = Date.now()
  let block = adapterNotionBlockMap({ block: pageRecordMap.block || {} }).block
  const stepEnd2 = Date.now()
  console.log(`[${traceId}] ⏱ adapterNotionBlockMap 耗时: ${stepEnd2 - stepStart2}ms @ ${new Date().toISOString()}`)

  const rawMetadata = normalizeNotionMetadata(block, SITE_DATABASE_PAGE_ID)

  if (rawMetadata?.type !== 'collection_view_page' && rawMetadata?.type !== 'collection_view') {
    console.error(`[${traceId}] pageId "${SITE_DATABASE_PAGE_ID}" is not a database`)
    return EmptyData(SITE_DATABASE_PAGE_ID)
  }

  const stepStart4 = Date.now()
  const collectionMap = pageRecordMap.collection || {}
  const inferredCollectionId =
    Object.keys(collectionMap).length === 1 ? Object.keys(collectionMap)[0] : null
  const collectionId = rawMetadata?.collection_id || inferredCollectionId
  const rawCollection =
    collectionMap?.[collectionId] ||
    collectionMap?.[idToUuid(collectionId)] ||
    {}
  const collection = normalizeCollection(rawCollection)
  const collectionQuery = pageRecordMap.collection_query
  const collectionView = pageRecordMap.collection_view
  const schema = normalizeSchema(collection?.schema || {})
  const viewIds = rawMetadata?.view_ids
  const collectionData = []
  const stepEnd4 = Date.now()
  console.log(`[${traceId}] ⏱ Collection 初始化耗时: ${stepEnd4 - stepStart4}ms @ ${new Date().toISOString()}`)

  // ========== 修改 A 开始 ==========
  let pageIds = getAllPageIds(collectionQuery, collectionId, collectionView, viewIds, block)

  // 补充:notion-client 每个视图最多只读 999 行,达到上限说明有行被截断,
  // 此时用官方 API 取回完整的页面 ID 列表并合并(后续补读与解析仍走原有流程)
  if (pageIds.length >= 999) {
    const officialIds = await fetchAllPageIdsOfficial(SITE_DATABASE_PAGE_ID)
    if (officialIds.length > 0) {
      const known = new Set(pageIds)
      const extraIds = officialIds.filter(id => !known.has(id))
      console.log(`[${traceId}] 已达 999 行读取上限,官方 API 补充了 ${extraIds.length} 条页面 ID`)
      pageIds = [...pageIds, ...extraIds]
    }
  }
  // ========== 修改 A 结束 ==========

  const blockIdsNeedFetch = pageIds.filter(id => !normalizePageBlock(block[id]))

  const stepStart7 = Date.now()
  if (blockIdsNeedFetch.length > 0) {
    const fetchedBlocks = await fetchInBatches(blockIdsNeedFetch)
    const adaptedFetchedBlocks = adapterNotionBlockMap({ block: fetchedBlocks }).block
    block = { ...block, ...adaptedFetchedBlocks }
  }
  const stepEnd7 = Date.now()
  console.log(`[${traceId}] ⏱ fetchInBatches + adapter 耗时: ${stepEnd7 - stepStart7}ms @ ${new Date().toISOString()}`)

  const stepStart8 = Date.now()
  for (const id of pageIds) {
    const pageBlock = normalizePageBlock(block[id])
    if (!pageBlock) continue
    if (pageBlock.parent_id !== collectionId) continue
    const properties = (await getPageProperties(id, pageBlock, schema, null, getTagOptions(schema))) || null
    if (properties) collectionData.push(properties)
  }
  const stepEnd8 = Date.now()
  console.log(`[${traceId}] ⏱ collectionData 构建耗时: ${stepEnd8 - stepStart8}ms @ ${new Date().toISOString()}`)

  const stepStart9 = Date.now()
  const NOTION_CONFIG = (await getConfigMapFromConfigPage(collectionData)) || {}
  if (process.env.NODE_ENV === 'development') {
    console.log(
      '[ThemeResolver][notion-config]',
      JSON.stringify({
        from,
        pageId: SITE_DATABASE_PAGE_ID,
        notionTheme: NOTION_CONFIG?.THEME || null,
        configTheme: BLOG.THEME,
        note: 'If notionTheme exists, it will override configTheme unless URL ?theme is provided.'
      })
    )
  }
  const sourcePageSlugs = getSourcePageSlugs(collectionData)
  collectionData.forEach(element => adjustPageProperties(element, NOTION_CONFIG))

  const officialMembers = await fetchMembersFromOfficialAPI({
    typeProperty: BLOG.NOTION_PROPERTY_NAME.type,
    statusProperty: BLOG.NOTION_PROPERTY_NAME.status,
    typeValue: BLOG.NOTION_PROPERTY_NAME.type_member,
    statusValue: BLOG.NOTION_PROPERTY_NAME.status_publish
  })
  if (officialMembers.length > 0) {
    const existingMembers = new Set(
      collectionData
        .filter(item => item?.type === 'Member')
        .flatMap(item => [item.id, item.slug].filter(Boolean))
    )
    officialMembers.forEach(member => {
      if (!existingMembers.has(member.id) && !existingMembers.has(member.slug)) {
        collectionData.push(member)
      }
    })
  }

  const siteInfo = getSiteInfo({ collection, block, rawMetadata, NOTION_CONFIG })
  writePwaManifest({ siteInfo, notionConfig: NOTION_CONFIG })
  const stepEnd9 = Date.now()
  console.log(`[${traceId}] ⏱ 配置站点信息耗时: ${stepEnd9 - stepStart9}ms @ ${new Date().toISOString()}`)

  let postCount = 0
  let allPages = collectionData.filter(post => {
    if (post?.type === 'Post' && post.status === 'Published') postCount++
    return post?.slug && (post?.status === 'Invisible' || post?.status === 'Published')
  })
  const sortBy = siteConfig('POSTS_SORT_BY', null, NOTION_CONFIG)
  if (sortBy === 'date') {
    allPages.sort((a, b) => (b?.publishDate ?? 0) - (a?.publishDate ?? 0))
  }

  const topTag = siteConfig('TOP_TAG', '', NOTION_CONFIG)
  if (topTag) {
    allPages = sortPinnedPostsByLatestUpdate(allPages, topTag)
  }

  const stepStart11 = Date.now()
  const notice = await getNotice(collectionData.find(post => post?.type === 'Notice' && post.status === 'Published'))
  const categoryOptions = getAllCategories({ allPages, categoryOptions: getCategoryOptions(schema) })
  const tagSchemaOptions = getTagOptions(schema)
  const tagOptions = getAllTags({ allPages, tagOptions: tagSchemaOptions ?? [], NOTION_CONFIG }) ?? null
  const customNav = getCustomNav({ allPages: collectionData.filter(post => post?.type === 'Page' && post.status === 'Published') })
  const customMenu = getCustomMenu({ collectionData, sourcePageSlugs })
  const latestPosts = getLatestPosts({
    allPages,
    from,
    latestPostCount: siteConfig('LATEST_POST_COUNT', 6, NOTION_CONFIG)
  })
  const allNavPages = getNavPages({ allPages })
  const allLinkPages = getLinkPages({ allPages })

  const allMembers = getAllMembers({ allPages })
  const allEvents = getAllEvents({ allPages })

  const stepEnd11 = Date.now()
  console.log(`[${traceId}] ⏱ 其他数据生成耗时: ${stepEnd11 - stepStart11}ms @ ${new Date().toISOString()}`)
  const overallEnd = Date.now()
  console.log(`[${traceId}] ✅ convertNotionToSiteData 完成，总耗时: ${overallEnd - overallStart}ms @ ${new Date().toISOString()}`)

  return {
    NOTION_CONFIG,
    notice,
    siteInfo,
    allPages,
    allMembers,
    allEvents,
    allNavPages,
    allLinkPages,
    collection,
    collectionQuery,
    collectionId,
    collectionView,
    viewIds,
    block,
    schema,
    tagOptions,
    categoryOptions,
    rawMetadata,
    customNav,
    customMenu,
    postCount,
    pageIds,
    latestPosts
  }
}

function handleDataBeforeReturn(db) {
  delete db.block
  delete db.schema
  delete db.rawMetadata
  delete db.pageIds
  delete db.viewIds
  delete db.collection
  delete db.collectionQuery
  delete db.collectionId
  delete db.collectionView

  if (db?.notice) {
    db.notice = cleanNoticeForClient(db?.notice)
    if (db.notice?.blockMap) redactProtectedBlocks(db.notice, db.allPages || [])
  }

  db.categoryOptions = cleanIds(db?.categoryOptions)
  db.customMenu = cleanIds(db?.customMenu)
  db.allNavPages = shortenIds(db?.allNavPages)
  db.allLinkPages = shortenIds(db?.allLinkPages)

  db.tagOptions = cleanTagOptions(db?.tagOptions)
  db.allNavPages = cleanPages(db?.allNavPages, db.tagOptions)
  db.allLinkPages = cleanPages(db?.allLinkPages, db.tagOptions)
  db.allPages = cleanPages(db.allPages, db.tagOptions)
  db.allMembers = cleanPages(db.allMembers, db.tagOptions)
  db.allEvents = cleanPages(db.allEvents, db.tagOptions)
  db.latestPosts = cleanPostSummaries(cleanPages(db.latestPosts, db.tagOptions))

  const POST_SCHEDULE_PUBLISH = siteConfig(
    'POST_SCHEDULE_PUBLISH',
    null,
    db.NOTION_CONFIG
  )
  if (POST_SCHEDULE_PUBLISH) {
    db.allPages?.forEach(p => {
      if (p.type === 'Event' || p.type === 'Member') return
      if (!isInRange(p.title, p.date)) {
        console.log('[定时发布] 隐藏-->', p.title, p.date)
        p.status = 'Invisible'
      }
    })
  }

  return db
}

function cleanPages(allPages, tagOptions) {
  if (!Array.isArray(allPages) || !Array.isArray(tagOptions)) {
    console.warn('Invalid input: allPages and tagOptions should be arrays.')
    return allPages || []
  }
  const validTags = new Set(
    tagOptions
      .map(tag => (typeof tag.name === 'string' ? tag.name : null))
      .filter(Boolean)
  )
  allPages.forEach(page => {
    if (Array.isArray(page.tagItems)) {
      page.tagItems = page.tagItems.filter(
        tagItem => validTags.has(tagItem?.name) && typeof tagItem.name === 'string'
      )
    }
  })
  return allPages
}

function shortenIds(items) {
  if (items && Array.isArray(items)) {
    return items.map(item => {
      const { id, ...rest } = item
      return {
        ...rest,
        short_id: getShortId(id)
      }
    })
  }
  return items
}

function cleanIds(items) {
  if (items && Array.isArray(items)) {
    return items.map(({ id, ...rest }) => rest)
  }
  return items
}

function cleanTagOptions(tagOptions) {
  if (tagOptions && Array.isArray(tagOptions)) {
    return tagOptions
      .filter(tagOption => tagOption.source === 'Published')
      .map(({ id, source, ...rest }) => rest)
  }
  return tagOptions
}

function cleanBlock(item) {
  const post = deepClone(item)
  const pageBlock = post?.blockMap?.block
  if (pageBlock) {
    for (const i in pageBlock) {
      pageBlock[i] = cleanBlock(pageBlock[i])
      delete pageBlock[i]?.role
      delete pageBlock[i]?.value?.version
      delete pageBlock[i]?.value?.created_by_table
      delete pageBlock[i]?.value?.created_by_id
      delete pageBlock[i]?.value?.last_edited_by_table
      delete pageBlock[i]?.value?.last_edited_by_id
      delete pageBlock[i]?.value?.space_id
      delete pageBlock[i]?.value?.format?.copied_from_pointer
      delete pageBlock[i]?.value?.format?.block_locked_by
      delete pageBlock[i]?.value?.parent_table
      delete pageBlock[i]?.value?.copied_from_pointer
      delete pageBlock[i]?.value?.copied_from
      delete pageBlock[i]?.value?.permissions
      delete pageBlock[i]?.value?.alive
    }
  }
  return post
}

function getLatestPosts({ allPages, from, latestPostCount }) {
  const allPosts = allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )
  return [...(allPosts ?? [])]
    .sort((a, b) => {
      const dateA = new Date(a?.lastEditedDate || a?.publishDate)
      const dateB = new Date(b?.lastEditedDate || b?.publishDate)
      return dateB - dateA
    })
    .slice(0, latestPostCount)
}

function getCustomNav({ allPages }) {
  const customNav = []
  if (allPages && allPages.length > 0) {
    allPages.forEach(p => {
      p.to = p.slug
      customNav.push({
        icon: p.icon || null,
        name: p.title || p.name || '',
        href: p.href,
        target: p.target,
        show: true
      })
    })
  }
  return customNav
}

function getTagOptions(schema) {
  if (!schema) return {}
  const tagSchema = Object.values(schema).find(
    e => e.name === BLOG.NOTION_PROPERTY_NAME.tags
  )
  return tagSchema?.options || []
}

function getCategoryOptions(schema) {
  if (!schema) return {}
  const categorySchema = Object.values(schema).find(
    e => e.name === BLOG.NOTION_PROPERTY_NAME.category
  )
  return categorySchema?.options || []
}

function getSiteInfo({ collection, block, rawMetadata, NOTION_CONFIG }) {
  const defaultTitle = NOTION_CONFIG?.TITLE || 'NotionNext BLOG'
  const defaultDescription =
    NOTION_CONFIG?.DESCRIPTION || '这是一个由NotionNext生成的站点'
  const defaultPageCover = NOTION_CONFIG?.HOME_BANNER_IMAGE || '/bg_image.jpg'
  const defaultIcon = NOTION_CONFIG?.AVATAR || '/avatar.svg'
  const defaultLink = NOTION_CONFIG?.LINK || BLOG.LINK

  if (!collection && !block) {
    return {
      title: defaultTitle,
      description: defaultDescription,
      pageCover: defaultPageCover,
      icon: defaultIcon,
      link: defaultLink
    }
  }

  const title = collection?.name?.[0][0] || defaultTitle
  const description = collection?.description
    ? Object.assign(collection).description[0][0]
    : defaultDescription
  const pageCover = collection?.cover
    ? mapImgUrl(collection?.cover, collection, 'collection')
    : rawMetadata?.format?.page_cover
      ? mapImgUrl(rawMetadata?.format?.page_cover, rawMetadata, 'block')
      : defaultPageCover

  let icon = compressImage(
    collection?.icon
      ? mapImgUrl(collection?.icon, collection, 'collection')
      : defaultIcon
  )
  const link = NOTION_CONFIG?.LINK || defaultLink
  const emojiPattern = /\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/g
  if (!icon || emojiPattern.test(icon)) icon = defaultIcon

  return { title, description, pageCover, icon, link }
}

function isInRange(title, date = {}) {
  const {
    start_date,
    start_time = '00:00',
    end_date,
    end_time = '23:59',
    time_zone = 'Asia/Shanghai'
  } = date

  const currentTimestamp = Date.now()
  const startTimestamp = getTimestamp(start_date, start_time, time_zone)
  const endTimestamp = getTimestamp(end_date, end_time, time_zone)

  if (startTimestamp && currentTimestamp < startTimestamp) return false
  if (endTimestamp && currentTimestamp > endTimestamp) return false
  return true
}

function convertToUTC(dateStr, timeZone = 'Asia/Shanghai') {
  const timeZoneOffsets = {
    UTC: 0, 'Etc/GMT': 0, 'Etc/GMT+0': 0,
    'Asia/Shanghai': 8, 'Asia/Taipei': 8, 'Asia/Tokyo': 9, 'Asia/Seoul': 9,
    'Asia/Kolkata': 5.5, 'Asia/Jakarta': 7, 'Asia/Singapore': 8,
    'Asia/Hong_Kong': 8, 'Asia/Bangkok': 7, 'Asia/Dubai': 4,
    'Asia/Tehran': 3.5, 'Asia/Riyadh': 3,
    'Europe/London': 0, 'Europe/Paris': 1, 'Europe/Berlin': 1,
    'Europe/Moscow': 3, 'Europe/Amsterdam': 1,
    'America/New_York': -5, 'America/Chicago': -6, 'America/Denver': -7,
    'America/Los_Angeles': -8, 'America/Sao_Paulo': -3,
    'America/Argentina/Buenos_Aires': -3,
    'Africa/Johannesburg': 2, 'Africa/Cairo': 2, 'Africa/Nairobi': 3,
    'Australia/Sydney': 10, 'Australia/Perth': 8,
    'Pacific/Auckland': 13, 'Pacific/Fiji': 12,
    'Antarctica/Palmer': -3, 'Antarctica/McMurdo': 13
  }
  const continentDefaults = {
    Asia: 'Asia/Shanghai', Europe: 'Europe/London', America: 'America/New_York',
    Africa: 'Africa/Cairo', Australia: 'Australia/Sydney',
    Pacific: 'Pacific/Auckland', Antarctica: 'Antarctica/Palmer', UTC: 'UTC'
  }

  let offsetHours = timeZoneOffsets[timeZone]
  if (offsetHours === undefined) {
    const continent = timeZone.split('/')[0]
    const fallbackZone = continentDefaults[continent] || 'UTC'
    offsetHours = timeZoneOffsets[fallbackZone]
    console.warn(
      `Warning: Unsupported time zone "${timeZone}". Using default "${fallbackZone}".`
    )
  }

  const localDate = new Date(`${dateStr.replace(' ', 'T')}Z`)
  if (isNaN(localDate.getTime())) {
    throw new Error(`Invalid date string: ${dateStr}`)
  }
  return new Date(localDate.getTime() - offsetHours * 3600 * 1000)
}

function getTimestamp(date, time = '00:00', time_zone) {
  if (!date) return null
  return convertToUTC(`${date} ${time}:00`, time_zone).getTime()
}

export function getNavPages({ allPages }) {
  const allNavPages = allPages?.filter(
    post =>
      post &&
      post?.slug &&
      post?.type === 'Post' &&
      post?.status === 'Published'
  )
  return allNavPages.map(item => ({
    id: item.id,
    title: item.title || '',
    pageCoverThumbnail: item.pageCoverThumbnail || '',
    category: item.category || null,
    tags: item.tags || null,
    summary: item.summary || null,
    slug: item.slug,
    href: item.href,
    pageIcon: item.pageIcon || '',
    lastEditedDate: item.lastEditedDate,
    publishDate: item.publishDate,
    ext: item.ext || {}
  }))
}

export function getLinkPages({ allPages }) {
  const allLinkPages = (allPages || []).filter(
    post =>
      post &&
      post?.slug &&
      (post?.type === 'Post' || post?.type === 'Page') &&
      post?.status === 'Published'
  )
  return allLinkPages.map(item => ({
    id: item.id,
    title: item.title || '',
    type: item.type,
    slug: item.slug,
    href: item.href,
    short_id: item.short_id
  }))
}

export function getAllMembers({ allPages }) {
  const published = getPublishedTypedPages({ allPages, type: 'Member' })

  const slim = published.map(m => ({
    id: m.id || '',
    title: m.title || '',
    type: m.type || 'Member',
    status: m.status || 'Published',
    slug: m.slug || '',
    summary: m.summary || '',
    avatar: m.avatar || '',
    quote: m.quote || '',
    role: m.role || '',
    bio: m.bio || '',
    featured: m.featured || '',
    verified: m.verified || '',
    sortOrder: m.sortOrder ?? null,
    joinedAtText: m.joinedAtText || '',
    pageIcon: m.pageIcon || '',
    pageCoverThumbnail: m.pageCoverThumbnail || '',
    pageCover: m.pageCover || '',
    publishDate: m.publishDate ?? null
  }))

  return slim.sort((a, b) => {
    const aFeatured = Boolean(a.featured)
    const bFeatured = Boolean(b.featured)
    if (aFeatured !== bFeatured) return bFeatured ? 1 : -1
    const aVerified = Boolean(a.verified)
    const bVerified = Boolean(b.verified)
    if (aVerified !== bVerified) return bVerified ? 1 : -1
    if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder
    return (b?.publishDate ?? 0) - (a?.publishDate ?? 0)
  })
}

export function getAllEvents({ allPages }) {
  return sortTypedPagesByPublishDate(
    getPublishedTypedPages({ allPages, type: 'Event' })
  )
}

// ========== 修改 B 开始：在文件末尾添加以下函数 ==========
/**
 * 补充读取:notion-client 每个视图最多只读取 999 行,超出的行(通常是最旧的)会丢失。
 * 这里用 Notion 官方 API(每次 100 条、游标翻页)取回数据库全部页面 ID,只取 ID,
 * 其余内容仍走原有流程。需要环境变量 NOTION_API_TOKEN(只读权限的 Integration,且已连接到该数据库)。
 */
async function fetchAllPageIdsOfficial(databaseId) {
  const token = process.env.NOTION_API_TOKEN
  if (!token || !databaseId) {
    console.warn('[fetchAllPageIdsOfficial] 未设置 NOTION_API_TOKEN,无法突破 999 行上限')
    return []
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  const call = async (url, version, body) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': version
        },
        body: body ? JSON.stringify(body) : undefined
      })
      if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after') || 2)
        await sleep((wait + 1) * 1000)
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`)
      return res.json()
    }
    throw new Error('Notion 持续限流')
  }

  const queryAll = async (url, version) => {
    const ids = []
    let cursor
    do {
      const data = await call(url, version, {
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {})
      })
      for (const r of data.results || []) {
        if (r?.object === 'page' && r.id) ids.push(r.id)
      }
      if (data.request_status) {
        console.warn('[fetchAllPageIdsOfficial] 查询结果可能不完整:', JSON.stringify(data.request_status))
      }
      cursor = data.has_more ? data.next_cursor : undefined
      if (cursor) await sleep(350)
    } while (cursor)
    return ids
  }

  try {
    return await queryAll(`https://api.notion.com/v1/databases/${databaseId}/query`, '2022-06-28')
  } catch (e) {
    console.warn('[fetchAllPageIdsOfficial] 旧版 databases 查询失败,改试 data_sources:', e?.message)
  }
  try {
    const db = await call(`https://api.notion.com/v1/databases/${databaseId}`, '2025-09-03')
    const dsId = db?.data_sources?.[0]?.id
    if (!dsId) return []
    return await queryAll(`https://api.notion.com/v1/data_sources/${dsId}/query`, '2025-09-03')
  } catch (e) {
    console.error('[fetchAllPageIdsOfficial] 官方 API 读取失败:', e?.message)
    return []
  }
}
// ========== 修改 B 结束 ==========

// ========== 修改 C 开始:Markdown 正文 ==========
// 原理:构建时用官方 API 一次性查出所有「MarkdownBody 不为空」的文章(通常只有几篇),
// 在 resolvePostProps 里按文章 ID 取用并转成 HTML。没有 Markdown 的文章完全不受影响。
// 读取失败会打印「[请求失败]」,触发你工作流里现有的「拒绝部署并自动续跑」保险丝,
// 避免出现“Markdown 文章悄悄退回旧正文”的事故。
let mdMapPromise = null
let mdMapAt = 0

function getMarkdownBodyMap() {
  const ttl = isExport() ? Infinity : 60 * 1000
  if (!mdMapPromise || Date.now() - mdMapAt > ttl) {
    mdMapAt = Date.now()
    const first = String(BLOG.NOTION_PAGE_ID || '').split(',')[0]
    mdMapPromise = fetchMarkdownBodiesOfficial(idToUuid(extractLangId(first)))
  }
  return mdMapPromise
}

async function fetchMarkdownBodiesOfficial(databaseId) {
  const map = new Map()
  const token = process.env.NOTION_API_TOKEN
  if (!token || !databaseId) {
    const msg = 'MarkdownBody 无法读取:缺少 NOTION_API_TOKEN 或数据库 ID'
    if (isExport()) console.error('[请求失败] ' + msg)
    else console.warn(msg)
    return map
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  let cursor
  try {
    do {
      let data
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(
          `https://api.notion.com/v1/databases/${databaseId}/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
              page_size: 100,
              filter: { property: 'MarkdownBody', rich_text: { is_not_empty: true } },
              ...(cursor ? { start_cursor: cursor } : {})
            })
          }
        )
        if (res.status === 429) {
          await sleep((Number(res.headers.get('retry-after') || 2) + 1) * 1000)
          continue
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
        data = await res.json()
        break
      }
      if (!data) throw new Error('Notion 持续限流')
      for (const page of data.results || []) {
        const md = (page.properties?.MarkdownBody?.rich_text || [])
          .map(x => x.plain_text)
          .join('')
        if (md.trim()) map.set(normalizePostId(page.id), md)
      }
      cursor = data.has_more ? data.next_cursor : undefined
      if (cursor) await sleep(350)
    } while (cursor)
  } catch (e) {
    console.error('[请求失败] MarkdownBody 读取失败:', e?.message)
  }
  return map
}

// 与后台编辑器的预览保持一致:标准 Markdown + GFM,单个换行不当作硬换行
function renderMarkdownBody(md) {
  let html = marked.parse(md, { gfm: true, breaks: false })
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a target="_blank" rel="noopener noreferrer" href="$1"')
  html = html.replace(/<img /g, '<img loading="lazy" decoding="async" ')
  return html
}
// ========== 修改 C 结束 ==========
