import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { DynamicLayout } from '@/themes/theme'
import {
  EPISODES_PER_PAGE,
  sortEpisodes,
  groupEpisodesByMonth
} from '@/lib/utils/episodes'

const EpisodesPage = props => {
  const theme = siteConfig('THEME', BLOG.THEME, props.NOTION_CONFIG)
  return <DynamicLayout theme={theme} layoutName='LayoutEpisodes' {...props} />
}

export async function getStaticPaths({ locale }) {
  const from = 'episodes-page-paths'
  const { postCount } = await fetchGlobalAllData({ from, locale })
  const totalPages = Math.ceil(postCount / EPISODES_PER_PAGE)
  return {
    // 移除第一页，因为第一页是 /episodes
    paths: Array.from({ length: totalPages - 1 }, (_, i) => ({
      params: { page: '' + (i + 2) }
    })),
    fallback: true
  }
}

export async function getStaticProps({ params: { page }, locale }) {
  const from = `episodes-page-${page}`
  const props = await fetchGlobalAllData({ from, locale })

  // 找到 Notion Pages 里的 episodes 页面（与首页保持一致，用于 Hero 标题）
  const episodePage = props.allPages?.find(
    p =>
      p.type === 'Page' &&
      (p.slug === 'episodes' || p.id === 'episodes')
  )
  if (episodePage) {
    props.post = episodePage
  }

  const allPosts =
    props.allPages?.filter(
      p => p.type === 'Post' && p.status === 'Published'
    ) || []

  const sortedPosts = sortEpisodes(allPosts)
  const start = EPISODES_PER_PAGE * (page - 1)
  const end = EPISODES_PER_PAGE * page
  const pagePosts = sortedPosts.slice(start, end)

  props.posts = pagePosts
  props.page = parseInt(page, 10)
  props.episodesTotalPages = Math.ceil(sortedPosts.length / EPISODES_PER_PAGE)
  props.archivePosts = groupEpisodesByMonth(pagePosts)

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

export default EpisodesPage
