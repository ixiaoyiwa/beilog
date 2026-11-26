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

const getEpNum = (post) => {
  const slug = String(post?.slug || post?.href || '')
  const match = slug.match(/(\d+)(?!.*\d)/)
  return match ? Number(match.at(1)) : 0
}

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
            textShadow: '0 2px 18px rgba(200, 122, 56, 0.32)'
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
 * 首页顶部聚光灯播客 Hero
 * 1. 光晕中心精准锁定在大字标题背后（at 50% 44%）
 * 2. 白天模式采用温润暖琥珀浅光晕自然融入暖米白底色（彻底消除灰色脏雾）；暗黑模式采用深邃黑底聚光灯
 * 3. 点击「播放最新节目」同步触发全局播放并跳转到最新一期文章页阅读
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

  // 触发全局播放器起播，同时不调用 e.preventDefault()，让 SmartLink 正常跳转进入最新一期文章页
  const handlePlayLatest = () => {
    if (!latestAudioUrl) return
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
      className='w-full pt-28 pb-10 sm:pt-32 sm:pb-12 lg:pt-36 lg:pb-14 relative flex items-center justify-center'
    >
      {/* 背景层：双模式独立渲染，彻底杜绝白天模式发灰 */}
      <div className='absolute inset-x-0 top-0 -bottom-32 pointer-events-none select-none overflow-hidden'>
        {/* ===== 1. 白天模式背景：零黑底，采用温润暖琥珀浅光自然融入网页暖米白底色 ===== */}
        <div
          className='dark:hidden absolute inset-0'
          style={{
            background:
              'linear-gradient(180deg, rgba(226, 198, 168, 0.55) 0%, rgba(238, 224, 206, 0.35) 52%, rgba(245, 244, 240, 0) 100%)'
          }}
        />
        <div
          className='dark:hidden absolute inset-0'
          style={{
            background:
              'radial-gradient(ellipse 62% 56% at 50% 42%, rgba(200, 122, 56, 0.24) 0%, rgba(200, 122, 56, 0.09) 48%, rgba(245, 244, 240, 0) 82%)'
          }}
        />

        {/* ===== 2. 暗黑模式背景：深邃纯黑底 + 集中在大字标题背后的暖琥珀聚光灯 ===== */}
        <div
          className='hidden dark:block absolute inset-0'
          style={{
            background: 'linear-gradient(180deg, #0D0B0A 0%, #080706 72%, rgba(8, 7, 6, 0) 100%)'
          }}
        />
        <div
          className='hidden dark:block absolute inset-0'
          style={{
            background:
              'radial-gradient(ellipse 60% 54% at 50% 44%, rgba(200, 122, 56, 0.36) 0%, rgba(200, 122, 56, 0.14) 46%, rgba(8, 7, 6, 0) 80%)'
          }}
        />
      </div>

      {/* 前景内容区：白天深胡桃墨色字、暗黑纯白字，清晰高级 */}
      <div className='relative z-10 flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-5 text-center'>
        {/* 大字标题（光晕正对此处背后） */}
        <h1 className='min-h-[68px] sm:min-h-[56px] md:min-h-[64px] flex items-center justify-center font-bold text-[22px] sm:text-3xl md:text-[42px] tracking-wide sm:tracking-wider text-[#261E18] dark:text-white mb-4 leading-snug break-words'>
          <span
            className={`inline-block transition-all duration-700 ease-in-out ${
              visible ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-1.5 blur-[2px]'
            }`}
          >
            {renderHighlightedSlogan(slogans.at(sloganIndex))}
          </span>
        </h1>

        {/* 精简版电台简介 */}
        <p className='font-normal dark:font-light tracking-wide text-[#5C4E42] dark:text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mb-7'>
          这里是「念安酒馆」，一档深夜陪伴播客。有时郑重展开一封来信，有时一个人碎碎念；有人来了，就坐下慢慢聊。
        </p>

        {/* 双行动按钮 */}
        <div className='flex flex-wrap items-center justify-center gap-3.5'>
          {latestPost && (
            <SmartLink
              href={latestPost.href || '/episodes'}
              onClick={handlePlayLatest}
              className='inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:brightness-105'
              style={{
                background: 'linear-gradient(180deg, #D68744 0%, #B86828 100%)',
                border: '1px solid rgba(110, 48, 12, 0.45)',
                boxShadow:
                  'inset 0 1px 0 rgba(255, 255, 255, 0.34), inset 0 -1px 0 rgba(0, 0, 0, 0.22), 0 10px 24px -6px rgba(200, 122, 56, 0.45)'
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
            className='inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-[#2E241C] dark:text-white/95 bg-white/80 hover:bg-white dark:bg-white/[0.08] dark:hover:bg-white/[0.14] border border-[#C87A38]/25 dark:border-white/20 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5'
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 6px 16px -4px rgba(0, 0, 0, 0.08)'
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
