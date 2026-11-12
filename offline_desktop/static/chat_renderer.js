/* TheOrg's small, dependency-free, text-safe Markdown presenter.
 * No HTML insertion, remote CSS/JS, executable snippets or user-controlled DOM tags.
 * Unsupported formatting remains plain text.
 */
'use strict';
window.TheOrgChatRenderer = (() => {
  const MAX_TEXT=250000, MAX_LINES=4000, MAX_BLOCK=150000;
  const inline=/(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\x60([^\x60\n]+)\x60|\[([^\]\n]{1,160})\]\((https?:\/\/[^\s)]+)\))/g;
  function el(tag, cls, value){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(value!==undefined)node.textContent=String(value);
    return node;
  }
  function inlineText(parent,line){
    inline.lastIndex=0;
    let cursor=0, match;
    while((match=inline.exec(line))!==null){
      if(match.index>cursor)parent.append(document.createTextNode(line.slice(cursor,match.index)));
      if(match[2]!==undefined)parent.append(el('strong','',match[2]));
      else if(match[3]!==undefined)parent.append(el('em','',match[3]));
      else if(match[4]!==undefined)parent.append(el('code','chat-inline-code',match[4]));
      else if(match[5]!==undefined){
        let safe=null;
        try{
          const url=new URL(match[6]);
          if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)safe=url.href;
        }catch{}
        if(safe){
          const a=el('a','chat-external-link',match[5]);
          a.href=safe;a.target='_blank';a.rel='noopener noreferrer';
          parent.append(a);
        }else parent.append(document.createTextNode(match[0]));
      }
      cursor=inline.lastIndex;
    }
    if(cursor<line.length)parent.append(document.createTextNode(line.slice(cursor)));
  }
  function codeBlock(language,source,onCopy){
    const wrap=el('section','chat-code-block');
    const toolbar=el('div','chat-code-toolbar');
    toolbar.append(el('span','chat-code-language',(language||'text').slice(0,25)));
    const button=el('button','chat-copy-button','Copy code');
    button.type='button';button.setAttribute('aria-label','Copy code block');
    button.addEventListener('click',()=>onCopy(source,button));
    toolbar.append(button);wrap.append(toolbar);
    const pre=el('pre','chat-code-body'),code=el('code','');
    if(language==='diff'){
      for(const line of source.split('\n')){
        const row=el('span','chat-diff-line '+(line.startsWith('+')?'chat-diff-add':line.startsWith('-')?'chat-diff-remove':''));
        row.textContent=line;code.append(row,document.createTextNode('\n'));
      }
    }else code.textContent=source;
    pre.append(code);wrap.append(pre);
    return wrap;
  }
  function render(value,onCopy=()=>{}){
    const raw=String(value??'').slice(0,MAX_TEXT);
    const lines=raw.split(/\r?\n/).slice(0,MAX_LINES);
    const frag=document.createDocumentFragment();
    let paragraph=[],list=null,listType=null,quote=null,code=null,language='';
    function flushParagraph(){
      if(!paragraph.length)return;
      const p=el('p','chat-markdown-paragraph');
      inlineText(p,paragraph.join(' '));frag.append(p);paragraph=[];
    }
    function flushList(){if(list)frag.append(list);list=null;listType=null;}
    function flushQuote(){if(quote)frag.append(quote);quote=null;}
    function flushCode(){
      if(code!==null){
        frag.append(codeBlock(language,code.join('\n').slice(0,MAX_BLOCK),onCopy));
        code=null;language='';
      }
    }
    for(const line of lines){
      const fence=line.match(/^\s*\x60{3,}\s*([\w+#.-]{0,24})\s*$/);
      if(fence){
        if(code!==null)flushCode();
        else {flushParagraph();flushList();flushQuote();code=[];language=fence[1]||'';}
        continue;
      }
      if(code!==null){code.push(line);continue;}
      if(!line.trim()){flushParagraph();flushList();flushQuote();continue;}
      const h=line.match(/^(#{1,4})\s+(.+)$/);
      if(h){
        flushParagraph();flushList();flushQuote();
        const title=el('h'+Math.min(5,2+h[1].length),'chat-markdown-heading');
        inlineText(title,h[2]);frag.append(title);continue;
      }
      const bullet=line.match(/^\s{0,4}([-*+]|\d{1,3}\.)\s+(.+)$/);
      if(bullet){
        flushParagraph();flushQuote();
        const next=/^\d/.test(bullet[1])?'ol':'ul';
        if(listType!==next){flushList();list=el(next,'chat-markdown-list');listType=next;}
        const li=el('li','');inlineText(li,bullet[2]);list.append(li);continue;
      }
      const quoted=line.match(/^>\s?(.*)$/);
      if(quoted){
        flushParagraph();flushList();
        if(!quote)quote=el('blockquote','chat-markdown-quote');
        const p=el('p','');inlineText(p,quoted[1]);quote.append(p);continue;
      }
      flushList();flushQuote();paragraph.push(line);
      if(paragraph.length>30)flushParagraph();
    }
    flushParagraph();flushList();flushQuote();flushCode();
    if(!frag.childNodes.length)frag.append(el('p','chat-markdown-paragraph','No content.'));
    return frag;
  }
  function codeSummary(value){
    const src=String(value??'');
    const blocks=[...src.matchAll(/^\s*\x60{3,}\s*([\w+#.-]{0,24})\s*\n([\s\S]*?)^\s*\x60{3,}\s*$/gm)];
    return blocks.slice(0,20).map((m,i)=>({index:i+1,language:m[1]||'text',lines:m[2].split('\n').length}));
  }
  return Object.freeze({render,codeSummary});
})();
