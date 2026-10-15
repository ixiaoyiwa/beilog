import NotionPage from '@/components/NotionPage'
import Comment from '@/components/Comment'
import FriendCard from './FriendCard'

const ROLE_ORDER = ['守夜人', '夜谈人', '酿酒人', '调酒人']

const FriendsPage = ({ post, friends = [], tagOptions = [] }) => {
  const mergedMembers = [...friends]

  if (tagOptions && tagOptions.length > 0) {
    tagOptions.forEach(tag => {
      if (!mergedMembers.some(f => f.name === tag.name)) {
        mergedMembers.push({
          id: `missing-${tag.name}`,
          name: tag.name,
          role: '调酒人',
          status: '未知'
        })
      }
    })
  }

  const groups = []
  const groupMap = {}

  mergedMembers.forEach(f => {
    const role = f.role || '其他'
    if (!groupMap[role]) {
      groupMap[role] = { role, members: [] }
      groups.push(groupMap[role])
    }
    groupMap[role].members.push(f)
  })

  groups.sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(a.role)
    const ib = ROLE_ORDER.indexOf(b.role)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })

  return (
    <div className='w-full lg:hover:shadow lg:border rounded-t-xl lg:rounded-xl lg:px-2 lg:py-4 bg-white dark:bg-hexo-black-gray dark:border-black article'>
      <div className='w-full md:px-5 px-2'>
        {post && (
          // 注意这里：加上了 -mt-10，强行把整个内容往上拉，切掉空白！
          // 如果觉得拉得还不够，就把 -mt-10 改成 -mt-16 或 -mt-20
          <div className='friends-notion-content -mt-10'> 
            <NotionPage post={post} />
          </div>
        )}

        {groups.length > 0 && (
          <div className='mt-2'>
            {groups.map(group => (
              <section key={group.role} className='mb-16 last:mb-0'>
                <div className='mb-6 text-center'>
                  <h2 className='text-2xl font-bold text-gray-800 dark:text-gray-100 text-center'>
                    {group.role}
                  </h2>
                  <div
                    className='mt-3 border-b border-dotted'
                    style={{ borderColor: 'var(--hexo-color-border)' }}
                  />
                </div>

                <div className='grid grid-cols-3 lg:grid-cols-6 gap-2'>
                  {group.members.map(member => (
                    <FriendCard key={member.id || member.name} member={member} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {post && (
          <div className='mt-10 duration-200 overflow-x-auto px-3'>
            <Comment frontMatter={post} />
          </div>
        )}

        <style jsx global>{`
          /* 1. 强力隐藏，绝对不占一点空间 */
          .friends-notion-content .notion-collection,
          .friends-notion-content .notion-collection-view,
          .friends-notion-content .notion-collection-view-tabs-content,
          .friends-notion-content .notion-collection_view-block,
          .friends-notion-content .notion-table,
          .friends-notion-content .notion-board,
          .friends-notion-content .notion-gallery,
          .friends-notion-content [class*='notion-collection'],
          .friends-notion-content [class*='notion-table'],
          .friends-notion-content [class*='notion-board'],
          .friends-notion-content [class*='notion-gallery'] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            border: 0 !important;
          }

          /* 2. 清除父容器的内外边距 */
          .friends-notion-content .notion-page-content > *:has([class*='notion-collection']),
          .friends-notion-content .notion-page-content > *:has([class*='notion-table']),
          .friends-notion-content .notion-page-content > *:has([class*='notion-board']),
          .friends-notion-content .notion-page-content > *:has([class*='notion-gallery']) {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* 3. 清理最外层 */
          .friends-notion-content {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
          }
          
          .friends-notion-content .notion-page-content {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }

          /* 4. 清理空块 */
          .friends-notion-content .notion-page-content > div:empty {
            display: none !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        `}</style>
      </div>
    </div>
  )
}

export default FriendsPage
