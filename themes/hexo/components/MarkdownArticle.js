/**
 * Markdown 正文渲染(替换原来的同名文件)
 * 只有 post.markdownHtml 有内容时才会用到;否则主题仍然渲染原来的 NotionPage。
 *
 * 为了让 Markdown 文章和 Notion 文章「长得一样、行为一样」,这里刻意复用了 Notion 正文的外壳:
 *   - 外层 id='notion-article'(与 NotionPage 相同),主题里针对它的样式、以及依赖它的脚本都会生效
 *   - 里层用 react-notion-x 的 .notion / .notion-page 外壳,音频用 .notion-audio 包裹(和 Notion 音频块的标记一致)
 * 想微调外观,只改下面三个变量即可,不会影响 Notion 渲染的文章。
 */
import { useGlobal } from '@/lib/global'

const FONT_SIZE = '1.0625rem' // 正文字号(17px)。觉得偏小/偏大,就改这里
const LINE_HEIGHT = '1.8'
const TOP_GAP = '1.25rem' // 正文顶部留白

// 把 <audio> 包成和 Notion 音频块一致的结构
const wrapAudio = html =>
  html
    .replace(/<p>\s*(<audio\b[^>]*>\s*<\/audio>)\s*<\/p>/g, '$1')
    .replace(
      /<audio\b([^>]*)>\s*<\/audio>/g,
      (m, attrs) =>
        `<div class="notion-audio"><audio${/preload=/.test(attrs) ? '' : ' preload="none"'}${attrs}></audio></div>`
    )

export default function MarkdownArticle({ html }) {
  const { isDarkMode } = useGlobal()
  return (
    <>
      <div id='notion-article' className='mx-auto overflow-hidden'>
        <main className={`notion ${isDarkMode ? 'dark-mode' : 'light-mode'} notion-page md-article`}>
          <div className='notion-viewport' />
          <div className='md-body' dangerouslySetInnerHTML={{ __html: wrapAudio(html) }} />
        </main>
      </div>
      <style jsx global>{`
        .md-article {
          --md-font-size: ${FONT_SIZE};
          --md-line-height: ${LINE_HEIGHT};
          --md-top-gap: ${TOP_GAP};
        }
        .md-article .md-body {
          padding-top: var(--md-top-gap);
          font-size: var(--md-font-size);
          line-height: var(--md-line-height);
          word-break: break-word;
        }
        .md-article .md-body > :first-child { margin-top: 0; }
        .md-article .md-body h1, .md-article .md-body h2, .md-article .md-body h3,
        .md-article .md-body h4, .md-article .md-body h5 {
          font-weight: 700;
          line-height: 1.4;
          margin: 1.6em 0 0.6em;
        }
        .md-article .md-body h1 { font-size: 1.875em; }
        .md-article .md-body h2 { font-size: 1.5em; }
        .md-article .md-body h3 { font-size: 1.25em; }
        .md-article .md-body h4 { font-size: 1.1em; }
        .md-article .md-body h5 { font-size: 1em; }
        .md-article .md-body p { margin: 0.9em 0; }
        .md-article .md-body a { color: #e84b28; text-decoration: underline; text-underline-offset: 3px; }
        .md-article .md-body img { max-width: 100%; height: auto; border-radius: 10px; margin: 1.2em auto; display: block; }
        .md-article .md-body .notion-audio { margin: 1em 0; }
        .md-article .md-body ul, .md-article .md-body ol { margin: 0.9em 0; padding-left: 1.6em; }
        .md-article .md-body ul { list-style: disc; }
        .md-article .md-body ol { list-style: decimal; }
        .md-article .md-body li { margin: 0.3em 0; }
        .md-article .md-body blockquote {
          margin: 1.2em 0;
          padding: 0.2em 1em;
          border-left: 4px solid #fc8465;
          background: rgba(252, 132, 101, 0.08);
          border-radius: 0 8px 8px 0;
        }
        .md-article .md-body hr { border: 0; border-top: 1px solid rgba(120, 113, 108, 0.35); margin: 2em 0; }
        .md-article .md-body code { background: rgba(120, 113, 108, 0.14); border-radius: 4px; padding: 0.15em 0.4em; font-size: 0.9em; }
        .md-article .md-body pre { background: #1c1917; color: #fafaf9; border-radius: 10px; padding: 1em 1.2em; overflow-x: auto; margin: 1.2em 0; }
        .md-article .md-body pre code { background: transparent; padding: 0; color: inherit; }
        .md-article .md-body table { width: 100%; border-collapse: collapse; margin: 1.2em 0; display: block; overflow-x: auto; }
        .md-article .md-body th, .md-article .md-body td { border: 1px solid rgba(120, 113, 108, 0.4); padding: 0.5em 0.8em; text-align: left; }
        .md-article .md-body th { background: rgba(120, 113, 108, 0.12); }
      `}</style>
    </>
  )
}
