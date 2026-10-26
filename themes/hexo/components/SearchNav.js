import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import SmartLink from '@/components/SmartLink'
import { getCategoryUrl } from '@/lib/utils/category'
import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Card from './Card'
import SearchInput from './SearchInput'
import TagItemMini from './TagItemMini'

const AlgoliaSearchPage = dynamic(
  () => import('@/components/AlgoliaSearchPage'),
  { ssr: false }
)

/**
 * 搜索页面的导航。
 * 只把原输入框替换成内嵌式 Algolia 搜索；栏目和标签（参创）原样保留。
 */
export default function SearchNav(props) {
  const { tagOptions, categoryOptions } = props
  const cRef = useRef(null)
  const { locale, NOTION_CONFIG } = useGlobal()
  const algoliaReady = Boolean(
    siteConfig('ALGOLIA_APP_ID') &&
    siteConfig('ALGOLIA_SEARCH_ONLY_APP_KEY') &&
    siteConfig('ALGOLIA_INDEX')
  )

  useEffect(() => {
    if (!algoliaReady) cRef?.current?.focus()
  }, [algoliaReady])

  return (
    <>
      <div className='my-6 px-2'>
        {algoliaReady ? (
          <AlgoliaSearchPage />
        ) : (
          <SearchInput cRef={cRef} {...props} />
        )}
        {/* 分类列表保留原样 */}
        <Card className='w-full mt-4'>
          <div className='dark:text-gray-200 mb-5 mx-3'>
            {/* ⚠️ 图标改成了 layer-group */}
            <i className='mr-4 fa-solid fa-layer-group' />
            {locale.COMMON.CATEGORY}:
          </div>
          <div id='category-list' className='duration-200 flex flex-wrap mx-8'>
            {categoryOptions?.map(category => {
              return (
                <SmartLink
                  key={category.name}
                  href={getCategoryUrl(category.name, NOTION_CONFIG)}
                  passHref
                  legacyBehavior>
                  <div
                    className={
                      ' duration-300 dark:hover:text-white rounded-lg px-5 cursor-pointer py-2 hover:bg-indigo-400 hover:text-white'
                    }>
                    <i className='mr-4 fas fa-folder' />
                    {category.name}({category.count})
                  </div>
                </SmartLink>
              )
            })}
          </div>
        </Card>
        {/* 标签 / 参创列表保留原样 */}
        <Card className='w-full mt-4'>
          <div className='dark:text-gray-200 mb-5 ml-4'>
            {/* ⚠️ 图标改成了 users */}
            <i className='mr-4 fa-solid fa-users' />
            {locale.COMMON.TAGS}:
          </div>
          <div id='tags-list' className='duration-200 flex ml-8 flex-wrap'>
            {tagOptions?.map(tag => {
              return (
                <div key={tag.name} className='p-2'>
                  <TagItemMini key={tag.name} tag={tag} />
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </>
  )
}
