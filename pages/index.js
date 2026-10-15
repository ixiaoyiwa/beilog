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

/**
 * 首页布局
 * @param {*} props
 * @returns
 */
const Index = props => {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutIndex' {...props} />
}

/**
 * SSG 获取数据
 * @returns
 */
export async function getStaticProps(req) {
  const { locale } = req
  const from = 'index'
  const props = await fetchGlobalAllData({ from, locale })
  
  const POST_PREVIEW_LINES = siteConfig(
    'POST_PREVIEW_LINES',
    8,
    props?.NOTION_CONFIG
  )
  const POST_PREVIEW_MAX_COUNT = siteConfig(
    'POST_PREVIEW_MAX_COUNT',
    4,
    props?.NOTION_CONFIG
  )
  const POST_LIST_PREVIEW = siteConfig(
    'POST_LIST_PREVIEW',
    false,
    props?.NOTION_CONFIG
  )
  props.posts = props.allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )

  // 处理分页
  const POST_LIST_STYLE = siteConfig(
    'POST_LIST_STYLE',
    'page',
    props?.NOTION_CONFIG
  )
  if (POST_LIST_STYLE === 'scroll') {
    // 滚动列表默认给前端返回所有数据
  } else if (POST_LIST_STYLE === 'page') {
    // ⭐ 核心修改：首页坚决不要在这里截断！
    // 将完整的文章列表传递给前端，由前端 LayoutPostList 负责捞取置顶、精选并排序后截取。
    // props.posts = props.posts?.slice(
    //   0,
    //   siteConfig('POSTS_PER_PAGE', 12, props?.NOTION_CONFIG)
    // )
  }

  // 预览文章内容
  if (POST_LIST_PREVIEW) {
    const previewLimit = pLimit(
      siteConfig('POST_PREVIEW_CONCURRENCY', 5, props?.NOTION_CONFIG)
    )
    const previewTargets = props.posts.filter(
      post => !post.password || post.password === ''
    ).slice(0, POST_PREVIEW_MAX_COUNT)
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
  const isBuildLifecycle = ['build', 'export'].includes(
    process.env.npm_lifecycle_event
  )
  if (isBuildLifecycle) {
    // 生成robotTxt
    generateRobotsTxt(props)
    // 生成Feed订阅
    if (shouldGenerateRssForLocale({ locale })) {
      await generateRss(props)
    }
    // 生成
    generateSitemapXml(props)
    // 检查数据是否需要从algolia删除
    await checkDataFromAlgolia(props)
    if (siteConfig('UUID_REDIRECT', false, props?.NOTION_CONFIG)) {
      // 生成重定向 JSON
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
      : siteConfig(
          'NEXT_REVALIDATE_SECOND',
          BLOG.NEXT_REVALIDATE_SECOND,
          props.NOTION_CONFIG
        )
  }
}

export default Index
