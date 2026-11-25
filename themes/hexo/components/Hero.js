import LazyImage from '@/components/LazyImage'
import SmartLink from '@/components/SmartLink'
import { siteConfig } from '@/lib/config'

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
 * 首页顶部聚光灯暖光播客 Hero（定制品牌主标题 + 温润电台简介 + 播客双按钮）
 */
const Hero = props => {
  const { siteInfo, posts = [] } = props

  const primaryColor = siteConfig('HEXO_COLOR_PRIMARY', '#3A4A7A') || '#3A4A7A'

  // 提取首页第一篇（最新一期）节目，用于主按钮直接播放
  const latestPost = Array.isArray(posts) && posts.length > 0 ? posts.at(0) : null
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
      className='w-full min-h-[400px] pt-24 pb-10 lg:py-0 lg:h-[470px] relative flex items-center justify-center'
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
        {/* 1. 深邃暖夜底色 */}
        <div
          className='absolute inset-0'
          style={{
            background: 'linear-gradient(180deg, #161318 0%, #111015 100%)'
          }}
        />

        {/* 2. 极淡酒馆插画肌理 */}
        {siteInfo?.pageCover && (
          <LazyImage
            priority
            src={siteInfo.pageCover}
            alt={siteInfo?.title}
            className='w-full h-full object-cover object-center absolute inset-0 opacity-12 blur-2xl scale-110'
          />
        )}

        {/* 3. 顶部中央暖琥珀/金棕聚光灯晕 */}
        <div
          className='absolute inset-0'
          style={{
            background:
              'radial-gradient(ellipse 68% 62% at 50% 0%, rgba(218, 134, 58, 0.34) 0%, rgba(168, 92, 42, 0.14) 48%, rgba(17, 16, 21, 0) 85%)'
          }}
        />
      </div>

      {/* 前景内容区：大字品牌宣言 + 温润小字简介 + 播客双按钮 */}
      <div className='relative z-10 text-white flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-5 text-center'>
        {/* 顶部微标胶囊 */}
        <div className='inline-flex items-center gap-2 px-3 py-1 mb-5 rounded-full text-xs tracking-widest text-amber-200/85 bg-amber-500/10 border border-amber-400/20'>
          <span className='w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse' />
          <span>深夜情感电台 · 持续更新中</span>
        </div>

        {/* 大字主标题 */}
        <h1 className='font-bold text-3xl sm:text-4xl md:text-5xl tracking-wider text-white mb-4 leading-tight'>
          有人念，有处安
        </h1>

        {/* 小字简介文案 */}
        <p className='font-light tracking-wide text-white/75 text-sm sm:text-base leading-relaxed max-w-xl mb-7'>
          听，有你的故事；等，有故事的你。这里是「念安酒馆」，一档深夜陪伴播客。有时郑重展开一封来信，有时一个人碎碎念；有人来了，就坐下慢慢聊。愿你，有人念，有处安。
        </p>

        {/* 播客双行动按钮 */}
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
            className='inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white/90 bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5'
          >
            <span>浏览全部剧集</span>
          </SmartLink>
        </div>
      </div>
    </header>
  )
}

export default Hero
