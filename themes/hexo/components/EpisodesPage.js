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
    episodesTotalPages = 1,
    siteInfo,
    posts = []
  } = props

  const showSummary = siteConfig(
    'HEXO_POST_LIST_SUMMARY',
    null,
    CONFIG
  )

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

  // 只有第一页允许显示“最新”标记。
  // 直接使用上游已排序的 posts[0]，不再重复排序或解析日期。
  const isFirstPage = Number(page) === 1

  const latestPost =
    isFirstPage && Array.isArray(posts) && posts.length > 0
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

              // 先保留节目原有的标签
              let displayFeaturedType =
                post?.featuredType || null

              // 判断当前节目是否为上游排序后的第一期
              const isLatestPost =
                isFirstPage &&
                latestPost &&
                (
                  latestIdentity
                    ? identity === latestIdentity
                    : post === latestPost
                )

              if (isLatestPost) {
                // 仅第一页的全站最新一期显示绿色“最新”
                displayFeaturedType = 'latest'
              } else if (
                originalType === 'latest' ||
                originalType === '最新'
              ) {
                // 清除其他节目或后续分页中残留的动态“最新”标记
                displayFeaturedType = null
              }

              const globalIndex = Array.isArray(posts)
                ? posts.findIndex(
                    item =>
                      getPostIdentity(item) === identity
                  )
                : -1

              // 将最终标签写入卡片使用的对象副本
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
        page={page}
        totalPage={episodesTotalPages}
      />
    </div>
  )
}

export default EpisodesPage
