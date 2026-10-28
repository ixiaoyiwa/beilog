import { useEffect } from 'react'
import { isBrowser } from '@/lib/utils'
import { siteConfig } from '@/lib/config'
import CONFIG from '../config'
import BlogPostCard from './BlogPostCard'
import PaginationNumber from './PaginationNumber'

// 统一获取节目标识
const getPostIdentity = post =>
  String(post?.slug || post?.id || '').trim()

const EpisodesPage = props => {
  const {
    archivePosts = {},
    page = 1,
    currentPage,
    episodesTotalPages = 1,
    siteInfo,
    posts = []
  } = props

  const showSummary = siteConfig(
    'HEXO_POST_LIST_SUMMARY',
    null,
    CONFIG
  )

  // 首页使用 currentPage，因为 props.page 被页面对象占用了。
  // 后续分页使用 [page].js 传入的数字 page。
  const currentPageNumber =
    currentPage !== undefined && currentPage !== null
      ? Number(currentPage)
      : typeof page === 'number' || typeof page === 'string'
        ? Number(page)
        : NaN

  const isFirstPage = currentPageNumber === 1

  useEffect(() => {
    if (isBrowser) {
      const anchor = window.location.hash

      if (anchor) {
        setTimeout(() => {
          const anchorElement = document.getElementById(
            anchor.substring(1)
          )

          if (anchorElement) {
            anchorElement.scrollIntoView({
              block: 'start',
              behavior: 'smooth'
            })
          }
        }, 300)
      }
    }
  }, [])

  // 上游已按发布时间从新到旧排序，第一页第一期即为最新一期。
  const latestPost =
    isFirstPage &&
    Array.isArray(posts) &&
    posts.length > 0
      ? posts[0]
      : null

  const latestIdentity = getPostIdentity(latestPost)

  return (
    <div className='w-full px-2 md:px-0'>
      {Object.keys(archivePosts).map(month => (
        <section
          key={month}
          id={month}
          className='mb-8'
        >
          <div className='text-2xl font-extrabold mb-4 text-gray-700 dark:text-gray-300'>
            {month}
          </div>

          <div className='space-y-6'>
            {(archivePosts[month] || []).map((post, localIndex) => {
              const identity = getPostIdentity(post)

              const originalType = String(
                post?.featuredType || ''
              )
                .trim()
                .toLowerCase()

              // 默认保留节目原有标签
              let displayFeaturedType =
                post?.featuredType || null

              // 只给第一页真正最新的节目添加“最新”标签
              const isLatestPost =
                isFirstPage &&
                latestPost &&
                (
                  latestIdentity
                    ? identity === latestIdentity
                    : post === latestPost
                )

              if (isLatestPost) {
                displayFeaturedType = 'latest'
              } else if (
                originalType === 'latest' ||
                originalType === '最新'
              ) {
                // 防止其他节目或后续分页残留旧的“最新”标记
                displayFeaturedType = null
              }

              const globalIndex = Array.isArray(posts)
                ? posts.findIndex(
                    item =>
                      getPostIdentity(item) === identity
                  )
                : -1

              // 把最终标签交给卡片，不修改原始节目数据
              const displayPost = {
                ...post,
                featuredType: displayFeaturedType
              }

              return (
                <div
                  key={
                    displayPost.id ||
                    displayPost.slug ||
                    `${month}-${localIndex}`
                  }
                  id={String(displayPost.slug || '')}
                  className='scroll-mt-24'
                >
                  <BlogPostCard
                    index={
                      globalIndex >= 0
                        ? globalIndex + 1
                        : localIndex + 1
                    }
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

      <PaginationNumber
        page={
          Number.isFinite(currentPageNumber)
            ? currentPageNumber
            : 1
        }
        totalPage={episodesTotalPages}
      />
    </div>
  )
}

export default EpisodesPage
