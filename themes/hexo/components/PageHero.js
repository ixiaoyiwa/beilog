import LazyImage from '@/components/LazyImage'
import NotionIcon from '@/components/NotionIcon'
import { siteConfig } from '@/lib/config'

/**
 * 普通页面 / 节目页 Hero
 *
 * 与单期节目 PostHero 分开：
 * - 单期节目：继续使用 PostHero，完全保持现状
 * - 普通 Page / Episodes：使用本组件，Hero 高度为单期的一半
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
      className='w-full h-48 md:h-[40vh] relative md:flex-shrink-0 z-10 mb-8'>
      <LazyImage
        priority={true}
        src={headerImage}
        className='w-full h-full object-cover object-center absolute top-0'
      />

      <header
        id='article-header-cover'
        className='bg-black bg-opacity-70 absolute top-0 w-full h-full flex items-center'>
        <div className='w-full px-4 md:px-8 lg:px-24'>
          <div className='w-full mx-auto lg:flex lg:space-x-4 justify-center'>
            {/*
             * PC：
             * 保持与原 PostHero 相同的正文主栏定位。
             *
             * 手机：
             * 整个内容块缩窄并水平居中，
             * 但内容本身保持 text-left。
             */}
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
