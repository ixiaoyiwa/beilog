import LazyImage from '@/components/LazyImage'
import { siteConfig } from '@/lib/config'
import { loadExternalResource } from '@/lib/utils'
import { useEffect } from 'react'
import CONFIG from '../config'
import NavButtonGroup from './NavButtonGroup'

/**
 * 首页顶部品牌氛围区（主色弥散渐变 + 圆形头像 + 微光分割线 + 无光标打字机）
 */
const Hero = props => {
  const { siteInfo } = props

  const primaryColor = siteConfig('HEXO_COLOR_PRIMARY', '#3A4A7A') || '#3A4A7A'
  const GREETING_WORDS = siteConfig('GREETING_WORDS') || ''
  const GREETING_WORDS_TYPE_SPEED =
    Number(siteConfig('GREETING_WORDS_TYPE_SPEED')) || 200
  const GREETING_WORDS_BACK_SPEED =
    Number(siteConfig('GREETING_WORDS_BACK_SPEED')) || 100

  useEffect(() => {
    let disposed = false
    let typedInstance

    if (document.getElementById('typed') && GREETING_WORDS) {
      loadExternalResource('/js/typed.min.js', 'js')
        .then(() => {
          if (!disposed && window.Typed) {
            typedInstance = new window.Typed('#typed', {
              strings: GREETING_WORDS.split(','),
              typeSpeed: GREETING_WORDS_TYPE_SPEED,
              backSpeed: GREETING_WORDS_BACK_SPEED,
              backDelay: 1200,
              loop: true,
              showCursor: false,
              smartBackspace: true
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

  const avatarSrc = siteInfo?.pageCover || siteInfo?.icon

  return (
    <header
      id='header'
      style={{ zIndex: 10, '--theme-primary': primaryColor }}
      className='w-full min-h-[460px] pt-24 pb-10 lg:py-0 lg:h-[66vh] relative flex items-center justify-center'
    >
      {/* 背景层：#3A4A7A 品牌主色弥散光晕 + 向下延伸 176px 铺到文章卡片背后，彻底消除白边与脏雾 */}
      <div
        className='absolute inset-x-0 top-0 -bottom-44 pointer-events-none select-none overflow-hidden'
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.82) 64%, rgba(0,0,0,0.48) 78%, rgba(0,0,0,0.16) 90%, rgba(0,0,0,0) 100%)',
          maskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 48%, rgba(0,0,0,0.82) 64%, rgba(0,0,0,0.48) 78%, rgba(0,0,0,0.16) 90%, rgba(0,0,0,0) 100%)'
        }}
      >
        <div
          className='absolute inset-0 opacity-95 dark:opacity-95'
          style={{
            background: `radial-gradient(circle at 50% 28%, #5267a3 0%, transparent 56%), linear-gradient(135deg, ${primaryColor} 0%, #232e4d 100%)`
          }}
        />
        <div className='absolute inset-0 bg-black/10 dark:bg-black/25' />
      </div>

      {/* 前景内容区：圆形头像 + 标题 + 微光分割线 + 打字机标语 */}
      <div className='relative z-10 text-white flex flex-col items-center justify-center w-full px-4'>
        {/* 圆形头像（原背景插画提取为精致圆形主视觉） */}
        {avatarSrc && (
          <div className='hero-avatar-ring mb-5 w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden select-none'>
            <LazyImage
              priority
              src={avatarSrc}
              alt={siteInfo?.title || siteConfig('TITLE')}
              className='w-full h-full object-cover object-center'
            />
          </div>
        )}

        {/* 站点标题 */}
        <div className='font-bold text-3xl sm:text-4xl md:text-5xl tracking-wide shadow-text-md text-center'>
          {siteInfo?.title || siteConfig('TITLE')}
        </div>

        {/* 复刻 vhAstro-Theme 的中心向两端渐隐微光分割线 */}
        <div
          className='w-48 sm:w-64 h-[1px] my-4 opacity-80'
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)'
          }}
        />

        {/* 打字机欢迎语（已关闭竖杠光标，支持英文逗号分隔多句轮播） */}
        <div className='min-h-[28px] flex items-center justify-center text-center font-light tracking-wider text-white/90 text-base sm:text-lg'>
          <span id='typed' />
        </div>

        {/* 首页导航大按钮（若开启则保留） */}
        {siteConfig('HEXO_HOME_NAV_BUTTONS', null, CONFIG) && (
          <div className='mt-4'>
            <NavButtonGroup {...props} />
          </div>
        )}
      </div>

      <style jsx>{`
        .hero-avatar-ring {
          box-shadow: 0 12px 32px -6px rgba(15, 23, 42, 0.45), 0 0 0 3px rgba(255, 255, 255, 0.22);
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s ease;
        }
        .hero-avatar-ring:hover {
          transform: translateY(-3px) scale(1.04);
          box-shadow: 0 18px 38px -6px rgba(15, 23, 42, 0.55), 0 0 0 4px rgba(255, 255, 255, 0.35);
        }
      `}</style>
    </header>
  )
}

export default Hero
