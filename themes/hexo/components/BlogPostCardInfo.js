import NotionIcon from '@/components/NotionIcon'
import NotionPage from '@/components/NotionPage'
import TwikooCommentCount from '@/components/TwikooCommentCount'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { getCategoryUrl } from '@/lib/utils/category'
import SmartLink from '@/components/SmartLink'

const SUMMARY_MAX = 68

const truncateSummary = text => {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= SUMMARY_MAX) return clean
  return clean.slice(0, SUMMARY_MAX).trim() + '...'
}

const extractEpisodeNumber = slug => {
  if (!slug) return ''
  const match = String(slug).match(/(\d+)(?!.*\d)/)
  return match ? match[1] : ''
}

export const BlogPostCardInfo = ({
  post,
  showPreview,
  showPageCover,
  showSummary,
  isPinned = false,
  isLatest = false
}) => {
  const { NOTION_CONFIG } = useGlobal()

  const guests = post?.tagItems || []
  const visibleGuests = guests.slice(0, 3)
  const extraCount = guests.length - 3

  const episodeNumber = extractEpisodeNumber(post?.slug)

  return (
    <article
      className={`flex flex-col justify-between lg:p-6 p-4 lg:px-8 px-6 ${showPageCover && !showPreview ? 'md:w-[62%] w-full md:max-h-60' : 'w-full'}`}>
      <div>
        <header>
          <h2>
            <SmartLink
              href={post?.href}
              passHref
              className={`line-clamp-2 replace cursor-pointer text-2xl ${
                showPreview ? 'text-center' : ''
              } leading-tight font-bold text-gray-600 dark:text-gray-100 hover:text-indigo-700 dark:hover:text-indigo-400`}>
              {/* 新增：置顶标签 */}
              {isPinned && (
                <span className='inline-block px-1.5 py-0.5 text-[10px] font-medium rounded mr-1.5 align-middle bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'>
                  置顶
                </span>
              )}
              {/* 新增：最新标签 */}
              {isLatest && (
                <span className='inline-block px-1.5 py-0.5 text-[10px] font-medium rounded mr-1.5 align-middle bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300'>
                  最新
                </span>
              )}
              {siteConfig('POST_TITLE_ICON') && (
                <NotionIcon icon={post.pageIcon} />
              )}
              <span className='menu-link '>{post.title}</span>
            </SmartLink>
          </h2>

          <div
            className={`flex mt-2 mb-1 items-center ${
              showPreview ? 'justify-center' : 'justify-start'
            } flex-wrap gap-y-1 text-sm dark:text-gray-500 text-gray-400`}>
            {episodeNumber && (
              <>
                <SmartLink
                  href={post?.href}
                  passHref
                  className='font-normal menu-link cursor-pointer hover:text-indigo-700 dark:hover:text-indigo-400 transform'>
                  E{episodeNumber}
                </SmartLink>
                <span className='mr-1.5'></span>
              </>
            )}

            {post?.category && (
              <>
                <SmartLink
                  href={getCategoryUrl(post.category, NOTION_CONFIG)}
                  passHref
                  className='font-normal cursor-pointer menu-link hover:text-indigo-700 dark:hover:text-indigo-400 transform'>
                  {post.category}
                </SmartLink>
                <span className='mx-1.5 text-gray-300 dark:text-gray-700'>
                  /
                </span>
              </>
            )}

            {/* 纯文本，不跳转，无悬停变色 */}
            <span className='font-light'>
              {post?.publishDay || post.date}
            </span>

            {visibleGuests.length > 0 && (
              <>
                <span className='mx-1.5 text-gray-300 dark:text-gray-700'>
                  /
                </span>
                <div className='flex flex-wrap items-center gap-x-2'>
                  {visibleGuests.map(tag => (
                    <SmartLink
                      key={tag.name}
                      href={`/tag/${encodeURIComponent(tag.name)}`}
                      passHref
                      legacyBehavior>
                      <span className='font-light menu-link cursor-pointer hover:text-indigo-700 dark:hover:text-indigo-400 transform whitespace-nowrap'>
                        {tag.name}
                      </span>
                    </SmartLink>
                  ))}
                  {extraCount > 0 && (
                    <span className='font-light whitespace-nowrap'>
                      +{extraCount}
                    </span>
                  )}
                </div>
              </>
            )}

            <TwikooCommentCount
              className='ml-2 hover:text-indigo-700 dark:hover:text-indigo-400'
              post={post}
            />
          </div>
        </header>

        {(!showPreview || showSummary) && !post.results && (
          <main className='line-clamp-3 replace my-4 text-gray-700 dark:text-gray-300 text-md font-normal leading-relaxed'>
            {truncateSummary(post.summary)}
          </main>
        )}

        {post.results && (
          <p className='line-clamp-3 mt-4 text-gray-700 dark:text-gray-300 text-sm font-light leading-relaxed'>
            {post.results.map((r, index) => (
              <span key={index}>{r}</span>
            ))}
          </p>
        )}

        {showPreview && (
          <div className='overflow-ellipsis truncate'>
            <NotionPage post={post} />
          </div>
        )}
      </div>
    </article>
  )
}
