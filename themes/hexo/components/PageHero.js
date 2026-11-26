import LazyImage from '@/components/LazyImage'
import NotionIcon from '@/components/NotionIcon'
import { siteConfig } from '@/lib/config'

/**
 * 普通页面 / 节目页 / 栏目页 Hero
 * 照猫画虎单期页（PostHero）的“向下延伸 + 15% 起 7 段超长慢渐变消散”公式，白天与黑夜模式均自然融底
 */
export default function PageHero({ post, siteInfo }) {
  if (!post) {
    return null
  }

  const headerImage = post?.pageCover
    ? post.pageCover
    : siteInfo?.pageCover

  return (
    <div
      id='header'
      className='w-full h-40 md:h-[220px] relative md:flex-shrink-0 z-10 mb-2'>
      {/* 背景层：向下延伸 176px 铺进下方卡片背后，采用单期页同款 15% 起 7 段超长慢渐变消散 */}
      <div
        className='absolute inset-x-0 top-0 -bottom-44 pointer-events-none select-none overflow-hidden'
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 15%, rgba(0,0,0,0.74) 36%, rgba(0,0,0,0.5) 56%, rgba(0,0,0,0.26) 74%, rgba(0,0,0,0.08) 89%, rgba(0,0,0,0) 100%)',
          maskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 15%, rgba(0,0,0,0.74) 36%, rgba(0,0,0,0.5) 56%, rgba(0,0,0,0.26) 74%, rgba(0,0,0,0.08) 89%, rgba(0,0,0,0) 100%)'
        }}>
        <LazyImage
          priority={true}
          src={headerImage}
          className='w-full h-full object-cover object-center absolute top-0'
        />
        {/* 白天清透文字保护层 + 夜间暗调层（避免白天半透明过黑产生灰白脏雾） */}
        <div className='bg-black/45 dark:bg-black/60 absolute inset-0' />
      </div>

      {/* 前景内容层：保持左对齐排版，与下方主内容栏严格对齐 */}
      <header
        id='article-header-cover'
        className='relative z-10 w-full h-full flex items-center pt-8 md:pt-10'>
        <div className='w-full px-4 md:px-8 lg:px-24'>
          <div className='w-full mx-auto lg:flex lg:space-x-4 justify-center'>
            <div className='w-full max-w-4xl md:pl-5'>
              <div className='w-full max-w-[92%] mx-auto md:max-w-none md:mx-0 md:pl-5 text-left'>
                <div className='leading-snug font-bold text-3xl sm:text-4xl md:leading-snug shadow-text-md text-white text-left'>
                  {siteConfig('POST_TITLE_ICON') &&
                    post.pageIcon && (
                      <NotionIcon
                        icon={post.pageIcon}
                        className='text-3xl sm:text-4xl mr-1 inline-block'
                      />
                    )}

                  {post.title || post.name}
                </div>
              </div>
            </div>

            <div className='hidden lg:block lg:w-80 flex-shrink-0'></div>
          </div>
        </div>
      </header>
    </div>
  )
}
