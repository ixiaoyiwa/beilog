import LazyImage from '@/components/LazyImage'
import SmartLink from '@/components/SmartLink'
import { siteConfig } from '@/lib/config'
import { loadExternalResource } from '@/lib/utils'
import { useEffect } from 'react'

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

/**
 * 跳过置顶节目，精准提取按发布时间最新的那一期播客
 */
const getTrueLatestEpisode = (posts = [], latestPosts = []) => {
  const validPosts = Array.isArray(posts) ? posts : []
  const validLatest = Array.isArray(latestPosts) ? latestPosts : []

  const taggedLatest = validPosts.find(
    p => p?.featuredType && String(p.featuredType).includes('最新')
  )
  if (taggedLatest) return taggedLatest

  const globalFirst = validLatest.find(p => !p?.type || p.type === 'Post') || validLatest.at(0)
  if (globalFirst) {
    const matchedFull = validPosts.find(
      p => (p.id && p.id === globalFirst.id) || (p.slug && p.slug === globalFirst.slug)
    )
    return matchedFull || globalFirst
  }

  const nonPinned = validPosts.filter(
    p => !p?.featuredType || !String(p.featuredType).includes('置顶')
  )
  const pool = nonPinned.length > 0 ? nonPinned : validPosts
  return [...pool].sort((a, b) => {
    const timeA = new Date(a?.publishDay || a?.date || 0).getTime()
    const timeB = new Date(b?.publishDay || b?.date || 0).getTime()
    return timeB - timeA
  }).at(0) || null
}

/**
 * 首页顶部聚光灯暖光播客 Hero（大字打字机轮播 + 精简电台简介 + 统一双按钮）
 */
const Hero = props => {
  const { siteInfo, posts = [], latestPosts = [] } = props

  const primaryColor = siteConfig('HEXO_COLOR_PRIMARY', '#3A4A7A') || '#3A4A7A'
  const GREETING_WORDS = siteConfig('GREETING_WORDS') || ''
  const GREETING_WORDS_TYPE_SPEED =
    Number(siteConfig('GREETING_WORDS_TYPE_SPEED')) || 180
  const GREETING_WORDS_BACK_SPEED =
    Number(siteConfig('GREETING_WORDS_BACK_SPEED')) || 90

  useEffect(() => {
    let disposed = false
    let typedInstance

    // 默认两句大字轮播（若你在 Notion/环境变量 GREETING_WORDS 里填了自定义句子则优先使用）
    const stringsList = GREETING_WORDS.trim()
      ? GREETING_WORDS.split(',').map(s => s.trim()).filter(Boolean)
      : ['有人念，有处安', '听，有你的故事；等，有故事的你']

    if (document.getElementById('hero-typed-title') && stringsList.length > 0) {
      loadExternalResource('/js/typed.min.js', 'js')
        .then(() => {
          if (!disposed && window.Typed) {
            typedInstance = new window.Typed('#hero-typed-title', {
              strings: stringsList,
              typeSpeed: GREETING_WORDS_TYPE_SPEED,
              backSpeed: GREETING_WORDS_BACK_SPEED,
              backDelay: 2200,
              loop: true,
              showCursor: false,
              smartBackspace: false
            })
          }
        })
        .catch(() => {})
    }

    return () => {
      disposed = true
      typedInstance?.destroy()
    }
  }, [GREETING_WORDS, GREETING_WORDS_TYPE_SPEED, GREETING_WORDS_BACK_SPEED])

  const latestPost = getTrueLatestEpisode(posts, latestPosts)
  const latestAudioUrl = latestPost?.audio || parseExt(latestPost?.ext)

  const handlePlayLatest = (e) => {
    if (!latestAudioUrl) return
    e.preventDefault()
    window.dispatchEvent(
      new CustomEvent('toggle-global-audio', {
        detail: {
          src: latestAudioUrl,
          cover: latestPost?.pageCoverThumbnail || latestPost?.pageCover || siteInfo?.pageCover,
          title: latestPost?.title,
          href: latestPost?.href
        }
      })
    )
  }

  return (
    <header
      id='header'
      style={{ zIndex: 10, '--theme-primary': primaryColor }}
      className='w-full min-h-[360px] pt-24 pb-8 lg:py-0 lg:h-[430px] relative flex items-center justify-center'
    >
      {/* 背景层：顶部暖琥珀聚光灯晕 + 极淡酒馆纹理 + 底部平滑羽化融底 */}
      <div
        className='absolute inset-x-0 top-0 -bottom-44 pointer-events-none select-none overflow-hidden'
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.84) 66%, rgba(0,0,0,0.46) 80%, rgba(0,0,0,0.14) 91%, rgba(0,0,0,0) 100%)',
          maskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.84) 66%, rgba(0,0,0,0.46) 80%, rgba(0,0,0,0.14) 91%, rgba(0,0,0,0) 100%)'
        }}
      >
        <div
          className='absolute inset-0'
          style={{
            background: 'linear-gradient(180deg, #161318 0%, #111015 100%)'
          }}
        />

        {siteInfo?.pageCover && (
          <LazyImage
            priority
            src={siteInfo.pageCover}
            alt={siteInfo?.title}
            className='w-full h-full object-cover object-center absolute inset-0 opacity-12 blur-2xl scale-110'
          />
        )}

        <div
          className='absolute inset-0'
          style={{
            background:
              'radial-gradient(ellipse 68% 62% at 50% 0%, rgba(218, 134, 58, 0.34) 0%, rgba(168, 92, 42, 0.14) 48%, rgba(17, 16, 21, 0) 85%)'
          }}
        />
      </div>

      {/* 前景内容区：大字打字机轮播 + 精简两行简介 + 双按钮 */}
      <div className='relative z-10 text-white flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-5 text-center'>
        {/* 大字打字机主标题（固定最小高度防止退格换行时下方文字上下跳动） */}
        <h1 className='min-h-[44px] sm:min-h-[52px] md:min-h-[60px] flex items-center justify-center font-bold text-2xl sm:text-4xl md:text-[42px] tracking-wider text-white mb-4 leading-tight'>
          <span id='hero-typed-title'>有人念，有处安</span>
        </h1>

        {/* 精简版电台简介 */}
        <p className='font-light tracking-wide text-white/80 text-sm sm:text-base leading-relaxed max-w-xl mb-7'>
          这里是「念安酒馆」，一档深夜陪伴播客。有时郑重展开一封来信，有时一个人碎碎念；有人来了，就坐下慢慢聊。
        </p>

        {/* 双行动按钮 */}
        <div className='flex flex-wrap items-center justify-center gap-3.5'>
          {latestPost && (
            <SmartLink
              href={latestPost.href || '/episodes'}
              onClick={latestAudioUrl ? handlePlayLatest : undefined}
              className='inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5'
              style={{
                background: 'linear-gradient(135deg, #d98236 0%, #b86222 100%)',
                boxShadow: '0 10px 24px -6px rgba(217, 130, 54, 0.45)'
              }}
            >
              <svg viewBox='0 0 24 24' width='15' height='15' fill='currentColor'>
                <path d='M8 5v14l11-7z' />
              </svg>
              <span>播放最新节目</span>
            </SmartLink>
          )}

          <SmartLink
            href='/episodes'
            className='inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white/95 bg-black/25 hover:bg-black/35 dark:bg-white/10 dark:hover:bg-white/15 border border-white/20 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5'
          >
            <span>浏览全部节目</span>
          </SmartLink>
        </div>
      </div>
    </header>
  )
}

export default Hero
