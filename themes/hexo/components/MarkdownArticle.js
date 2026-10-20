/**
 * Markdown 正文渲染(新文件)
 * 数据来自后台写入 Notion「MarkdownBody」字段,在构建时已转成 HTML(见 SiteDataApi.js 的「修改 C」)。
 * 只有 post.markdownHtml 有内容时才会用到这个组件;否则主题仍然渲染原来的 NotionPage。
 */
export default function MarkdownArticle({ html }) {
  return (
    <>
      <div id='markdown-article' className='md-article' dangerouslySetInnerHTML={{ __html: html }} />
      <style jsx global>{`
        .md-article {
          /* ⭐ 新增：Markdown 顶部间距控制 */
          --md-top-gap: 1.25rem;
          padding-top: var(--md-top-gap);
          
          font-size: 1rem;
          line-height: 1.85;
          color: #292524;
          word-break: break-word;
        }
        .md-article > :first-child { margin-top: 0; }
        .md-article h1, .md-article h2, .md-article h3, .md-article h4 {
          font-weight: 700;
          line-height: 1.4;
          margin: 1.8em 0 0.7em;
        }
        .md-article h1 { font-size: 1.75rem; }
        .md-article h2 { font-size: 1.45rem; padding-bottom: 0.3em; border-bottom: 1px solid #e7e5e4; }
        .md-article h3 { font-size: 1.2rem; }
        .md-article p { margin: 1em 0; }
        .md-article a { color: #e84b28; text-decoration: underline; text-underline-offset: 3px; }
        .md-article img { max-width: 100%; height: auto; border-radius: 10px; margin: 1.2em auto; display: block; }
        .md-article audio { width: 100%; margin: 1em 0; }
        .md-article ul, .md-article ol { margin: 1em 0; padding-left: 1.6em; }
        .md-article ul { list-style: disc; }
        .md-article ol { list-style: decimal; }
        .md-article li { margin: 0.35em 0; }
        .md-article blockquote {
          margin: 1.2em 0;
          padding: 0.2em 1em;
          border-left: 4px solid #fc8465;
          background: #fff4f0;
          color: #57534e;
          border-radius: 0 8px 8px 0;
        }
        .md-article hr { border: 0; border-top: 1px solid #e7e5e4; margin: 2em 0; }
        .md-article code {
          background: #f5f5f4;
          border-radius: 4px;
          padding: 0.15em 0.4em;
          font-size: 0.9em;
        }
        .md-article pre {
          background: #1c1917;
          color: #fafaf9;
          border-radius: 10px;
          padding: 1em 1.2em;
          overflow-x: auto;
          margin: 1.2em 0;
        }
        .md-article pre code { background: transparent; padding: 0; color: inherit; }
        .md-article table { width: 100%; border-collapse: collapse; margin: 1.2em 0; display: block; overflow-x: auto; }
        .md-article th, .md-article td { border: 1px solid #d6d3d1; padding: 0.5em 0.8em; text-align: left; }
        .md-article th { background: #f5f5f4; }
        .dark .md-article { color: #e7e5e4; }
        .dark .md-article h2 { border-color: #44403c; }
        .dark .md-article blockquote { background: #292524; color: #d6d3d1; }
        .dark .md-article hr { border-color: #44403c; }
        .dark .md-article code { background: #292524; }
        .dark .md-article th { background: #292524; }
        .dark .md-article th, .dark .md-article td { border-color: #44403c; }
      `}</style>
    </>
  )
}
