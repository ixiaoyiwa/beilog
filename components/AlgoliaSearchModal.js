import replaceSearchResult from '@/components/Mark'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import algoliasearch from 'algoliasearch'
import { useRouter } from 'next/router'
import {
  useCallback,
  useMemo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

/**
 * 结合 Algolia 实现的弹出式搜索框
 * 打开方式 cRef.current.openSearch()
 */
export default function AlgoliaSearchModal({ cRef }) {
  const [searchResults, setSearchResults] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [keyword, setKeyword] = useState(null)
  const [totalPage, setTotalPage] = useState(0)
  const [totalHit, setTotalHit] = useState(0)
  const [useTime, setUseTime] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)

  const [searchError, setSearchError] = useState('')
  const searchTimer = useRef(null)
  const highlightTimer = useRef(null)
  const requestVersion = useRef(0)
  const invalidateSearch = useCallback(() => {
    requestVersion.current++
    clearTimeout(searchTimer.current)
    clearTimeout(highlightTimer.current)
  }, [])
  const inputRef = useRef(null)
  const router = useRouter()
  const appId = siteConfig('ALGOLIA_APP_ID')
  const searchKey = siteConfig('ALGOLIA_SEARCH_ONLY_APP_KEY')
  const indexName = siteConfig('ALGOLIA_INDEX')

  function openSearch() {
    if (!appId) return
    if (!searchKey || !indexName) {
      void router.push('/search')
      return
    }
    setIsModalOpen(true)
  }

  // 快捷键设置
  useHotkeys('ctrl+k', e => {
    e.preventDefault()
    openSearch()
  }, { enabled: Boolean(appId) })

  useHotkeys('down', e => {
    if (isInputFocused) {
      e.preventDefault()
      if (activeIndex < searchResults.length - 1) setActiveIndex(activeIndex + 1)
    }
  }, { enableOnFormTags: true })

  useHotkeys('up', e => {
    if (isInputFocused) {
      e.preventDefault()
      if (activeIndex > 0) setActiveIndex(activeIndex - 1)
    }
  }, { enableOnFormTags: true })

  useHotkeys('esc', e => {
    if (isInputFocused) {
      e.preventDefault()
      closeModal()
    }
  }, { enableOnFormTags: true })

  useHotkeys('enter', e => {
    if (isInputFocused && searchResults.length > 0) {
      onJumpSearchResult()
    }
  }, { enableOnFormTags: true })

  const onJumpSearchResult = (targetIndex) => {
    const i = targetIndex !== undefined ? targetIndex : activeIndex
    if (searchResults.length > 0 && searchResults[i]) {
      const searchResult = searchResults[i]
      window.location.href = `${siteConfig('SUB_PATH', '')}/${searchResult.slug || searchResult.objectID}`
    }
  }

  const resetSearch = useCallback(() => {
    invalidateSearch()
    setIsLoading(false)
    setSearchError('')
    setActiveIndex(0)
    setKeyword('')
    setSearchResults([])
    setUseTime(0)
    setTotalPage(0)
    setTotalHit(0)
    if (inputRef.current) inputRef.current.value = ''
  }, [invalidateSearch])

  useEffect(() => {
    setIsModalOpen(false)
  }, [router.asPath])

  useEffect(() => {
    if (isModalOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    } else {
      resetSearch()
    }
  }, [isModalOpen, resetSearch])

  useImperativeHandle(cRef, () => ({ openSearch }))

  const index = useMemo(() => appId && searchKey && indexName
    ? algoliasearch(appId, searchKey).initIndex(indexName) : null,
  [appId, searchKey, indexName])

  useEffect(() => invalidateSearch, [invalidateSearch, index])

  const handleSearch = async (query, page = 0) => {
    invalidateSearch()
    const version = requestVersion.current
    setKeyword(query)
    setPage(page)
    setSearchResults([])
    setSearchError('')
    setUseTime(0)
    setTotalPage(0)
    setTotalHit(0)
    setActiveIndex(0)
    setIsLoading(Boolean(query && index))
    if (!query || !index) return
    try {
      const { hits, nbHits, nbPages, processingTimeMS } = await index.search(query, { page, hitsPerPage: 10 })
      if (version !== requestVersion.current) return
      setUseTime(processingTimeMS)
      setTotalPage(nbPages)
      setTotalHit(nbHits)
      setSearchResults(hits)
      highlightTimer.current = setTimeout(() => {
        if (version !== requestVersion.current) return
        const doms = document.getElementById('search-wrapper')?.getElementsByClassName('replace')
        if (doms) replaceSearchResult({ doms, search: query, target: { element: 'span', className: 'font-bold border-b border-dashed' } })
      }, 0)
    } catch {
      if (version === requestVersion.current) setSearchError('搜索暂时不可用，请重试。')
    } finally {
      if (version === requestVersion.current) setIsLoading(false)
    }
  }

  const handleInputChange = event => {
    const query = event.target.value
    invalidateSearch()
    setKeyword(query)
    setSearchResults([])
    setSearchError('')
    setIsLoading(Boolean(query))
    if (!query) {
      resetSearch()
      return
    }
    searchTimer.current = setTimeout(() => { void handleSearch(query) }, 600)
  }

  const switchPage = page => handleSearch(keyword, page)

  const closeModal = () => {
    invalidateSearch()
    setIsModalOpen(false)
  }

  if (!index) {
    return <></>
  }

  return (
    <div
      id='search-wrapper'
      className={`${
        isModalOpen ? 'opacity-100' : 'invisible opacity-0 pointer-events-none'
      } z-[9999] fixed h-screen w-screen left-0 top-0 flex items-center justify-center transition-opacity duration-300`}>
      
      {/* 高级半透明毛玻璃遮罩 */}
      <div
        onClick={closeModal}
        className='absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm'
      />

      {/* 搜索弹窗主体 */}
      <div
        className={`${
          isModalOpen ? 'opacity-100 scale-100' : 'invisible opacity-0 scale-95'
        } relative max-h-[75vh] flex flex-col w-full max-w-xl mx-4 dark:bg-hexo-black-gray dark:border-gray-700 bg-white p-6 rounded-2xl shadow-2xl border duration-300 transition-all z-10`}>
        
        {/* 头部标题 */}
        <div className='flex justify-between items-center mb-4'>
          <div className='text-xl text-gray-800 dark:text-gray-200 font-bold'>
            搜索
          </div>
          <button type='button' aria-label='关闭搜索'
            className='text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer'
            onClick={closeModal}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* 输入框 */}
        <input
          type='text'
          placeholder='输入关键词查找节目...'
          onChange={e => handleInputChange(e)}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          className='text-black dark:text-gray-200 bg-gray-100 dark:bg-gray-800 focus:bg-white dark:focus:bg-black outline-none focus:ring-2 focus:ring-blue-500 w-full px-4 py-3 rounded-xl border border-transparent transition-all mb-4'
          ref={inputRef}
        />

        {/* 状态提示 */}
        {isLoading && <p role='status' className='text-center text-sm text-gray-400 py-4'>正在搜索…</p>}
        {searchError && <p role='alert' className='text-center text-sm text-red-500 py-4'>{searchError} <button type='button' className='underline ml-2' onClick={() => { void handleSearch(keyword, page) }}>重试</button></p>}
        {searchResults.length === 0 && keyword && !isLoading && !searchError && (
          <div className='text-center text-gray-400 py-6'>
            无法找到相关结果 &quot;<span className='font-semibold text-gray-600 dark:text-gray-300'>{keyword}</span>&quot;
          </div>
        )}

        {/* 结果列表 */}
        <ul className='flex-1 overflow-y-auto custom-scrollbar pr-1'>
          {searchResults.map((result, index) => (
            <li
              key={result.objectID}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onJumpSearchResult(index)}
              className={`cursor-pointer replace my-1 p-3 rounded-xl transition-colors duration-150 
              ${activeIndex === index ? 'bg-blue-50 dark:bg-gray-700 text-blue-600 dark:text-yellow-500' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <a className={`${activeIndex === index ? 'font-medium' : ''}`}>
                {result.title}
              </a>
            </li>
          ))}
        </ul>

        {/* 底部极简分页 */}
        <Pagination totalPage={totalPage} page={page} switchPage={switchPage} />

        {/* 极简统计提示 */}
        {totalHit > 0 && (
          <div className='text-center text-xs text-gray-400 mt-2'>
            共 {totalHit} 条结果，用时 {useTime} ms
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 分页组件（已极简）
 */
function Pagination({ totalPage, page, switchPage }) {
  if (totalPage <= 1) return <></> // 只有1页时不显示分页
  return (
    <div className='flex space-x-2 w-full justify-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-800'>
      {Array.from({ length: totalPage }, (_, i) => {
        const classNames =
          page === i
            ? 'font-bold text-white bg-blue-500 rounded-lg shadow-sm'
            : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg'
        return (
          <div
            onClick={() => switchPage(i)}
            className={`text-center cursor-pointer w-8 h-8 flex items-center justify-center text-sm transition-all ${classNames}`}
            key={i}>
            {i + 1}
          </div>
        )
      })}
    </div>
  )
}
