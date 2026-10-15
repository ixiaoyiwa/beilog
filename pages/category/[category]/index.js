import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { DynamicLayout } from '@/themes/theme'
import {
  getCategoryNameFromSlug,
  getCategorySlug
} from '@/lib/utils/category'

/**
 * 分类页
 * @param {*} props
 * @returns
 */
export default function Category(props) {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutPostList' {...props} />
}

export async function getStaticProps({
  params: { category: categoryParam },
  locale
}) {
  const from = 'category-props'
  let props = await fetchGlobalAllData({ from, locale })

  const category = getCategoryNameFromSlug(
    categoryParam,
    props.NOTION_CONFIG
  )

  const canonicalSlug = getCategorySlug(category, props.NOTION_CONFIG)
  const incomingSlug = decodeURIComponent(String(categoryParam || ''))

  if (incomingSlug !== canonicalSlug) {
    return {
      redirect: {
        destination: `/category/${encodeURIComponent(canonicalSlug)}`,
        permanent: true
      }
    }
  }

  // 过滤状态
  props.posts = props.allPages?.filter(
    page => page.type === 'Post' && page.status === 'Published'
  )
  // 处理过滤
  props.posts = props.posts.filter(
    post => post && post.category && post.category.includes(category)
  )

  // ⭐ 新增：分类页面按时间由新到旧排序（只作用于当前页面的 props.posts）
  props.posts.sort((a, b) => {
    const dateA = new Date(a.date?.start_date || a.date || 0).getTime()
    const dateB = new Date(b.date?.start_date || b.date || 0).getTime()
    return dateB - dateA // 降序：最新的在最前面
  })

  // 处理文章页数
  props.postCount = props.posts.length
  
  // 处理分页
  const POST_LIST_STYLE = siteConfig(
    'POST_LIST_STYLE',
    'page',
    props?.NOTION_CONFIG
  )
  if (POST_LIST_STYLE === 'scroll') {
    // 滚动列表 给前端返回所有数据
  } else if (POST_LIST_STYLE === 'page') {
    props.posts = props.posts?.slice(
      0,
      siteConfig('POSTS_PER_PAGE', 12, props?.NOTION_CONFIG)
    )
  }

  delete props.allPages

  props = { ...props, category }

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

export async function getStaticPaths() {
  const from = 'category-paths'
  const { categoryOptions, NOTION_CONFIG } = await fetchGlobalAllData({ from })
  const categories = Array.isArray(categoryOptions) ? categoryOptions : []
  return {
    paths: categories.map(category => ({
      params: { category: getCategorySlug(category?.name, NOTION_CONFIG) }
    })),
    fallback: true
  }
}
