import LazyImage from '@/components/LazyImage'
import NotionIcon from '@/components/NotionIcon'
import { siteConfig } from '@/lib/config'

/**
 * 普通页面 / 节目页 / 栏目页 Hero
 * 收紧至 220px 紧凑黄金高度 + 双模式无缝融底（彻底消除半透明黑叠加产生的灰白脏雾）
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
      className='w-full h-40 md:h-[220px] relative md:flex-shrink-0 z-10 mb-2 overflow-hidden'>
      {/* 背景层：酒馆插画 + 双模式底色平滑融底，绝不产生灰白脏雾带 */}
      <div className='absolute inset-0 pointer-events-none select-none overflow-hidden'>
        <LazyImage
          priority={true}
          src={headerImage}
          className='w-full h-full object-cover object-center absolute top-0'
        />
        {/* 暗调文字保护遮罩 */}
        <div className='bg-black/55 dark:bg-black/65 absolute inset-0' />

        {/* 底部平滑融底：白天直接融进网页暖米色底，夜间直接融进纯黑底 */}
        <div
          className='dark:hidden absolute inset-x-0 bottom-0 h-16'
          style={{
            background:
              'linear-gradient(to bottom, rgba(245, 244, 240, 0) 0%, rgba(245, 244, 240, 0.65) 60%, rgba(245, 244, 240, 1) 100%)'
          }}
        />
        <div
          className='hidden dark:block absolute inset-x-0 bottom-0 h-16'
          style={{
            background:
              'linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.65) 60%, rgba(0, 0, 0, 1) 100%)'
          }}
        />
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
