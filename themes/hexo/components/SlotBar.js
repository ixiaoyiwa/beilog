import SmartLink from '@/components/SmartLink'

/**
 * 博客列表上方嵌入条
 * @param {*} props
 * @returns
 */
export default function SlotBar(props) {
  const { tag, category, friends = [] } = props

  // 分类简介映射表
  const introMap = {
    '展信安': '一封封来信里，有藏了很久的心事，也有不忍遗忘的生活瞬间。每一封，都值得被看见，被好好接住。愿写信、读信、听信的人，皆安。',
    'Letters': '一封封来信里，有藏了很久的心事，也有不忍遗忘的生活瞬间。每一封，都值得被看见，被好好接住。愿写信、读信、听信的人，皆安。',
    '碎碎念': '从一个微小的念头，或一段经历说起。以清醒而温柔的老友视角，陪你坦然面对那些隐秘的情绪，看见真实、细腻而又丰富的内心世界。',
    'Musings': '从一个微小的念头，或一段经历说起。以清醒而温柔的老友视角，陪你坦然面对那些隐秘的情绪，看见真实、细腻而又丰富的内心世界。',
    '慢漫聊': '我们聊的，可能是正上头的新鲜事，也可能是绕不开的困惑和迷茫。不急着下结论，也不用非得有意义。要是刚好有一句触动到你，就够了。',
    'Talks': '我们聊的，可能是正上头的新鲜事，也可能是绕不开的困惑和迷茫。不急着下结论，也不用非得有意义。要是刚好有一句触动到你，就够了。'
  }

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
    // 查找当前 tag 对应的朋友数据
    const friendData = friends.find(f => f.name === tag)
    const title = friendData?.title
    const titleColor = colorMap[friendData?.color] || colorMap.default

    return (
      <div className="cursor-pointer px-3 py-2 mb-2 font-light hover:text-indigo-700 dark:hover:text-indigo-400 transform dark:text-white">
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
      <div className={`px-5 py-1 ${introText ? 'mb-6' : 'mb-2'}`}>
        <div className="cursor-pointer text-lg font-light hover:text-indigo-700 dark:hover:text-indigo-400 transform dark:text-white">
          <i className="mr-1 far fa-folder-open" />  {category}
        </div>
        {introText && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed break-words">
            {introText}
          </p>
        )}
      </div>
    )
  }
  return <></>
}
