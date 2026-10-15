const LayoutPostList = props => {
  const router = useRouter()
  const isHomePage = router.route === '/'
  const { posts = [], siteInfo } = props

  const showSummary = siteConfig('HEXO_POST_LIST_SUMMARY', null, CONFIG)
  const postsPerPage = siteConfig('POSTS_PER_PAGE', 6, CONFIG)

  if (isHomePage) {
    // ================= 首页专属排序逻辑 =================
    
    // 辅助函数1：安全提取 Notion Featured 字段的文本值（兼容字符串、对象、数组）
    const getFeaturedText = (post) => {
      const val = post.Featured || post.featured;
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) {
        return val.map(v => typeof v === 'string' ? v : v?.name || '').join(',');
      }
      if (typeof val === 'object' && val.name) return val.name;
      return String(val);
    }

    // 辅助函数2：获取发布时间戳
    const getDateVal = p => new Date(p.date?.start_date || p.date || 0).getTime()
    // 辅助函数3：按时间倒序（最新在前）
    const sortByDateDesc = (a, b) => getDateVal(b) - getDateVal(a)

    // 1. 过滤并全量按时间倒序
    const validPosts = posts.filter(p => p?.type === 'Post').sort(sortByDateDesc)

    // 2. 分组筛选
    const pinnedList = validPosts.filter(p => getFeaturedText(p).includes('置顶'))
    const featuredList = validPosts.filter(p => getFeaturedText(p).includes('精选'))

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

    // 最新：从普通池中取时间最新的 1 条
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
