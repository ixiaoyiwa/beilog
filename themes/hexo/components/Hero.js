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
            color: '#DF883E',
            textShadow: '0 2px 18px rgba(200, 122, 56, 0.45)'
          }}
        >
          {char}
        </span>
      )
    }
    return <span key={idx}>{char}</span>
  })
}

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
      {/* 背景层 */}
      <div className='absolute inset-x-0 top-0 -bottom-44 pointer-events-none select-none overflow-hidden'>
        {/* 1. 白天模式背景 */}
        <div
          className='dark:hidden absolute inset-0'
          style={{
            WebkitMaskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 28%, rgba(0,0,0,0.82) 52%, rgba(0,0,0,0.48) 74%, rgba(0,0,0,0.14) 90%, rgba(0,0,0,0) 100%)',
            maskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.96) 28%, rgba(0,0,0,0.82) 52%, rgba(0,0,0,0.48) 74%, rgba(0,0,0,0.14) 90%, rgba(0,0,0,0) 100%)'
          }}
        >
          <div
            className='absolute inset-0'
            style={{
              background: 'linear-gradient(180deg, #211710 0%, #2C1E14 65%, #382619 100%)'
            }}
          />
          <div
            className='absolute inset-0'
            style={{
              background:
                'radial-gradient(ellipse 62% 56% at 50% 44%, rgba(216, 132, 60, 0.46) 0%, rgba(200, 122, 56, 0.20) 48%, rgba(33, 23, 16, 0) 82%)'
            }}
          />
        </div>

        {/* 2. 暗黑模式背景 */}
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

      {/* 前景内容区 */}
      <div className='relative z-10 text-white flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-5 text-center'>
        {/* 大字标题 */}
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
        <p className='font-light tracking-wide text-white/80 text-sm sm:text-base leading-relaxed max-w-xl mb-7'>
          这里是「念安酒馆」，一档深夜陪伴播客。有时郑重展开一封来信，有时一个人碎碎念；有人来了，就坐下慢慢聊。
        </p>

        {/* 双行动按钮：次按钮采用与主按钮同色系的 1px 主题色暖琥珀细边框 */}
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
            className='inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white/95 bg-white/[0.06] hover:bg-[#C87A38]/20 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5'
            style={{
              border: '1px solid rgba(200, 122, 56, 0.48)',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 6px 16px -4px rgba(0, 0, 0, 0.25)'
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
