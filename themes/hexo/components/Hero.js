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
 * 渲染带有 #C87A38 焦糖暖琥珀高亮关键词的标题文本
 */
const renderHighlightedSlogan = (text) => {
  if (!text) return null
  const highlightChars = new Set(['念', '安', '听', '等'])

  return Array.from(text).map((char, idx) => {
    if (highlightChars.has(char)) {
      return (
        <span
          key={idx}
          style={{
            color: '#C87A38',
            textShadow: '0 2px 16px rgba(200, 122, 56, 0.35)'
          }}
        >
          {char}
        </span>
      )
    }
    return <span key={idx}>{char}</span>
  })
}

/**
 * 首页顶部聚光灯播客 Hero（1:1 参考 Velixa Podcast 聚光灯晕 + #C87A38 主题色 + 手机端自适应折行）
 */
const Hero = props => {
  const { siteInfo, posts = [], latestPosts = [] } = props

  const primaryColor = siteConfig('HEXO_COLOR_PRIMARY', '#C87A38') || '#C87A38'
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
      className='w-full pt-28 pb-12 sm:pt-32 sm:pb-14 lg:pt-36 lg:pb-16 relative flex items-center justify-center overflow-hidden'
    >
      {/* 背景层：1:1 复刻 Velixa Podcast 聚光灯晕（自身衰减至 0%，杜绝半透明黑底叠加白底产生的泛白脏雾） */}
      <div className='absolute inset-0 pointer-events-none select-none overflow-hidden'>
        {/* 浅色模式底层：柔和暖咖夜幕渐变，底部在容器内自然透明融入暖米白背景 */}
        <div
          className='dark:hidden absolute inset-0'
          style={{
            background:
              'linear-gradient(180deg, rgba(28, 22, 18, 0.92) 0%, rgba(28, 22, 18, 0.78) 55%, rgba(28, 22, 18, 0.25) 84%, rgba(28, 22, 18, 0) 100%)'
          }}
        />

        {/* 深色模式底层：1:1 还原参考站的纯黑暖调基底 */}
        <div
          className='hidden dark:block absolute inset-0'
          style={{
            background: 'linear-gradient(180deg, #0D0B0A 0%, #000000 100%)'
          }}
        />

        {/* 极淡酒馆插画肌理 */}
        {siteInfo?.pageCover && (
          <LazyImage
            priority
            src={siteInfo.pageCover}
            alt={siteInfo?.title}
            className='w-full h-full object-cover object-center absolute inset-0 opacity-10 blur-2xl scale-110'
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 50%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, #000 0%, #000 50%, transparent 100%)'
            }}
          />
        )}

        {/* 核心灵魂：顶部中央 #C87A38 焦糖暖琥珀聚光灯晕（参考站同款径向光斑） */}
        <div
          className='absolute inset-0'
          style={{
            background:
              'radial-gradient(ellipse 65% 70% at 50% 0%, rgba(200, 122, 56, 0.34) 0%, rgba(200, 122, 56, 0.12) 48%, rgba(200, 122, 56, 0) 82%)'
          }}
        />
      </div>

      {/* 前景内容区：手机端自适应换行，完整展示长句 */}
      <div className='relative z-10 text-white flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-5 text-center'>
        {/* 大字标题：手机端自适应字号与多行高度，完整显示两句轮播 */}
        <h1 className='min-h-[68px] sm:min-h-[56px] md:min-h-[64px] flex items-center justify-center font-bold text-[22px] sm:text-3xl md:text-[42px] tracking-wide sm:tracking-wider text-white mb-4 leading-snug break-words'>
          <span
            className={`inline-block transition-all duration-700 ease-in-out ${
              visible ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-1.5 blur-[2px]'
            }`}
          >
            {renderHighlightedSlogan(slogans.at(sloganIndex))}
          </span>
        </h1>

        {/* 精简版电台简介 */}
        <p className='font-light tracking-wide text-white/80 dark:text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mb-7'>
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
                background: 'linear-gradient(135deg, #D48542 0%, #C87A38 55%, #A86228 100%)',
                boxShadow: '0 10px 24px -6px rgba(200, 122, 56, 0.45)'
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
            className='inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white/95 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15'
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.28)'
            }}
          >
            <span>浏览全部节目</span>
          </SmartLink>
        </div>
      </div>
    </header>
  )
}

export default Hero
