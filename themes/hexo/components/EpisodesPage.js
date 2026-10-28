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

    // Date 对象
    if (value instanceof Date) {
      const timestamp = value.getTime()
      if (Number.isFinite(timestamp) && timestamp > 0) {
        return timestamp
      }
      continue
    }

    // 数字时间戳或数字形式的时间戳字符串
    if (
      typeof value === 'number' ||
      (typeof value === 'string' && /^\d{9,13}$/.test(value.trim()))
    ) {
      const numericValue = Number(value)

      if (Number.isFinite(numericValue) && numericValue > 0) {
        // 10 位左右通常是秒，13 位通常是毫秒
        return numericValue < 100000000000
          ? numericValue * 1000
          : numericValue
      }
    }

    // ISO 日期、YYYY-MM-DD 等日期字符串
    const timestamp = new Date(value).getTime()

    if (Number.isFinite(timestamp) && timestamp > 0) {
      return timestamp
    }
  }

  return 0
}

// 使用统一的节目标识进行比较
const getPostIdentity = post =>
  String(post?.slug || post?.id || '')

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

  // 将当前分页所有月份的节目合并，仅用于查找最新一期
  const currentPagePosts = Object.keys(archivePosts).flatMap(month => {
    const monthPosts = archivePosts[month]
    return Array.isArray(monthPosts) ? monthPosts : []
  })

  // 只允许节目页第一页生成“最新”
  const isFirstPage = Number(page) === 1

  let absoluteLatestId = null
  let maxTime = 0

  if (isFirstPage) {
    currentPagePosts.forEach(post => {
      const timestamp = getPublishTimestamp(post)
      const identity = getPostIdentity(post)

      // 日期有效且有唯一标识时，才参与最新一期的判断
      if (
        identity &&
        timestamp > 0 &&
        timestamp > maxTime
      ) {
        maxTime = timestamp
        absoluteLatestId = identity
      }
    })
  }

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

              const originalType = String(post?.featuredType || '')
                .trim()
                .toLowerCase()

              // 默认保留 Notion 中原本设置的标签
              let displayFeaturedType = post?.featuredType || null

              // 仅第一页的全局候选最新节目显示绿色“最新”
              if (
                isFirstPage &&
                absoluteLatestId &&
                identity === absoluteLatestId
              ) {
                displayFeaturedType = 'latest'
              } else if (
                originalType === 'latest' ||
                originalType === '最新'
              ) {
                // 清理此前每页各自生成的旧“最新”标记
                displayFeaturedType = null
              }

              const globalIndex = Array.isArray(posts)
                ? posts.findIndex(
                    item =>
                      getPostIdentity(item) === identity
                  )
                : -1

              // ✨ 按照 GPT 的要求，与首页处理方式保持一致：
              // 把最终标签写入卡片使用的节目对象副本
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
