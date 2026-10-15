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
  params: { category: categoryParam, page },
  locale
}) {
  const from = 'category-page-props'
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
        destination: `/category/${encodeURIComponent(
          canonicalSlug
        )}/page/${page}`,
        permanent: true
      }
    }
  }

  // 过滤状态类型
  props.posts = props.allPages
    ?.filter(page => page.type === 'Post' && page.status === 'Published')
    .filter(post => post && post.category && post.category.includes(category))

  // ⭐ 新增：分类页面按时间由新到旧排序（只作用于当前页面的 props.posts）
  props.posts.sort((a, b) => {
    const dateA = new Date(a.date?.start_date || a.date || 0).getTime()
    const dateB = new Date(b.date?.start_date || b.date || 0).getTime()
    return dateB - dateA // 降序：最新的在最前面
  })

  // 处理文章页数
  props.postCount = props.posts.length
  const POSTS_PER_PAGE = siteConfig('POSTS_PER_PAGE', 12, props?.NOTION_CONFIG)
  
  // 处理分页
  props.posts = props.posts.slice(
    POSTS_PER_PAGE * (page - 1),
    POSTS_PER_PAGE * page
  )

  delete props.allPages
  props.page = page

  props = { ...props, category, page }

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
  const { categoryOptions, allPages, NOTION_CONFIG } = await fetchGlobalAllData({
    from
  })
  const paths = []

  categoryOptions?.forEach(category => {
    // 过滤状态类型
    const categoryPosts = allPages
      ?.filter(page => page.type === 'Post' && page.status === 'Published')
      .filter(
        post => post && post.category && post.category.includes(category.name)
      )
    // 处理文章页数
    const postCount = categoryPosts.length
    const totalPages = Math.ceil(
      postCount / siteConfig('POSTS_PER_PAGE', null, NOTION_CONFIG)
    )
    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        paths.push({
          params: {
            category: getCategorySlug(category.name, NOTION_CONFIG),
            page: '' + i
          }
        })
      }
    }
  })

  return {
    paths,
    fallback: true
  }
}
