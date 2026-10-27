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

// --- 微型胶囊组件开始 ---
const PlayIcon = ({ size = 10 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor' style={{ marginLeft: '1px' }}>
    <path d='M8 5v14l11-7z' />
  </svg>
)

const PauseIcon = ({ size = 10 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor'>
    <rect x='6' y='5' width='4' height='14' rx='1' />
    <rect x='14' y='5' width='4' height='14' rx='1' />
  </svg>
)

const LoadingIcon = ({ size = 10 }) => {
  const dots = 8
  const radius = 9
  const dotR = 1.6
  return (
    <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor'>
      {Array.from({ length: dots }).map((_, i) => {
        const angle = (i * 45) * Math.PI / 180
        const cx = 12 + radius * Math.sin(angle)
        const cy = 12 - radius * Math.cos(angle)
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={dotR}
            style={{
              animation: 'ios-dot-fade 1s linear infinite',
              animationDelay: `${(i * 1) / dots}s`,
              opacity: 0.15
            }}
          />
        )
      })}
      <style jsx>{`
        @keyframes ios-dot-fade {
          0% { opacity: 0.15; }
          50% { opacity: 1; }
          100% { opacity: 0.15; }
        }
      `}</style>
    </svg>
  )
}

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

const MiniAudioCapsule = ({ isPlaying, isLoading, remaining }) => {
  return (
    <div
      className='inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-white'
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.45)', // 深色半透明，适合封面图
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15)',
        transform: 'translateZ(0)'
      }}
    >
      <div className='flex-shrink-0 flex items-center justify-center w-3 h-3'>
        {isLoading ? (
          <LoadingIcon size={10} />
        ) : isPlaying ? (
          <PauseIcon size={10} />
        ) : (
          <PlayIcon size={10} />
        )}
      </div>
      <span className='text-[10px] font-medium tabular-nums leading-none mt-[1px]'>
        {formatDuration(remaining)}
      </span>
    </div>
  )
}
// --- 微型胶囊组件结束 ---

const BlogPostCard = ({ index, post, showSummary, siteInfo }) => {
  const router = useRouter()
  
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
  
  // 增加了剩余时间和加载状态
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    // 初始挂载时，尝试探测一下音频时长，保证未播放时也能显示正确的总时长
    if (hasAudio) {
      const probe = new Audio()
      probe.preload = 'metadata'
      probe.onloadedmetadata = () => setRemaining(probe.duration)
      probe.src = audioUrl
      return () => {
        probe.src = ''
      }
    }
  }, [hasAudio, audioUrl])

  useEffect(() => {
    const onState = (e) => {
      const { src, playing, currentTime, duration, loading } = e.detail
      if (src === audioUrl && audioUrl) {
        setIsPlaying(playing)
        setIsLoading(!!loading)
        if (duration > 0) {
          setRemaining(Math.max(0, duration - currentTime))
        }
      } else {
        setIsPlaying(false)
        setIsLoading(false)
      }
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
              // 换成刚写的微型胶囊，依然定位在右下角，并保持 pointer-events-none 防止干扰封面点击
              <div className='absolute bottom-3 right-3 z-10 pointer-events-none'>
                <MiniAudioCapsule 
                  isPlaying={isPlaying} 
                  isLoading={isLoading} 
                  remaining={remaining} 
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
