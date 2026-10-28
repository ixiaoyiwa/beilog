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

const getPostIdentity = post => String(post?.id || post?.slug || '')

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

  const currentPagePosts = Object.keys(archivePosts).flatMap(month => {
    const monthPosts = archivePosts[month]
    return Array.isArray(monthPosts) ? monthPosts : []
  })

  const allKnownPosts = Array.isArray(posts) && posts.length > 0 ? posts : currentPagePosts

  let absoluteLatestId = null
  let maxTime = 0

  allKnownPosts.forEach(post => {
    const timestamp = getPublishTimestamp(post)
    if (timestamp > maxTime) {
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

              let displayFeaturedType = post?.featuredType || null

              if (absoluteLatestId && postIdentity === absoluteLatestId) {
                displayFeaturedType = 'latest'
              } else if (originalType === 'latest' || originalType === '最新') {
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
