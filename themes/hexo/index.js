import Comment from '@/components/Comment'
import replaceSearchResult from '@/components/Mark'
import NotionPage from '@/components/NotionPage'
import ShareBar from '@/components/ShareBar'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { isBrowser } from '@/lib/utils'
import { getCategoryUrl } from '@/lib/utils/category'
import { Transition } from '@headlessui/react'
import dynamic from 'next/dynamic'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'
import { createContext, useContext, useEffect, useRef } from 'react'
import ArticleAdjacent from './components/ArticleAdjacent'
import ArticleCopyright from './components/ArticleCopyright'
import { ArticleLock } from './components/ArticleLock'
import ArticleRecommend from './components/ArticleRecommend'
import BlogPostArchive from './components/BlogPostArchive'
import BlogPostCard from './components/BlogPostCard'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import ButtonJumpToComment from './components/ButtonJumpToComment'
import Card from './components/Card'
import Footer from './components/Footer'
import Header from './components/Header'
import Hero from './components/Hero'
import PostHero from './components/PostHero'
import PageHero from './components/PageHero'
import RightFloatArea from './components/RightFloatArea'
import SearchNav from './components/SearchNav'
import SideRight from './components/SideRight'
import SlotBar from './components/SlotBar'
import TagItemMini from './components/TagItemMini'
import TocDrawer from './components/TocDrawer'
import TocDrawerButton from './components/TocDrawerButton'
import ArticleSwitchPlaceholder from './components/ArticleSwitchPlaceholder'
import NotionAudioEnhancer from './components/NotionAudioEnhancer'
import GlobalAudioPlayer from './components/GlobalAudioPlayer'
import EpisodesPage from './components/EpisodesPage'
import FriendsPage from './components/FriendsPage'
import TimestampLinker from './components/TimestampLinker'
import CONFIG from './config'
import { Style } from './style'

const AlgoliaSearchModal = dynamic(
  () => import('@/components/AlgoliaSearchModal'),
  { ssr: false }
)

const ThemeGlobalHexo = createContext()

export const useHexoGlobal = () => useContext(ThemeGlobalHexo)

const LayoutBase = props => {
  const { post, children, slotTop, className } = props
  const { onLoading, fullWidth: globalFullWidth } = useGlobal()
  const fullWidth = globalFullWidth || props.fullWidth
  const hideSidebar = !!props.hideSidebar
  const router = useRouter()

  const isArticleSlugPage = router.pathname === '/[prefix]/[slug]'
  const isEpisodesPage = router.route === '/episodes' || router.route === '/episodes/page/[page]'

  const hexoArticleRouteLoading = siteConfig('HEXO_ARTICLE_ROUTE_LOADING', true, CONFIG)

  const showArticleSwitchPlaceholder = hexoArticleRouteLoading && isArticleSlugPage && onLoading

  const findEpisodesMenuItem = menus => {
    if (!Array.isArray(menus)) return null
    for (const item of menus) {
      if (!item) continue
      const href = String(item.href || '').replace(/\/+$/, '')
      const slug = String(item.slug || '').replace(/^\/+|\/+$/g, '')
      if (href === '/episodes' || slug === 'episodes') return item
      if (Array.isArray(item.subMenus)) {
        const found = findEpisodesMenuItem(item.subMenus)
        if (found) return found
      }
    }
    return null
  }

  const episodesMenuItem = isEpisodesPage ? findEpisodesMenuItem(props.customMenu) : null
  const episodesHeroPost = isEpisodesPage
    ? {
        type: 'Page',
        title: episodesMenuItem?.title || episodesMenuItem?.name || '节目',
        pageCover: props?.siteInfo?.pageCover,
        pageIcon: episodesMenuItem?.icon || null
      }
    : null

  const headerSlot =
    post?.type === 'Post' ? (
      <PostHero {...props} />
    ) : post ? (
      <PageHero post={post} siteInfo={props.siteInfo} />
    ) : episodesHeroPost ? (
      <PageHero post={episodesHeroPost} siteInfo={props.siteInfo} />
    ) : router.route === '/' && siteConfig('HEXO_HOME_BANNER_ENABLE', null, CONFIG) ? (
      <Hero {...props} />
    ) : null

  const isHomeWithHero = router.route === '/' && siteConfig('HEXO_HOME_BANNER_ENABLE', null, CONFIG)

  const drawerRight = useRef(null)
  const tocRef = isBrowser ? document.getElementById('article-wrapper') : null

  const floatSlot = (
    <>
      {post?.toc?.length > 1 && (
        <div className='block lg:hidden'>
          <TocDrawerButton
            onClick={() => {
              drawerRight?.current?.handleSwitchVisible()
            }}
          />
        </div>
      )}
      {post && <ButtonJumpToComment />}
    </>
  )

  const searchModal = useRef(null)
  const hasPageHero = !!post || isEpisodesPage
  const mainTopPadding = hasPageHero ? 'pt-0' : isHomeWithHero ? 'pt-8' : 'pt-24'

  return (
    <ThemeGlobalHexo.Provider value={{ searchModal }}>
      <div id='theme-hexo' className={`${siteConfig('FONT_STYLE')} dark:bg-black scroll-smooth`}>
        <Style />
        <Header {...props} />
        <Transition
          show={!onLoading}
          appear={true}
          enter='transition ease-in-out duration-700 transform order-first'
          enterFrom='opacity-0 -translate-y-16'
          enterTo='opacity-100'
          leave='transition ease-in-out duration-300 transform'
          leaveFrom='opacity-100'
          leaveTo='opacity-0 translate-y-16'
          unmount={false}>
          {headerSlot}
        </Transition>
        <main
          id='wrapper'
          className={`${mainTopPadding} bg-hexo-background-gray dark:bg-black w-full md:px-8 lg:px-24 min-h-screen relative`}>
          <div
            id='container-inner'
            className={
              (JSON.parse(siteConfig('LAYOUT_SIDEBAR_REVERSE')) ? 'flex-row-reverse' : '') +
              ' w-full mx-auto lg:flex lg:space-x-4 justify-center relative z-10'
            }>
            <div className={`${className || ''} w-full ${fullWidth ? '' : 'max-w-4xl'} h-full overflow-hidden`}>
              {showArticleSwitchPlaceholder ? (
                <ArticleSwitchPlaceholder />
              ) : (
                <Transition
                  show={isArticleSlugPage ? true : !onLoading}
                  appear={true}
                  enter='transition ease-in-out duration-700 transform order-first'
                  enterFrom='opacity-0 translate-y-16'
                  enterTo='opacity-100'
                  leave='transition ease-in-out duration-300 transform'
                  leaveFrom='opacity-100 translate-y-0'
                  leaveTo='opacity-0 -translate-y-16'
                  unmount={false}>
                  {slotTop}
                  {children}
                </Transition>
              )}
            </div>
            {!hideSidebar && <SideRight {...props} />}
          </div>
        </main>
        <div className='block lg:hidden'>
          <TocDrawer post={post} cRef={drawerRight} targetRef={tocRef} />
        </div>
        <RightFloatArea floatSlot={floatSlot} />
        <AlgoliaSearchModal cRef={searchModal} {...props} />
        <GlobalAudioPlayer />
        <Footer title={siteConfig('TITLE')} />
      </div>
    </ThemeGlobalHexo.Provider>
  )
}

