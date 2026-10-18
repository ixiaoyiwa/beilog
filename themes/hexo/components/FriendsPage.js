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
    // ⭐ 修改点：将原 lg:pt-10 改为 pt-10。让手机端也有顶部间距。
    <div className='w-full lg:hover:shadow lg:border rounded-t-xl lg:rounded-xl lg:px-2 pt-10 lg:pb-4 bg-white dark:bg-hexo-black-gray dark:border-black article'>
      <div className='w-full md:px-5 px-2'>
        
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
      </div>
    </div>
  )
}

export default FriendsPage
