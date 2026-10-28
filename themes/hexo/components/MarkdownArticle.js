/**
 * Markdown 正文渲染(替换原来的同名文件)
 * 只有 post.markdownHtml 有内容时才会用到;否则主题仍然渲染原来的 NotionPage。
 *
 * 做法:把 Markdown 生成的 HTML,改写成和 Notion 正文「一模一样的标记」(同样的外壳、同样的 class),
 * 这样站点自己的 Notion 样式(styles/notion.css)会原样套用到 Markdown 文章上:
 *   - 字号、行距、段落间距、标题、列表、引用、链接、行内代码、表格,都和 Notion 文章一致
 *   - 外层 id='notion-article'(与 NotionPage 相同),NotionAudioEnhancer(音频播放器)和 TimestampLinker(时间戳跳转)
 *     都是靠这个 id 和 .notion-audio 找到正文的,所以它们对 Markdown 文章同样生效
 * 以后你改 notion.css,Markdown 文章会自动跟着变,不需要再改这里。
 */

// 正文顶部额外留白(默认 0,与 Notion 文章一致)。想让 Markdown 文章顶部松一点,改这里,例如 '1rem'
const TOP_GAP = '0px'

export const toNotionMarkup = html =>
  html
    // 音频:去掉外面的 <p>,再包成 Notion 音频块的结构(播放器脚本靠 .notion-audio 识别)
    .replace(/<p>\s*(<audio\b[^>]*>\s*<\/audio>)\s*<\/p>/g, '$1')
    .replace(
      /<audio\b([^>]*)>\s*<\/audio>/g,
      (m, attrs) =>
        `<div class="notion-audio"><audio${/preload=/.test(attrs) ? '' : ' preload="none"'}${attrs}></audio></div>`
    )
    // 单独成段的图片 → Notion 图片块
    .replace(
      /<p>\s*(<img\b[^>]*>)\s*<\/p>/g,
      '<div class="notion-asset-wrapper notion-asset-wrapper-image">$1</div>'
    )
    // 段落 / 标题 / 列表 / 引用 / 分割线 / 表格 / 链接
    .replace(/<p>/g, '<p class="notion-text">')
    .replace(/<h1>/g, '<h1 class="notion-h notion-h1">')
    .replace(/<h2>/g, '<h2 class="notion-h notion-h2">')
    .replace(/<h3>/g, '<h3 class="notion-h notion-h3">')
    .replace(/<h([45])>/g, '<h$1 class="notion-h">')
    .replace(/<ul>/g, '<ul class="notion-list notion-list-disc">')
    .replace(/<ol(\s[^>]*)?>/g, (m, a) => `<ol class="notion-list notion-list-numbered"${a || ''}>`)
    .replace(/<blockquote>/g, '<blockquote class="notion-quote">')
    .replace(/<hr\s*\/?>/g, '<hr class="notion-hr">')
    .replace(/<table>/g, '<table class="notion-simple-table">')
    .replace(/<a /g, '<a class="notion-link" ')
    // 代码:代码块和行内代码分开处理
    .replace(/<pre><code/g, '<pre class="notion-code"><code data-block="1"')
    .replace(/<code>/g, '<code class="notion-inline-code">')

export default function MarkdownArticle({ html }) {
  return (
    <>
      <div id='notion-article' className='mx-auto overflow-hidden'>
        <main
          className='notion light-mode notion-page md-article'
          dangerouslySetInnerHTML={{
            __html: '<div class="notion-viewport"></div>' + toNotionMarkup(html)
          }}
        />
      </div>
      {/* 只补 notion.css 没有覆盖到的几处;其余样式全部来自站点自己的 Notion 样式 */}
      <style jsx global>{`
        .md-article { padding-top: ${TOP_GAP}; }
        .md-article .notion-asset-wrapper-image img { max-width: 100%; border-radius: 8px; }
        .md-article .notion-audio { margin: 0.5rem 0; }
        .md-article .notion-text > img { max-width: 100%; height: auto; }
        .md-article pre.notion-code { background: rgba(120, 113, 108, 0.12); border-radius: 0.5rem; }
        .md-article .notion-simple-table th,
        .md-article .notion-simple-table td { border: 1px solid rgba(120, 113, 108, 0.35) !important; padding: 0.4em 0.8em; text-align: left; }
        .md-article .notion-simple-table th { font-weight: 600; background: rgba(120, 113, 108, 0.1); }
      `}</style>
    </>
  )
}