const LayoutIndex = props => {
  return <LayoutPostList {...props} />
}

const LayoutPostList = props => {
  const router = useRouter()
  const isHomePage = router.route === '/'
  const { posts = [], siteInfo } = props

  const showSummary = siteConfig('HEXO_POST_LIST_SUMMARY', null, CONFIG)
  const postsPerPage = siteConfig('POSTS_PER_PAGE', 6, CONFIG)

  if (isHomePage) {
    // ================= 首页专属排序逻辑 =================
    
    // 辅助函数：获取发布时间戳
    const getDateVal = p => new Date(p.date?.start_date || p.date || 0).getTime()
    // 辅助函数：按时间倒序（最新在前）
    const sortByDateDesc = (a, b) => getDateVal(b) - getDateVal(a)

    // 1. 过滤并全量按时间倒序
    const validPosts = posts.filter(p => p?.type === 'Post').sort(sortByDateDesc)

    // 2. 分组筛选
    const pinnedList = validPosts.filter(p => String(p.Featured || '').includes('置顶'))
    const featuredList = validPosts.filter(p => String(p.Featured || '').includes('精选'))

    // 3. 名额约束处理
    // 置顶：最多 1 条（取发布时间最新的）
    const finalPinned = pinnedList.slice(0, 1)
    const pinnedIds = finalPinned.map(p => p.id)

    // 精选：最多 3 条（排除已选为置顶的，取时间最新的前3条）
    const finalFeatured = featuredList
      .filter(p => !pinnedIds.includes(p.id))
      .slice(0, 3)
    const featuredIds = finalFeatured.map(p => p.id)

    // 普通池：排除置顶和精选
    const remainingPosts = validPosts.filter(
      p => !pinnedIds.includes(p.id) && !featuredIds.includes(p.id)
    )

    // 最新：从普通池中取时间最新的 1 条（代码自动识别，无需在 Notion 勾选）
    const finalLatest = remainingPosts.slice(0, 1)
    const latestIds = finalLatest.map(p => p.id)

    // 剩下的普通文章
    const finalNormal = remainingPosts.filter(p => !latestIds.includes(p.id))

    // 4. 合并并截取前 6 条
    const homePosts = [...finalPinned, ...finalFeatured, ...finalLatest, ...finalNormal].slice(0, postsPerPage)

    // 5. 给每篇文章打上专属的 featuredType 标签
    const homePostsWithType = homePosts.map(post => {
      let featuredType = null
      if (pinnedIds.includes(post.id)) featuredType = 'pinned'
      else if (featuredIds.includes(post.id)) featuredType = 'featured'
      else if (latestIds.includes(post.id)) featuredType = 'latest'
      return { ...post, featuredType }
    })

    return (
      <div>
        <SlotBar {...props} />
        <div className='space-y-6 px-2'>
          {homePostsWithType.map((post, index) => (
            <BlogPostCard
              key={post.id}
              post={post}
              index={index}
              showSummary={showSummary}
              siteInfo={siteInfo}
            />
          ))}
        </div>
        <div className='mt-8 mb-4 text-center'>
          <SmartLink
            href='/episodes'
            className='inline-block px-6 py-2 text-sm font-semibold rounded-lg border-2 transition-colors border-[var(--theme-color)] text-[var(--theme-color)] hover:bg-[var(--theme-color)] hover:text-white'>
            查看更多节目 ···
          </SmartLink>
        </div>
      </div>
    )
  }

  // 非首页：保持原样，不做任何排序和标签干预
  return (
    <div>
      <SlotBar {...props} />
      {siteConfig('POST_LIST_STYLE') === 'page' ? (
        <BlogPostListPage {...props} />
      ) : (
        <BlogPostListScroll {...props} />
      )}
    </div>
  )
}

// ... 后面的 LayoutSearch, LayoutArchive 等保持完全不变 ...
