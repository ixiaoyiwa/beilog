import BLOG from '@/blog.config'
import { siteConfig } from '@/lib/config'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'
import { DynamicLayout } from '@/themes/theme'
import {
  EPISODES_PER_PAGE,
  sortEpisodes,
  groupEpisodesByMonth
} from '@/lib/utils/episodes'


const EpisodesIndex = props => {
  const theme = siteConfig(
    'THEME',
    BLOG.THEME,
    props.NOTION_CONFIG
  )

  return (
    <DynamicLayout
      theme={theme}
      layoutName='LayoutEpisodes'
      {...props}
    />
  )
}


export async function getStaticProps({ locale }) {

  const props = await fetchGlobalAllData({
    from: 'episodes-index',
    locale
  })


  // 找到 Notion Pages 里的 episodes 页面
  const episodePage = props.allPages?.find(
    page =>
      page.type === 'Page' &&
      (
        page.slug === 'episodes' ||
        page.id === 'episodes'
      )
  )


  // 给 Layout / Hero 使用
  if (episodePage) {
    props.post = episodePage
    props.page = episodePage
  }


  // 只取节目 Post
  const allPosts =
    props.allPages?.filter(
      page =>
        page.type === 'Post' &&
        page.status === 'Published'
    ) || []


  const sortedPosts = sortEpisodes(allPosts)

  const pagePosts = sortedPosts.slice(
    0,
    EPISODES_PER_PAGE
  )


  props.posts = pagePosts

  props.currentPage = 1

  props.episodesTotalPages =
    Math.ceil(
      sortedPosts.length / EPISODES_PER_PAGE
    )


  props.archivePosts =
    groupEpisodesByMonth(pagePosts)


  delete props.allPages


  return {
    props,

    revalidate:
      process.env.EXPORT
        ? undefined
        : siteConfig(
            'NEXT_REVALIDATE_SECOND',
            BLOG.NEXT_REVALIDATE_SECOND,
            props.NOTION_CONFIG
          )
  }
}


export default EpisodesIndex
