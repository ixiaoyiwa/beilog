import replaceSearchResult from '@/components/Mark'
import { siteConfig } from '@/lib/config'
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
      } z-[9999] fixed h-screen w-screen left-0 top-0 sm:mt-[10vh] flex items-start justify-center mt-0`}>
      
      {/* 模态框主体 */}
      <div
        className={`${
          isModalOpen ? 'opacity-100' : 'invisible opacity-0 translate-y-10'
        } max-h-[80vh] flex flex-col w-full min-h-[10rem] h-full md:h-fit max-w-xl dark:bg-hexo-black-gray dark:border-gray-800 bg-white p-5 rounded-lg z-50 shadow-xl border hover:border-blue-600 duration-300 transition-all relative`}>
        
        <div className='flex justify-between items-center mb-4'>
          <div className='text-xl text-blue-600 dark:text-yellow-600 font-bold'>
            搜索
          </div>
          <div>
            <button type='button' aria-label='关闭搜索'
              className='text-gray-500 fa-solid fa-xmark p-1 cursor-pointer hover:text-blue-600 transition-colors'
              onClick={closeModal} />
          </div>
        </div>

        {/* 输入框 */}
        <input
          type='text'
          placeholder='搜索标题、主创等关键词...'
          onChange={e => handleInputChange(e)}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          className='text-black dark:text-gray-200 bg-gray-50 dark:bg-gray-600 outline-blue-500 w-full px-4 py-2 mb-2 border rounded-md text-sm transition-all focus:bg-white dark:focus:bg-black'
          ref={inputRef}
        />

        {isLoading && <p role='status' className='text-center text-gray-500 text-sm py-2'>正在搜索…</p>}
        {searchError && <p role='alert' className='text-center text-red-500 text-sm py-2'>{searchError} <button type='button' className='underline' onClick={() => { void handleSearch(keyword, page) }}>重试</button></p>}
        {searchResults.length === 0 && keyword && !isLoading && !searchError && (
          <div className='text-center text-gray-500 text-sm py-4'>
            无法找到相关结果 <span className='font-semibold'>&quot;{keyword}&quot;</span>
          </div>
        )}

        <ul className='flex-1 overflow-y-auto min-h-[50px] mb-2'>
          {searchResults.map((result, index) => (
            <li
              key={result.objectID}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onJumpSearchResult(index)}
              className={`cursor-pointer replace my-1 p-2 duration-100 rounded-lg ${
                activeIndex === index ? 'bg-blue-600 dark:bg-yellow-600 text-white' : 'text-gray-700 dark:text-gray-300'
              }`}>
              <a className={`${activeIndex === index ? 'text-white' : ''} block truncate`}>
                {result.title}
              </a>
            </li>
          ))}
        </ul>
        
        {/* 重点修改：只有查到结果（totalHit > 0）时，才显示底部横线和分页 */}
        {totalHit > 0 && (
          <div className='flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400'>
            <div>
              共 {totalHit} 条 · {useTime} ms
            </div>
            
            <Pagination totalPage={totalPage} page={page} switchPage={switchPage} />
          </div>
        )}
      </div>

      {/* 半透明遮罩 */}
      <div
        onClick={closeModal}
        className='absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm -z-10'
      />
    </div>
  )
}

/**
 * 极简紧凑版分页组件
 */
function Pagination({ totalPage, page, switchPage }) {
  if (totalPage <= 1) return null // 只有一页时不显示分页
  
  return (
    <div className='flex items-center space-x-1 select-none'>
      <button 
        onClick={() => switchPage(page - 1)} 
        disabled={page === 0}
        className={`px-2 py-1 rounded hover:text-black dark:hover:text-white transition-colors ${page === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        上一页
      </button>
      
      {Array.from({ length: totalPage }, (_, i) => {
        return (
          <button
            key={i}
            onClick={() => switchPage(i)}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
              page === i 
                ? 'bg-blue-600 text-white font-bold dark:bg-yellow-600 dark:text-white' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {i + 1}
          </button>
        )
      })}
      
      <button 
        onClick={() => switchPage(page + 1)} 
        disabled={page === totalPage - 1}
        className={`px-2 py-1 rounded hover:text-black dark:hover:text-white transition-colors ${page === totalPage - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        下一页
      </button>
    </div>
  )
}
