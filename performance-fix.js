// Performance guard for the staff app: reduce duplicate polling without changing business logic.
(function(){
  const nativeSetInterval=window.setInterval.bind(window);
  window.setInterval=function(fn,delay,...args){
    const name=fn&&fn.name?fn.name:'';
    if(name==='fetchSharedActive') delay=Math.max(Number(delay)||0,2000);
    else if(name==='updateAll') delay=Math.max(Number(delay)||0,5000);
    else if(name==='syncSharedData') delay=Math.max(Number(delay)||0,5000);
    return nativeSetInterval(fn,delay,...args);
  };

  const nativeFetch=window.fetch.bind(window);
  const inflight=new Map();
  const cache=new Map();
  window.fetch=function(input,init={}){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const method=String(init?.method||'GET').toUpperCase();
    const isSharedRead=method==='GET'&&url.includes('dinqlgaveujdeyisgpty.supabase.co/rest/v1/');
    if(!isSharedRead)return nativeFetch(input,init);

    const now=Date.now();
    const cached=cache.get(url);
    if(cached&&now-cached.at<1200)return Promise.resolve(new Response(cached.body,{status:cached.status,statusText:cached.statusText,headers:cached.headers}));
    if(inflight.has(url))return inflight.get(url).then(r=>r.clone());

    const p=nativeFetch(input,init).then(async r=>{
      if(r.ok){
        const body=await r.clone().text();
        cache.set(url,{at:Date.now(),body,status:r.status,statusText:r.statusText,headers:[...r.headers.entries()]});
      }
      return r;
    }).finally(()=>inflight.delete(url));
    inflight.set(url,p);
    return p.then(r=>r.clone());
  };
})();