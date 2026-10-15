import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'

/**
 * 数字翻页插件
 * @param page 当前页码
 * @param totalPage 总页码
 * @returns {JSX.Element}
 * @constructor
 */
const PaginationNumber = ({ page, totalPage }) => {
  const router = useRouter()
  const currentPage = Number(page) || 1
  const totalPages = Number(totalPage) || 1
  const showPrev = currentPage > 1
  const showNext = currentPage < totalPages
  const pagePrefix = router.asPath
    .split('?')[0]
    .replace(/\/page\/[1-9]\d*/, '')
    .replace(/\/$/, '')
    .replace('.html', '')
  const pages = generatePages(pagePrefix, currentPage, totalPages)

  return (
    <div className='mt-10 mb-5 flex justify-center items-end font-medium text-indigo-400 duration-500 py-3 space-x-2'>
      {/* 上一页 */}
      {showPrev ? (
        <SmartLink
          href={{
            pathname:
              currentPage === 2
                ? `${pagePrefix}/`
                : `${pagePrefix}/page/${currentPage - 1}`,
            query: router.query.s ? { s: router.query.s } : {}
          }}
          rel='prev'
          className='pb-0.5 hover:bg-indigo-400 hover:text-white w-6 text-center cursor-pointer duration-200 hover:font-bold'>
          <i className='fas fa-angle-left' />
        </SmartLink>
      ) : (
        <div className='w-6' aria-hidden='true' />
      )}

      {pages}

      {/* 下一页 */}
      {showNext ? (
        <SmartLink
          href={{
            pathname: `${pagePrefix}/page/${currentPage + 1}`,
            query: router.query.s ? { s: router.query.s } : {}
          }}
          rel='next'
          className='pb-0.5 hover:bg-indigo-400 hover:text-white w-6 text-center cursor-pointer duration-200 hover:font-bold'>
          <i className='fas fa-angle-right' />
        </SmartLink>
      ) : (
        <div className='w-6' aria-hidden='true' />
      )}
    </div>
  )
}

/**
 * 获取页码元素
 * @param {*} page 页码
 * @param {*} currentPage 当前页码
 * @param {*} pagePrefix 路径前缀
 * @returns
 */
function getPageElement(page, currentPage, pagePrefix) {
  const selected = Number(page) === Number(currentPage)
  return (
    <SmartLink
      href={page === 1 ? `${pagePrefix}/` : `${pagePrefix}/page/${page}`}
      key={page}
      passHref
      className={`${
        selected
          ? 'font-bold bg-indigo-400 hover:bg-indigo-600 dark:bg-indigo-500 text-white'
          : 'border-b border-indigo-400 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-400'
      }
      duration-500  hover:font-bold hover:text-white
      cursor-pointer pb-0.5 w-6 text-center
      `}>
      {page}
    </SmartLink>
  )
}

function generatePages(pagePrefix, currentPage, totalPage) {
  const pages = []
  const groupCount = 7 // 最多显示页签数
  if (totalPage <= groupCount) {
    for (let i = 1; i <= totalPage; i++) {
      pages.push(getPageElement(i, currentPage, pagePrefix))
    }
  } else {
    pages.push(getPageElement(1, currentPage, pagePrefix))
    const dynamicGroupCount = groupCount - 2
    let startPage = currentPage - 2
    if (startPage <= 1) {
      startPage = 2
    }
    if (startPage + dynamicGroupCount > totalPage) {
      startPage = totalPage - dynamicGroupCount
    }
    if (startPage > 2) {
      pages.push(<div key={-1}>... </div>)
    }

    for (let i = 0; i < dynamicGroupCount; i++) {
      if (startPage + i < totalPage) {
        pages.push(getPageElement(startPage + i, currentPage, pagePrefix))
      }
    }

    if (startPage + dynamicGroupCount < totalPage) {
      pages.push(<div key={-2}>... </div>)
    }

    pages.push(getPageElement(totalPage, currentPage, pagePrefix))
  }
  return pages
}

export default PaginationNumber
