import { formatDateFmt } from '@/lib/utils/formatDate'

// 严格按照你的需求：固定 12 期/页
export const EPISODES_PER_PAGE = 12

// 节目排序：最新 -> 最旧，依据 publishDate
export function sortEpisodes(posts) {
  return [...posts].sort(
    (a, b) => (b?.publishDate ?? 0) - (a?.publishDate ?? 0)
  )
}

// 按 yyyy-MM 分组（用于页面视觉分组）
export function groupEpisodesByMonth(posts) {
  const grouped = {}
  posts.forEach(post => {
    const month = formatDateFmt(post.publishDate, 'yyyy-MM')
    if (!grouped[month]) grouped[month] = []
    grouped[month].push(post)
  })
  return grouped
}

// 计算当前 post 在第几页（用于单期页面 E976 精准跳转）
export function getEpisodeArchivePage(allPages, currentPost) {
  if (!allPages || !currentPost) return 1
  const publishedPosts = allPages.filter(
    post => post?.type === 'Post' && post?.status === 'Published'
  )
  const sorted = sortEpisodes(publishedPosts)
  const index = sorted.findIndex(item => item.id === currentPost.id)
  if (index === -1) return 1
  return Math.floor(index / EPISODES_PER_PAGE) + 1
}
