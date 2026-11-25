import LazyImage from '@/components/LazyImage'
import NotionIcon from '@/components/NotionIcon'
import { siteConfig } from '@/lib/config'

/**
 * 普通页面 / 节目页 Hero
 * 保持原有紧凑高度与酒馆插画背景，底部轻微向下延伸并做平缓透明羽化，消除硬分割线
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
      {/* 背景层：轻微向下延伸 96px 铺到正文卡片背后，内联多段透明羽化（零白边、零延迟） */}
      <div
        className='absolute inset-x-0 top-0 -bottom-24 pointer-events-none select-none overflow-hidden'
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 55%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0.42) 84%, rgba(0,0,0,0.12) 93%, rgba(0,0,0,0) 100%)',
          maskImage:
            'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 55%, rgba(0,0,0,0.8) 70%, rgba(0,0,0,0.42) 84%, rgba(0,0,0,0.12) 93%, rgba(0,0,0,0) 100%)'
        }}>
        <LazyImage
          priority={true}
          src={headerImage}
          className='w-full h-full object-cover object-center absolute top-0'
        />
        <div className='bg-black bg-opacity-65 absolute inset-0' />
      </div>

      {/* 前景内容层：保持原有紧凑高度与左对齐排版一像素不变 */}
      <header
        id='article-header-cover'
        className='relative z-10 w-full h-full flex items-center'>
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
