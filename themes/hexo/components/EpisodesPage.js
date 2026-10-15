import { useEffect } from 'react'

import { isBrowser } from '@/lib/utils'

import { siteConfig } from '@/lib/config'
import CONFIG from '../config'

import BlogPostCard from './BlogPostCard'

import PaginationNumber from './PaginationNumber'

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

  // 统一在这里处理 hash 滚动
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

  return (
    <div className='w-full px-2 md:px-0'>
      {Object.keys(archivePosts).map(month => (
        <section
          key={month}
          id={month}
          className='mb-8'>
          <div className='text-2xl font-extrabold mb-4 text-gray-700 dark:text-gray-300'>
            {month}
          </div>

          <div className='space-y-6'>
            {archivePosts[month].map(post => (
              <div
                key={post.id}
                id={String(post.slug)}
                className='scroll-mt-24'>
                <BlogPostCard
                  index={posts.indexOf(post) + 1}
                  post={post}
                  showSummary={showSummary}
                  siteInfo={siteInfo}
                />
              </div>
            ))}
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
