import algoliasearch from 'algoliasearch'
import replaceSearchResult from '@/components/Mark'
import { siteConfig } from '@/lib/config'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Algolia 搜索页面内嵌组件。
 * 不创建遮罩或模态框；结果以输入框下方的浮层显示，因此不会挤动原有栏目/标签列表。
 */
export default function AlgoliaSearchPage() {
  const appId = siteConfig('ALGOLIA_APP_ID')
  const searchKey = siteConfig('ALGOLIA_SEARCH_ONLY_APP_KEY')
  const indexName = siteConfig('ALGOLIA_INDEX')

  const index = useMemo(() => {
    if (!appId || !searchKey || !indexName) return null
    return algoliasearch(appId, searchKey).initIndex(indexName)
  }, [appId, searchKey, indexName])

  const inputRef = useRef(null)
  const debounceTimer = useRef(null)
  const highlightTimer = useRef(null)
  const requestVersion = useRef(0)

  const [keyword, setKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [page, setPage] = useState(0)
  const [totalPage, setTotalPage] = useState(0)
  const [totalHit, setTotalHit] = useState(0)
  const [useTime, setUseTime] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)

  const clearTimers = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    debounceTimer.current = null
    highlightTimer.current = null
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 80)
    return () => {
      clearTimeout(timer)
      clearTimers()
      requestVersion.current++
    }
  }, [clearTimers])

  const resetResults = useCallback(() => {
    clearTimers()
    requestVersion.current++
    setSearchResults([])
    setPage(0)
    setTotalPage(0)
    setTotalHit(0)
    setUseTime(0)
    setActiveIndex(0)
    setIsLoading(false)
    setSearchError('')
  }, [clearTimers])

  const handleSearch = useCallback(async (query, targetPage = 0) => {
    const cleanQuery = String(query || '').trim()
    clearTimers()
    const version = ++requestVersion.current
    setPage(targetPage)
    setSearchResults([])
    setTotalPage(0)
    setTotalHit(0)
    setUseTime(0)
    setActiveIndex(0)
    setSearchError('')

    if (!cleanQuery) {
      setIsLoading(false)
      return
    }
    if (!index) {
      setIsLoading(false)
      setSearchError('Algolia 搜索配置不完整，请检查 App ID、Search-Only API Key 和 Index。')
      return
    }

    setIsLoading(true)
    try {
      const response = await index.search(cleanQuery, {
        page: targetPage,
        hitsPerPage: 10
      })
      if (version !== requestVersion.current) return

      const hits = Array.isArray(response.hits) ? response.hits : []
      setSearchResults(hits)
      setTotalPage(Number(response.nbPages) || 0)
      setTotalHit(Number(response.nbHits) || 0)
      setUseTime(Number(response.processingTimeMS) || 0)
      setActiveIndex(0)

      if (hits.length > 0) {
        highlightTimer.current = setTimeout(() => {
          if (version !== requestVersion.current) return
          const doms = document
            .getElementById('algolia-search-page-results')
            ?.getElementsByClassName('replace')
          if (doms) {
            replaceSearchResult({
              doms,
              search: cleanQuery,
              target: {
                element: 'span',
                className: 'font-semibold border-b border-dashed'
              }
            })
          }
        }, 0)
      }
    } catch (error) {
      if (version === requestVersion.current) {
        setSearchError('搜索暂时不可用，请稍后重试。')
      }
    } finally {
      if (version === requestVersion.current) setIsLoading(false)
    }
  }, [clearTimers, index])

  const handleInputChange = event => {
    const nextKeyword = event.target.value
    setKeyword(nextKeyword)
    resetResults()

    if (!nextKeyword.trim()) return

    setIsLoading(true)
    debounceTimer.current = setTimeout(() => {
      void handleSearch(nextKeyword, 0)
    }, 450)
  }

  const jumpToResult = targetIndex => {
    const result = searchResults[targetIndex]
    if (!result) return

    const rawTarget = String(result.slug || result.objectID || '').trim()
    if (!rawTarget) return
    if (/^https?:\/\//i.test(rawTarget)) {
      window.location.href = rawTarget
      return
    }

    const subPath = String(siteConfig('SUB_PATH', '') || '').replace(/\/+$/, '')
    const slug = rawTarget.replace(/^\/+/, '')
    window.location.href = `${subPath}/${slug}`
  }

  const handleKeyDown = event => {
    if (event.key === 'ArrowDown' && searchResults.length > 0) {
      event.preventDefault()
      setActiveIndex(current => Math.min(current + 1, searchResults.length - 1))
    } else if (event.key === 'ArrowUp' && searchResults.length > 0) {
      event.preventDefault()
      setActiveIndex(current => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      if (searchResults.length > 0) {
        event.preventDefault()
        jumpToResult(Math.min(activeIndex, searchResults.length - 1))
      } else if (keyword.trim() && !isLoading) {
        event.preventDefault()
        void handleSearch(keyword, 0)
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setKeyword('')
      resetResults()
      inputRef.current?.focus()
    }
  }

  const hasKeyword = Boolean(keyword.trim())
  const showResultsPanel = hasKeyword

  const pageItems = useMemo(() => {
    if (totalPage <= 7) return Array.from({ length: totalPage }, (_, i) => i)
    const selected = new Set([0, totalPage - 1])
    for (let i = Math.max(0, page - 2); i <= Math.min(totalPage - 1, page + 2); i++) {
      selected.add(i)
    }
    const sorted = Array.from(selected).sort((a, b) => a - b)
    const items = []
    sorted.forEach((pageNumber, indexInList) => {
      if (indexInList > 0 && pageNumber - sorted[indexInList - 1] > 1) {
        items.push(`ellipsis-${pageNumber}`)
      }
      items.push(pageNumber)
    })
    return items
  }, [page, totalPage])

  return (
    <div id='algolia-search-page' className='relative z-30 w-full'>
      <form
        className='relative w-full'
        role='search'
        onSubmit={event => {
          event.preventDefault()
          if (keyword.trim()) void handleSearch(keyword, 0)
        }}>
        <div className='flex w-full items-center'>
          <input
            id='algolia-search-page-input'
            ref={inputRef}
            type='search'
            autoComplete='off'
            aria-label='搜索节目'
            aria-expanded={showResultsPanel}
            aria-controls='algolia-search-page-results'
            placeholder='搜索节目、标题或关键词…'
            value={keyword}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            className='box-border h-11 w-full rounded-lg border px-4 pr-20 text-sm font-light outline-none transition'
            style={{
              borderColor: isInputFocused ? 'var(--theme-color)' : 'var(--hexo-color-border)',
              backgroundColor: 'transparent',
              color: 'var(--hexo-color-text)',
              boxShadow: isInputFocused
                ? '0 0 0 3px color-mix(in srgb, var(--theme-color) 12%, transparent)'
                : 'none'
            }}
          />
          {keyword && (
            <button
              type='button'
              aria-label='清空搜索'
              className='absolute right-12 flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition hover:text-[var(--theme-color)]'
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                setKeyword('')
                resetResults()
                inputRef.current?.focus()
              }}>
              <i className='fas fa-times' />
            </button>
          )}
          <button
            type='submit'
            aria-label='开始搜索'
            className='absolute right-2 flex h-8 w-8 items-center justify-center rounded-md transition hover:text-[var(--theme-color)]'
            style={{ color: 'var(--hexo-color-text-secondary)' }}>
            {isLoading ? <i className='fas fa-spinner animate-spin' /> : <i className='fas fa-search' />}
          </button>
        </div>
      </form>

      {showResultsPanel && (
        <div
          id='algolia-search-page-results'
          className='absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-xl border'
          role='region'
          aria-label='搜索结果'
          style={{
            borderColor: 'var(--hexo-color-border)',
            backgroundColor: 'var(--hexo-color-card)',
            color: 'var(--hexo-color-text)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)'
          }}>
          <div className='max-h-[min(65vh,34rem)] overflow-y-auto p-2'>
            {isLoading && (
              <p role='status' className='px-3 py-4 text-center text-sm' style={{ color: 'var(--hexo-color-text-secondary)' }}>
                正在搜索…
              </p>
            )}
            {searchError && (
              <div role='alert' className='px-3 py-4 text-center text-sm text-red-600'>
                <p>{searchError}</p>
                <button
                  type='button'
                  className='mt-2 underline underline-offset-2'
                  onClick={() => void handleSearch(keyword, page)}>
                  重试
                </button>
              </div>
            )}
            {!isLoading && !searchError && hasKeyword && searchResults.length === 0 && (
              <p className='px-3 py-4 text-center text-sm' style={{ color: 'var(--hexo-color-text-secondary)' }}>
                没有找到与“{keyword}”相关的节目
              </p>
            )}
            {searchResults.length > 0 && (
              <ul className='space-y-1'>
                {searchResults.map((result, indexInList) => (
                  <li
                    key={result.objectID || result.slug || `${result.title}-${indexInList}`}
                    role='option'
                    aria-selected={activeIndex === indexInList}
                    onMouseEnter={() => setActiveIndex(indexInList)}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => jumpToResult(indexInList)}
                    className='cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition'
                    style={{
                      borderColor: activeIndex === indexInList ? 'var(--theme-color)' : 'transparent',
                      backgroundColor: activeIndex === indexInList
                        ? 'var(--theme-color)'
                        : 'transparent',
                      color: activeIndex === indexInList ? '#fff' : 'var(--hexo-color-text)'
                    }}>
                    <span className='replace block truncate font-medium'>
                      {result.title || result.name || result.slug || '未命名节目'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {totalPage > 0 && searchResults.length > 0 && (
            <div
              className='flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs'
              style={{ borderColor: 'var(--hexo-color-border)' }}>
              <span style={{ color: 'var(--hexo-color-text-secondary)' }}>
                共 {totalHit} 条 · {useTime} ms
              </span>
              <div className='flex items-center gap-1'>
                <button
                  type='button'
                  disabled={page <= 0}
                  onClick={() => void handleSearch(keyword, page - 1)}
                  className='rounded px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-35 hover:text-[var(--theme-color)]'>
                  上一页
                </button>
                {pageItems.map(item => typeof item === 'number' ? (
                  <button
                    key={item}
                    type='button'
                    aria-current={page === item ? 'page' : undefined}
                    onClick={() => void handleSearch(keyword, item)}
                    className='min-w-6 rounded px-1.5 py-1 transition'
                    style={{
                      backgroundColor: page === item ? 'var(--theme-color)' : 'transparent',
                      color: page === item ? '#fff' : 'var(--hexo-color-text)'
                    }}>
                    {item + 1}
                  </button>
                ) : (
                  <span key={item} className='px-1' style={{ color: 'var(--hexo-color-text-secondary)' }}>…</span>
                ))}
                <button
                  type='button'
                  disabled={page >= totalPage - 1}
                  onClick={() => void handleSearch(keyword, page + 1)}
                  className='rounded px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-35 hover:text-[var(--theme-color)]'>
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
