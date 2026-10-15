import SmartLink from '@/components/SmartLink'

/**
 * 博客列表上方嵌入条
 * @param {*} props
 * @returns
 */
export default function SlotBar(props) {
  const { tag, category } = props

  // 新增：分类简介映射表（同时兼容中文名和映射后的英文名）
  const introMap = {
    '展信安': '一封封来信里，有藏了很久的心事，也有不忍遗忘的生活瞬间。每一封，都值得被看见，被好好接住。愿写信、读信、听信的人，皆安。',
    'Letters': '一封封来信里，有藏了很久的心事，也有不忍遗忘的生活瞬间。每一封，都值得被看见，被好好接住。愿写信、读信、听信的人，皆安。',
    '碎碎念': '从一个微小的念头，或一段经历说起。以清醒而温柔的老友视角，陪你坦然面对那些隐秘的情绪，看见真实、细腻而又丰富的内心世界。',
    'Musings': '从一个微小的念头，或一段经历说起。以清醒而温柔的老友视角，陪你坦然面对那些隐秘的情绪，看见真实、细腻而又丰富的内心世界。',
    '慢漫聊': '我们聊的，可能是正上头的新鲜事，也可能是绕不开的困惑和迷茫。不急着下结论，也不用非得有意义。要是刚好有一句触动到你，就够了。',
    'Talks': '我们聊的，可能是正上头的新鲜事，也可能是绕不开的困惑和迷茫。不急着下结论，也不用非得有意义。要是刚好有一句触动到你，就够了。'
  }

  if (tag) {
    return <div className="cursor-pointer px-3 py-2 mb-2 font-light hover:text-indigo-700 dark:hover:text-indigo-400 transform dark:text-white">
              <SmartLink key={tag} href={`/tag/${encodeURIComponent(tag)}`} passHref
                  className={'cursor-pointer inline-block rounded duration-200 mr-2 py-0.5 px-1 text-xl whitespace-nowrap '}>
                  <div className='font-light dark:text-gray-400 dark:hover:text-white'>
                    <i className='fa fa-user mr-1' />{tag}
                  </div>
              </SmartLink>
          </div>
  } else if (category) {
    // 新增：获取当前分类的简介
    const introText = introMap[category]

    return <div className="px-5 py-1 mb-2">
              <div className="cursor-pointer text-lg font-light hover:text-indigo-700 dark:hover:text-indigo-400 transform dark:text-white">
                <i className="mr-1 far fa-folder-open" />  {category}
              </div>
              {introText && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed break-words">
                  {introText}
                </p>
              )}
          </div>
  }
  return <></>
}
