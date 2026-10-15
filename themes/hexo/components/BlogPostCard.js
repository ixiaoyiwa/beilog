import LazyImage from '@/components/LazyImage'
import { siteConfig } from '@/lib/config'
import CONFIG from '../config'
import { BlogPostCardInfo } from './BlogPostCardInfo'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

const parseExt = (ext) => {
  if (!ext) return null
  const raw = typeof ext === 'string' ? ext.trim() : ''
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.audio) return parsed.audio
  } catch (e) {}
  if (raw.startsWith('http')) return raw
  return null
}

const BlogPostCard = ({ index, post, showSummary, siteInfo }) => {
  const router = useRouter()
  
  // 直接从 post 上读取服务端注入的 featuredType
  const featuredType = post?.featuredType || null

  const showPreview = siteConfig('HEXO_POST_LIST_PREVIEW', null, CONFIG) && post.blockMap
  if (post && !post.pageCoverThumbnail && siteConfig('HEXO_POST_LIST_COVER_DEFAULT', null, CONFIG)) {
    post.pageCoverThumbnail = siteInfo?.pageCover
  }
  const showPageCover =
    siteConfig('HEXO_POST_LIST_COVER', null, CONFIG) &&
    post?.pageCoverThumbnail &&
    !showPreview

  const audioUrl = post?.audio || parseExt(post.ext)
  const hasAudio = !!audioUrl
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const onState = (e) => {
      const { src, playing } = e.detail
      if (src === audioUrl && audioUrl) setIsPlaying(playing)
      else setIsPlaying(false)
    }
    window.addEventListener('global-audio-state', onState)
    return () => window.removeEventListener('global-audio-state', onState)
  }, [audioUrl])

  const handleCoverClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (hasAudio) {
      window.dispatchEvent(
        new CustomEvent('toggle-global-audio', {
          detail: {
            src: audioUrl,
            cover: post.pageCoverThumbnail || post.pageCover,
            title: post.title,
            href: post.href
          }
        })
      )
    } else {
      router.push(post?.href)
    }
  }

  return (
    <div className={`${siteConfig('HEXO_POST_LIST_COVER_HOVER_ENLARGE', null, CONFIG) ? ' hover:scale-110 transition-all duration-150' : ''}`}>
      <div
        key={post.id}
        id='blog-post-card'
        className='group md:h-56 w-full flex justify-start md:gap-2 md:flex-row-reverse flex-col-reverse shadow-sm overflow-hidden border dark:border-black rounded-xl bg-white dark:bg-hexo-black-gray'>
        <BlogPostCardInfo
          index={index}
          post={post}
          featuredType={featuredType}
          showPageCover={showPageCover}
          showPreview={showPreview}
          showSummary={showSummary}
        />

        {showPageCover && (
          <div
            className='md:w-[38%] h-56 flex-shrink-0 overflow-hidden relative cursor-pointer'
            onClick={handleCoverClick}>
            <LazyImage
              priority={index === 1}
              alt={post?.title}
              src={post?.pageCoverThumbnail}
              className='h-56 w-full object-cover object-center group-hover:scale-110 duration-500'
            />
            {hasAudio && (
              <div className='absolute bottom-2 right-2 z-10 pointer-events-none'>
                <i
                  className={`fa-solid ${isPlaying ? 'fa-circle-pause' : 'fa-circle-play'} text-2xl text-white/70 drop-shadow-lg transition-colors`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BlogPostCard
