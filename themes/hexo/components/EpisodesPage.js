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

  // 1. 把当前页面所有的文章全部拍平收集
  const allPostsFlatten = []
  Object.keys(archivePosts).forEach(month => {
    allPostsFlatten.push(...archivePosts[month])
  })

  // 2. 找到全站唯一且绝对最新的一篇文章的 ID (按真实发布时间戳比对)
  let absoluteLatestId = null
  let maxTime = 0
  allPostsFlatten.forEach(post => {
    const pDate = post.publishDate || new Date(post.publishDay || post.date || 0).getTime()
    if (pDate > maxTime) {
      maxTime = pDate
      absoluteLatestId = post.id
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
            {archivePosts[month].map(post => {
              let type = post.featuredType
              
              // 如果这篇是全站唯一的最新，强制覆盖为 latest
              if (post.id === absoluteLatestId) {
                type = 'latest'
              } else if (type === '最新' || type === 'latest') {
                // 如果它不是最新，却因为后台或别的逻辑带了最新，强行去掉！
                type = null
              }

              return (
                <div key={post.id} id={String(post.slug)} className='scroll-mt-24'>
                  <BlogPostCard
                    index={posts.indexOf(post) + 1}
                    post={post}
                    showSummary={showSummary}
                    siteInfo={siteInfo}
                    featuredType={type}
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
