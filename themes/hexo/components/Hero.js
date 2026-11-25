import LazyImage from '@/components/LazyImage'
import { siteConfig } from '@/lib/config'
import { loadExternalResource } from '@/lib/utils'
import { useEffect } from 'react'
import CONFIG from '../config'
import NavButtonGroup from './NavButtonGroup'

/**
 * 首页顶部情感氛围区（原插画高斯模糊暖光遮罩 + 圆形头像 + 精致字号 + 无光标打字机）
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

  const coverSrc = siteInfo?.pageCover
  const avatarSrc = siteInfo?.icon || siteInfo?.pageCover

  return (
    <header
      id='header'
      style={{ zIndex: 10, '--theme-primary': primaryColor }}
      className='w-full min-h-[350px] pt-20 pb-8 lg:py-0 lg:h-[420px] relative flex items-center justify-center'
    >
      {/* 背景层：原酒馆插画高斯模糊 + 暖暗调氛围遮罩 + 底部平滑羽化融底 */}
      <div
        className='absolute inset-x-0 top-0 -bottom-40 pointer-events-none select-none overflow-hidden'
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 46%, rgba(0,0,0,0.82) 64%, rgba(0,0,0,0.45) 78%, rgba(0,0,0,0.14) 90%, rgba(0,0,0,0) 100%)',
          maskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 46%, rgba(0,0,0,0.82) 64%, rgba(0,0,0,0.45) 78%, rgba(0,0,0,0.14) 90%, rgba(0,0,0,0) 100%)'
        }}
      >
        {/* 1. 底层酒馆插画（适度高斯模糊，保留灯火暖意与故事氛围，不杂乱） */}
        {coverSrc && (
          <LazyImage
            priority
            src={coverSrc}
            alt={siteInfo?.title}
            className='w-full h-full object-cover object-center absolute inset-0 blur-md scale-105'
          />
        )}

        {/* 2. 暖暗调氛围遮罩（既保留酒馆暖黄灯影，又保证白字清晰温润） */}
        <div
          className='absolute inset-0'
          style={{
            background:
              'linear-gradient(180deg, rgba(24, 20, 28, 0.52) 0%, rgba(30, 25, 36, 0.62) 100%)'
          }}
        />
      </div>

      {/* 前景内容区：精巧圆形头像 + 温润字号标题 + 微光分割线 + 打字机标语 */}
      <div className='relative z-10 text-white flex flex-col items-center justify-center w-full px-4'>
        {avatarSrc && (
          <div className='hero-avatar-ring mb-4 w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden select-none'>
            <LazyImage
              priority
              src={avatarSrc}
              alt={siteInfo?.title || siteConfig('TITLE')}
              className='w-full h-full object-cover object-center'
            />
          </div>
        )}

        {/* 站点标题（字号收紧为 30px~36px，文楷更显秀气高级） */}
        <div className='font-bold text-2xl sm:text-3xl md:text-4xl tracking-widest shadow-text-md text-center'>
          {siteInfo?.title || siteConfig('TITLE')}
        </div>

        {/* 中心向两端渐隐的微光分割线 */}
        <div
          className='w-40 sm:w-56 h-[1px] my-3.5 opacity-80'
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%)'
          }}
        />

        {/* 打字机欢迎语 */}
        <div className='min-h-[26px] flex items-center justify-center text-center font-light tracking-wider text-white/90 text-sm sm:text-base'>
          <span id='typed' />
        </div>

        {siteConfig('HEXO_HOME_NAV_BUTTONS', null, CONFIG) && (
          <div className='mt-4'>
            <NavButtonGroup {...props} />
          </div>
        )}
      </div>

      <style jsx>{`
        .hero-avatar-ring {
          box-shadow: 0 10px 28px -6px rgba(0, 0, 0, 0.5), 0 0 0 2.5px rgba(255, 255, 255, 0.25);
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.4s ease;
        }
        .hero-avatar-ring:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 14px 32px -6px rgba(0, 0, 0, 0.6), 0 0 0 3.5px rgba(255, 255, 255, 0.38);
        }
      `}</style>
    </header>
  )
}

export default Hero
