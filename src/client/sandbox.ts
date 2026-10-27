import DOMPurify from "dompurify";
export interface PreviewSelection {
  selector: string;
  quote: string;
}
export function sandboxDocument(
  content: string,
  token: string,
  annotate: boolean,
): string {
  const nonce = token.replace(/-/g, "");
  const policy = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`;
  const clean = DOMPurify.sanitize(content, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: [
      "script",
      "iframe",
      "frame",
      "object",
      "embed",
      "meta",
      "base",
      "link",
      "form",
    ],
    FORBID_ATTR: ["nonce", "action", "formaction", "srcdoc", "target", "ping"],
    ALLOWED_URI_REGEXP: /^(?:#|data:image\/(?:png|jpeg|gif|webp);base64,)/i,
  });
  const shim = `(()=>{const token=${JSON.stringify(token)};let enabled=${annotate};function selector(el){if(el.id)return '#'+CSS.escape(el.id);const parts=[];for(let n=el;n&&n.nodeType===1&&parts.length<5;n=n.parentElement){let part=n.tagName.toLowerCase();if(n.parentElement){const peers=[...n.parentElement.children].filter(x=>x.tagName===n.tagName);if(peers.length>1)part+=':nth-of-type('+(peers.indexOf(n)+1)+')';}parts.unshift(part);}return parts.join(' > ').slice(0,500);}window.addEventListener('message',e=>{if(e.source!==parent||!e.data||e.data.canvasToken!==token)return;if(e.data.type==='annotate'){enabled=!!e.data.enabled;document.documentElement.style.cursor=enabled?'crosshair':'';}if(e.data.type==='scroll'&&typeof e.data.ratio==='number'){window.scrollTo(0,e.data.ratio*Math.max(0,document.documentElement.scrollHeight-innerHeight));}});document.addEventListener('click',e=>{if(!enabled)return;e.preventDefault();e.stopImmediatePropagation();const el=e.target.closest('body *');if(!el)return;parent.postMessage({canvasToken:token,type:'selection',selector:selector(el),quote:(el.innerText||el.textContent||'').trim().slice(0,3000)},'*');},true);document.documentElement.style.cursor=enabled?'crosshair':'';})();`;
  // The browser parser, not string substitution, applies the first CSP before any artifact bytes.
  // The opaque-origin iframe permits only our nonce-bearing annotation shim, with no same-origin,
  // network, downloads, forms, popups, navigation, or Host RPC capabilities.
  const bootstrap = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><style>html{color-scheme:light}body{margin:24px;color:#26312c;font:15px/1.7 system-ui,sans-serif;overflow-wrap:anywhere}img{max-width:100%}*{box-sizing:border-box}.cw-document{max-width:800px;margin:auto}.cw-document h1{font-size:30px;line-height:1.3}.cw-document h2{font-size:23px}.cw-document h3{font-size:18px}.cw-document pre{padding:16px;background:#f1f4f0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.cw-document code{font-family:Consolas,monospace}.cw-document table{border-collapse:collapse;width:100%}.cw-document th,.cw-document td{border:1px solid #dce2dc;padding:8px;text-align:left}.cw-document blockquote{margin-left:0;border-left:3px solid #b7ccbf;padding-left:16px;color:#637269}</style>`;
  return `<!doctype html>${bootstrap}${clean}<script nonce="${nonce}">${shim}</script>`;
}
