import LazyImage from '@/components/LazyImage'
import SmartLink from '@/components/SmartLink'
import { siteConfig } from '@/lib/config'
import { useEffect, useState } from 'react'

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
 * 提取集数编号（如 episode/990 -> 990）
 */
const getEpNum = (post) => {
  const slug = String(post?.slug || post?.href || '')
  const match = slug.match(/(\d+)(?!.*\d)/)
  return match ? Number(match.at(1)) : 0
}

/**
 * 精准提取全部节目中最新的一期（跳过置顶，按集数编号 & 发布时间降序取最大值）
 */
const getTrueLatestEpisode = (posts = [], latestPosts = []) => {
  const validPosts = Array.isArray(posts) ? posts : []
  const validLatest = Array.isArray(latestPosts) ? latestPosts : []

  const merged = []
  const seen = new Set()
  for (const p of [...validPosts, ...validLatest]) {
    if (!p) continue
    if (p.type && p.type !== 'Post') continue
    const key = p.id || p.slug || p.href || p.title
    if (key && !seen.has(key)) {
      seen.add(key)
      merged.push(p)
    }
  }

  if (merged.length === 0) return null

  const taggedLatest = merged.find(
    p => p?.featuredType && String(p.featuredType).includes('最新')
  )
  if (taggedLatest) return taggedLatest

  const nonPinned = merged.filter(
    p => !p?.featuredType || !String(p.featuredType).includes('置顶')
  )
  const pool = nonPinned.length > 0 ? nonPinned : merged

  const sorted = [...pool].sort((a, b) => {
    const epA = getEpNum(a)
    const epB = getEpNum(b)
    if (epA !== epB) return epB - epA

    const timeA = new Date(a?.publishDay || a?.date || 0).getTime()
    const timeB = new Date(b?.publishDay || b?.date || 0).getTime()
    return timeB - timeA
  })

  const best = sorted.at(0)
  if (best && !best.ext && !best.audio) {
    const fullObj = validPosts.find(
      p => (p.id && p.id === best.id) || (p.slug && p.slug === best.slug)
    )
    if (fullObj) return fullObj
  }
  return best || null
}

/**
 * 首页顶部聚光灯暖光播客 Hero（#DF7236 暖灯琥珀主题 + 1:1 还原透明细边框次按钮）
 */
const Hero = props => {
  const { siteInfo, posts = [], latestPosts = [] } = props

  const primaryColor = siteConfig('HEXO_COLOR_PRIMARY', '#DF7236') || '#DF7236'
  const GREETING_WORDS = siteConfig('GREETING_WORDS') || ''

  const slogans = GREETING_WORDS.trim()
    ? GREETING_WORDS.split(',').map(s => s.trim()).filter(Boolean)
    : ['有人念，有处安', '听，有你的故事；等，有故事的你']

  const [sloganIndex, setSloganIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (slogans.length <= 1) return

    let fadeTimer = null
    const interval = setInterval(() => {
      setVisible(false)
      fadeTimer = setTimeout(() => {
        setSloganIndex(prev => (prev + 1) % slogans.length)
        setVisible(true)
      }, 850)
    }, 5200)

    return () => {
      clearInterval(interval)
      if (fadeTimer) clearTimeout(fadeTimer)
    }
  }, [slogans.length])

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
      {/* 背景层：深暖夜底色 + #DF7236 暖灯琥珀聚光晕 + 底部平滑羽化融底 */}
      <div
        className='absolute inset-x-0 top-0 -bottom-44 pointer-events-none select-none overflow-hidden'
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.84) 66%, rgba(0,0,0,0.46) 80%, rgba(0,0,0,0.14) 91%, rgba(0,0,0,0) 100%)',
          maskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.84) 66%, rgba(0,0,0,0.46) 80%, rgba(0,0,0,0.14) 91%, rgba(0,0,0,0) 100%)'
        }}
      >
        {/* 1. 深暖咖啡夜色底（与参考站一致的温暖暗调基底） */}
        <div
          className='absolute inset-0'
          style={{
            background: 'linear-gradient(180deg, #171210 0%, #120E0C 100%)'
          }}
        />

        {/* 2. 极淡酒馆插画肌理 */}
        {siteInfo?.pageCover && (
          <LazyImage
            priority
            src={siteInfo.pageCover}
            alt={siteInfo?.title}
            className='w-full h-full object-cover object-center absolute inset-0 opacity-10 blur-2xl scale-110'
          />
        )}

        {/* 3. 统一 #DF7236 暖灯琥珀聚光灯晕 */}
        <div
          className='absolute inset-0'
          style={{
            background:
              'radial-gradient(ellipse 68% 62% at 50% 0%, rgba(223, 114, 54, 0.36) 0%, rgba(223, 114, 54, 0.14) 48%, rgba(18, 14, 12, 0) 85%)'
          }}
        />
      </div>

      {/* 前景内容区 */}
      <div className='relative z-10 text-white flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-5 text-center'>
        {/* 大字标题：缓慢淡入淡出轮播 */}
        <h1 className='min-h-[44px] sm:min-h-[52px] md:min-h-[60px] flex items-center justify-center font-bold text-2xl sm:text-4xl md:text-[42px] tracking-wider text-white mb-4 leading-tight'>
          <span
            className={`inline-block transition-all duration-700 ease-in-out ${
              visible ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-1.5 blur-[2px]'
            }`}
          >
            {slogans.at(sloganIndex)}
          </span>
        </h1>

        {/* 精简版电台简介 */}
        <p className='font-light tracking-wide text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mb-7'>
          这里是「念安酒馆」，一档深夜陪伴播客。有时郑重展开一封来信，有时一个人碎碎念；有人来了，就坐下慢慢聊。
        </p>

        {/* 双行动按钮 */}
        <div className='flex flex-wrap items-center justify-center gap-3.5'>
          {latestPost && (
            <SmartLink
              href={latestPost.href || '/episodes'}
              onClick={latestAudioUrl ? handlePlayLatest : undefined}
              className='inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5'
              style={{
                background: 'linear-gradient(135deg, #E87D42 0%, #DF7236 52%, #C45B24 100%)',
                boxShadow: '0 10px 24px -6px rgba(223, 114, 54, 0.48)'
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
            className='hero-ghost-btn inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5'
          >
            <span>浏览全部节目</span>
          </SmartLink>
        </div>
      </div>

      <style jsx>{`
        .hero-ghost-btn {
          color: rgba(255, 255, 255, 0.9);
          background-color: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.14);
        }
        .hero-ghost-btn:hover {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.24);
        }
      `}</style>
    </header>
  )
}

export default Hero
