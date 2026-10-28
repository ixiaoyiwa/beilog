import { useEffect } from 'react'
import { isBrowser } from '@/lib/utils'
import { siteConfig } from '@/lib/config'
import CONFIG from '../config'
import BlogPostCard from './BlogPostCard'
import PaginationNumber from './PaginationNumber'

const getPublishTimestamp = post => {
  const publishDate = Number(post?.publishDate)
  if (Number.isFinite(publishDate) && publishDate > 0) return publishDate
  const dateCandidates = [post?.date?.start_date, typeof post?.date === 'string' ? post.date : null, post?.publishDay]
  for (const value of dateCandidates) {
    if (!value) continue
    const timestamp = new Date(value).getTime()
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp
  }
  return 0
}

// ✨ 修复 1：优先用 slug 比较全站数据和当前卡片
const getPostIdentity = post => String(post?.slug || post?.id || '')

const EpisodesPage = props => {
  const { archivePosts = {}, page = 1, episodesTotalPages = 1, siteInfo, posts = [] } = props
  const showSummary = siteConfig('HEXO_POST_LIST_SUMMARY', null, CONFIG)

  useEffect(() => {
    if (isBrowser) {
      const anchor = window.location.hash
      if (anchor) {
        setTimeout(() => {
          const anchorElement = document.getElementById(anchor.substring(1))
          if (anchorElement) anchorElement.scrollIntoView({ block: 'start', behavior: 'smooth' })
        }, 300)
      }
    }
  }, [])

  // ✨ 修复 2：严格使用全站数据 props.allPages 计算最新
  const currentPagePosts = Object.keys(archivePosts).flatMap(month => {
    const monthPosts = archivePosts[month]
    return Array.isArray(monthPosts) ? monthPosts : []
  })

  const globalPublishedPosts = Array.isArray(props.allPages)
    ? props.allPages.filter(
        post => post?.type === 'Post' && post?.status === 'Published'
      )
    : []

  const latestSourcePosts =
    globalPublishedPosts.length > 0
      ? globalPublishedPosts
      : Number(page) === 1
        ? currentPagePosts.filter(
            post => post?.type === 'Post' && post?.status === 'Published'
          )
        : []

  let absoluteLatestId = null
  let maxTime = -1

  latestSourcePosts.forEach(post => {
    const timestamp = getPublishTimestamp(post)
    if (timestamp > maxTime && getPostIdentity(post)) {
      maxTime = timestamp
      absoluteLatestId = getPostIdentity(post)
    }
  })

  return (
    <div className='w-full px-2 md:px-0'>
      {Object.keys(archivePosts).map(month => (
        <section key={month} id={month} className='mb-8'>
          <div className='text-2xl font-extrabold mb-4 text-gray-700 dark:text-gray-300'>
            {month}
          </div>
          <div className='space-y-6'>
            {(archivePosts[month] || []).map((post, localIndex) => {
              const postIdentity = getPostIdentity(post)
              const originalType = String(post?.featuredType || '').trim().toLowerCase()

              // ✨ 修复 3：保留原来的标签判断逻辑，清除历史遗留标记
              let displayFeaturedType = post?.featuredType || null

              if (absoluteLatestId && postIdentity === absoluteLatestId) {
                displayFeaturedType = 'latest'
              } else if (['latest', '最新'].includes(originalType)) {
                displayFeaturedType = null
              }

              const globalIndex = Array.isArray(posts)
                ? posts.findIndex(item => getPostIdentity(item) === postIdentity)
                : -1

              return (
                <div key={post.id || post.slug || `${month}-${localIndex}`} id={String(post.slug)} className='scroll-mt-24'>
                  <BlogPostCard
                    index={globalIndex >= 0 ? globalIndex + 1 : localIndex + 1}
                    post={post}
                    showSummary={showSummary}
                    siteInfo={siteInfo}
                    featuredType={displayFeaturedType}
                  />
                </div>
              )
            })}
          </div>
        </section>
      ))}
      <PaginationNumber page={page} totalPage={episodesTotalPages} />
    </div>
  )
}

export default EpisodesPage
