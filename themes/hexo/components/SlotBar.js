import SmartLink from '@/components/SmartLink'

/**
 * 博客列表上方嵌入条
 * @param {*} props
 * @returns
 */
export default function SlotBar(props) {
  const {
    tag,
    category,
    friends = [],
    categories = [],
    categoryOptions = []
  } = props

  // 分类简介映射表
  const introMap = {
    '展信安': '见字如面，借一点慢下来的仪式感，让故事有处可放，让心事有处可安。',
    'Letters': '见字如面，借一点慢下来的仪式感，让故事有处可放，让心事有处可安。',
    '碎碎念': '一闪念、一程路、几帧光影……录成声音日记，慢慢拼凑出真实的自己。',
    'Musings': '一闪念、一程路、几帧光影……录成声音日记，慢慢拼凑出真实的自己。',
    '慢漫聊': '把生活里的琐碎，慢慢聊出点滋味。要是有一句，说到你心里，就够了。',
    'Talks': '把生活里的琐碎，慢慢聊出点滋味。要是有一句，说到你心里，就够了。'
  }

  const categoryCountSource = Array.isArray(categories) && categories.length > 0
    ? categories
    : Array.isArray(categoryOptions)
      ? categoryOptions
      : []

  const normalizeCategoryName = value => String(value ?? '').trim().toLowerCase()

  const categoryDefinitions = [
    { id: 'Letters', name: '展信安', icon: 'far fa-folder-open', aliases: ['Letters', '展信安'] },
    { id: 'Musings', name: '碎碎念', icon: 'far fa-folder-open', aliases: ['Musings', '碎碎念'] },
    { id: 'Talks', name: '慢漫聊', icon: 'far fa-folder-open', aliases: ['Talks', '慢漫聊'] }
  ]

  const categoryTabs = categoryDefinitions.map(tab => {
    const aliases = tab.aliases.map(normalizeCategoryName)
    const matchedCategory = categoryCountSource.find(item =>
      aliases.includes(normalizeCategoryName(item?.name))
    )
    const parsedCount = Number(matchedCategory?.count)

    return {
      id: tab.id,
      name: tab.name,
      icon: tab.icon,
      count: Number.isFinite(parsedCount) && parsedCount >= 0 ? parsedCount : 0
    }
  })

  // Notion 颜色映射
  const colorMap = {
    default: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    brown: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300',
    pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/60 dark:text-pink-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300'
  }

  if (tag) {
    const friendData = friends.find(f => f.name === tag)
    const title = friendData?.title
    const titleColor = colorMap[friendData?.color] || colorMap.default
    return (
      <div className="cursor-pointer px-3 py-2 mb-2 font-light hover:text-[#C87A38] dark:hover:text-[#D68744] transform dark:text-white">
        <SmartLink
          key={tag}
          href={`/tag/${encodeURIComponent(tag)}`}
          passHref
          className={'cursor-pointer inline-block rounded duration-200 mr-2 py-0.5 px-1 text-xl whitespace-nowrap '}>
          <div className='font-light dark:text-gray-400 dark:hover:text-white'>
            <i className='fa fa-user mr-1' />{tag}
            {title && (
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${titleColor}`}>
                {title}
              </span>
            )}
          </div>
        </SmartLink>
      </div>
    )
  } else if (category) {
    const introText = introMap[category]
    return (
      <div className={`px-4 py-1 ${introText ? 'mb-6' : 'mb-2'}`}>
        {/* 分类切换 Tab 栏：#C87A38 焦糖暖琥珀 + 首页同款 3D 立体微拟物按键质感 */}
        <div className="flex flex-wrap gap-3 mb-4">
          {categoryTabs.map(tab => {
            const isActive = category === tab.id || category === tab.name
            return (
              <SmartLink
                key={tab.id}
                href={`/category/${tab.id}`}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-all duration-300 cursor-pointer whitespace-nowrap hover:-translate-y-0.5
                  ${isActive
                    ? 'text-white font-medium'
                    : 'text-gray-700 dark:text-gray-200 bg-white dark:bg-white/[0.08] border border-black/[0.08] dark:border-white/15 hover:border-[#C87A38]/50 hover:text-[#C87A38] dark:hover:text-[#E09250]'
                  }`}
                style={
                  isActive
                    ? {
                        background: 'linear-gradient(180deg, #D68744 0%, #B86828 100%)',
                        border: '1px solid rgba(110, 48, 12, 0.45)',
                        boxShadow:
                          'inset 0 1px 0 rgba(255, 255, 255, 0.34), inset 0 -1px 0 rgba(0, 0, 0, 0.22), 0 8px 20px -6px rgba(200, 122, 56, 0.45)'
                      }
                    : {
                        boxShadow:
                          'inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 2px 6px -1px rgba(0, 0, 0, 0.05)'
                      }
                }
              >
                <i className={`${isActive ? 'far fa-folder-open' : 'far fa-folder'} text-xs`} />
                <span>{tab.name}</span>
                <span className={`text-[11px] ${isActive ? 'opacity-85' : 'opacity-60'}`}>
                  ({tab.count})
                </span>
              </SmartLink>
            )
          })}
        </div>
        {/* 简介文字 */}
        {introText && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed break-words">
            {introText}
          </p>
        )}
      </div>
    )
  }
  return <></>
}
