import { useEffect } from 'react'
import { isBrowser } from '@/lib/utils'
import { siteConfig } from '@/lib/config'
import CONFIG from '../config'
import BlogPostCard from './BlogPostCard'
import PaginationNumber from './PaginationNumber'

// 获取节目真实发布时间，兼容毫秒时间戳和日期字符串
const getPublishTimestamp = post => {
  const candidates = [
    post?.publishDate,
    post?.date?.start_date,
    typeof post?.date === 'string' ? post.date : null,
    post?.publishDay
  ]

  for (const value of candidates) {
    if (value === null || value === undefined || value === '') {
      continue
    }
    if (value instanceof Date) {
      const timestamp = value.getTime()
      if (Number.isFinite(timestamp) && timestamp > 0) return timestamp
      continue
    }
    if (typeof value === 'number' || (typeof value === 'string' && /^\d{9,13}$/.test(value.trim()))) {
      const numericValue = Number(value)
      if (Number.isFinite(numericValue) && numericValue > 0) {
        return numericValue < 100000000000 ? numericValue * 1000 : numericValue
      }
    }
    const timestamp = new Date(value).getTime()
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp
  }
  return 0
}

const getPostIdentity = post => String(post?.slug || post?.id || '')

// ✨ 统一读取节目原始标记，兼容 Featured 和 featuredType
const getPostFeaturedType = post => {
  const toText = value => {
    if (value === null || value === undefined || value === '') return ''
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(',')
    if (typeof value === 'object') {
      const direct = value.name ?? value.value ?? value.select?.name ?? value.status?.name ?? value.plain_text
      if (direct !== undefined && direct !== null && direct !== '') return toText(direct)
    }
    return ''
  }

  const candidates = [
    post?.Featured,
    post?.featured,
    post?.properties?.Featured,
    post?.ext?.Featured,
    post?.ext?.featured,
    post?.featuredType
  ]

  for (const candidate of candidates) {
    const value = toText(candidate).trim().toLowerCase()
    if (value.includes('置顶') || value === 'pinned') return 'pinned'
    if (value.includes('精选') || value === 'featured') return 'featured'
    if (value.includes('会员') || value === 'member') return 'member'
    if (value === 'latest' || value === '最新') return 'latest'
  }

  return null
}

const EpisodesPage = props => {
  const {
    archivePosts = {},
    page = 1,
    currentPage,
    episodesTotalPages = 1,
    siteInfo,
    posts = []
  } = props

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

  // 首页的 page 可能是页面对象，实际数字页码在 currentPage 中。
  // 后续分页则使用 page 数字。
  const currentPageNumber =
    currentPage !== undefined && currentPage !== null
      ? Number(currentPage)
      : typeof page === 'number' || typeof page === 'string'
        ? Number(page)
        : NaN

  const isFirstPage = currentPageNumber === 1

  // 上游 sortEpisodes 已按发布时间倒序排列。
  // 第一页 posts[0] 就是当前列表中最新的一期。
  const latestPost =
    isFirstPage && Array.isArray(posts) && posts.length > 0
      ? posts[0]
      : null

  const latestIdentity = getPostIdentity(latestPost)

  return (
    <div className='w-full px-2 md:px-0'>
      {Object.keys(archivePosts).map(month => (
        <section key={month} id={month} className='mb-8'>
          <div className='text-2xl font-extrabold mb-4 text-gray-700 dark:text-gray-300'>
            {month}
          </div>
          <div className='space-y-6'>
            {(archivePosts[month] || []).map((post, localIndex) => {
              const identity = getPostIdentity(post)
              const resolvedFeaturedType = getPostFeaturedType(post)
              const originalType = String(resolvedFeaturedType || '').trim().toLowerCase()

              // 先保留节目原有标记
              let displayFeaturedType = resolvedFeaturedType

              // 只在第一页，把标签加给真正最新的普通节目
              const isLatestPost = Boolean(
                isFirstPage &&
                latestPost &&
                latestIdentity &&
                identity === latestIdentity
              )

              if (
                isLatestPost &&
                !['pinned', 'featured', 'member'].includes(originalType)
              ) {
                displayFeaturedType = 'latest'
              } else if (originalType === 'latest') {
                // 清除其余节目上残留的动态“最新”标记
                displayFeaturedType = null
              }

              const globalIndex = Array.isArray(posts)
                ? posts.findIndex(item => getPostIdentity(item) === identity)
                : -1

              const displayPost = {
                ...post,
                featuredType: displayFeaturedType
              }

              return (
                <div
                  key={displayPost.id || displayPost.slug || `${month}-${localIndex}`}
                  id={String(displayPost.slug || '')}
                  className='scroll-mt-24'
                >
                  <BlogPostCard
                    index={globalIndex >= 0 ? globalIndex + 1 : localIndex + 1}
                    post={displayPost}
                    showSummary={showSummary}
                    siteInfo={siteInfo}
                    featuredType={displayPost.featuredType}
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
