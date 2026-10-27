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

const PlayIcon = ({ size = 14 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor' style={{ marginLeft: '1px' }}>
    <path d='M8 5v14l11-7z' />
  </svg>
)

const PauseIcon = ({ size = 14 }) => (
  <svg viewBox='0 0 24 24' width={size} height={size} fill='currentColor'>
    <rect x='6' y='5' width='4' height='14' rx='1' />
    <rect x='14' y='5' width='4' height='14' rx='1' />
  </svg>
)

const LoadingIcon = ({ size = 14 }) => {
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

// ✨ 升级版微型胶囊
const MiniAudioCapsule = ({ isPlaying, isLoading, remaining, progress, primaryColor }) => {
  const isFilled = progress >= 100

  return (
    <div
      className='relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-white overflow-hidden'
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.15)', 
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transform: 'translateZ(0)'
      }}
    >
      {/* 动态渐变填充层：完美复刻头图的遮罩蔓延逻辑 */}
      {progress > 0 && (
        <div
          className='absolute inset-0 pointer-events-none'
          style={{
            background: `linear-gradient(90deg, rgba(255, 255, 255, 0.6) 0%, ${primaryColor} 100%)`,
            // 微缩版的无边界蔓延（缩小到16px的距离）
            WebkitMaskImage: isFilled ? 'none' : `linear-gradient(to right, #000 calc(${progress}% - 16px), transparent ${progress}%)`,
            maskImage: isFilled ? 'none' : `linear-gradient(to right, #000 calc(${progress}% - 16px), transparent ${progress}%)`,
            // 透明度逻辑保持一致
            opacity: isFilled ? 0.95 : (isPlaying ? 0.85 : 0.45),
            transition: 'opacity 0.3s ease'
          }}
        />
      )}

      {/* 图标稍微放大到 14，容器放大到 w-4 h-4 */}
      <div className='relative z-10 flex-shrink-0 flex items-center justify-center w-4 h-4'>
        {isLoading ? (
          <LoadingIcon size={14} />
        ) : isPlaying ? (
          <PauseIcon size={14} />
        ) : (
          <PlayIcon size={14} />
        )}
      </div>
      
      <span className='relative z-10 text-[11px] font-medium tabular-nums leading-none mt-[1px] drop-shadow-md'>
        {formatDuration(remaining)}
      </span>
    </div>
  )
}

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
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [progress, setProgress] = useState(0)

  const primaryColor = siteConfig('HEXO_COLOR_PRIMARY', '#3A4A7A') || '#3A4A7A'

  useEffect(() => {
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
          // ✨ 完美计算进度
          let p = (currentTime / duration) * 100
          if (duration - currentTime < 0.5) p = 100
          setProgress(p)
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
              <div className='absolute bottom-3 right-3 z-10 pointer-events-none'>
                <MiniAudioCapsule 
                  isPlaying={isPlaying} 
                  isLoading={isLoading} 
                  remaining={remaining} 
                  progress={progress}
                  primaryColor={primaryColor}
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
