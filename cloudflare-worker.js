const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...C,'Content-Type':'application/json'}});
const cnt=v=>{let l=0,d=0;for(const x of Object.values(v.v))x>0?l++:d++;return{l,d}};
const meta=v=>({name:v.name,p:v.desc.slice(0,160),by:v.by,u:v.uid,t:v.t,dv:v.dev?1:0,...cnt(v)});
const str=(x,n)=>typeof x==='string'&&x.length>0&&x.length<=n;
export default{async fetch(req,env){
C['Access-Control-Allow-Origin']=env.ALLOWED_ORIGIN||'*';
if(req.method==='OPTIONS')return new Response(null,{headers:C});
const p=new URL(req.url).pathname;
const o=req.headers.get('Origin');if(env.ALLOWED_ORIGIN&&o&&o!==env.ALLOWED_ORIGIN)return J({error:'Origin not allowed.'},403);
try{
if(req.method==='GET'&&p==='/kb'){if(!env.KB)return J({error:'KB storage is not connected.'},500);const l=await env.KB.list({prefix:'k:',limit:200});return J({items:l.keys.map(k=>({key:k.name,...(k.metadata||{})}))})}
if(req.method!=='POST')return new Response('Chat Max worker is running.',{headers:C});
const b=await req.json();
if(p==='/chat'){if(!env.GROQ_KEY)return J({error:{message:'Chat server key is not set.'}},500);if(!b||!['openai/gpt-oss-20b','openai/gpt-oss-120b','qwen/qwen3.8-27b'].includes(b.model)||!Array.isArray(b.messages))return J({error:{message:'Invalid chat request.'}},400);const body={model:b.model,messages:b.messages,max_tokens:Math.min(Number(b.max_tokens)||1024,8192)};if(typeof b.reasoning_effort==='string')body.reasoning_effort=b.reasoning_effort;const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.GROQ_KEY},body:JSON.stringify(body)});return new Response(await r.text(),{status:r.status,headers:{...C,'Content-Type':'application/json'}})}
if(p==='/dev/check'){if(!env.DEV_CODE)return J({error:'Developer code is not set on the server.'},500);if(typeof b.code!=='string'||b.code!==env.DEV_CODE){await new Promise(r=>setTimeout(r,1500));return J({error:'Invalid code.'},403)}return J({ok:1})}
if(p.startsWith('/kb/')){
if(!env.KB)return J({error:'KB storage is not connected.'},500);
if(!str(b.uid,40))return J({error:'Invalid user.'},400);
if(p==='/kb/pub'){
if(!str(b.name,80)||!str(b.by,40)||typeof b.desc!=='string'||b.desc.length>4000)return J({error:'Invalid knowledge.'},400);
let key=b.key,v;
if(key){v=await env.KB.get(key,'json');if(!v||v.uid!==b.uid)return J({error:'Not allowed.'},403);v.name=b.name;v.desc=b.desc;v.by=b.by}
else{key='k:'+String(9999999999999-Date.now()).padStart(13,'0')+':'+Math.random().toString(36).slice(2,8);v={name:b.name,desc:b.desc,by:b.by,uid:b.uid,t:Date.now(),v:{}}}
v.dev=env.DEV_CODE&&typeof b.dc==='string'&&b.dc===env.DEV_CODE?1:0;
await env.KB.put(key,JSON.stringify(v),{metadata:meta(v)});
return J({key})}
const v=b.key?await env.KB.get(b.key,'json'):null;
if(!v)return J({error:'Not found.'},404);
if(p==='/kb/get')return J({desc:v.desc,...cnt(v),my:v.v[b.uid]||0});
if(p==='/kb/del'){if(v.uid!==b.uid)return J({error:'Not allowed.'},403);await env.KB.delete(b.key);return J({ok:1})}
if(p==='/kb/vote'){const x=b.v===1?1:b.v===-1?-1:0;if(!x)return J({error:'Invalid vote.'},400);if(v.v[b.uid]===x)delete v.v[b.uid];else v.v[b.uid]=x;await env.KB.put(b.key,JSON.stringify(v),{metadata:meta(v)});return J({...cnt(v),my:v.v[b.uid]||0})}
return J({error:'Unknown route.'},404)}
const{prompt,steps}=b;
if(!prompt||typeof prompt!=='string'||prompt.length>1000)return J({error:'Invalid prompt.'},400);
const r=await env.AI.run('@cf/black-forest-labs/flux-1-schnell',{prompt,steps:Math.min(8,Math.max(1,Number(steps)||4))});
return J({image:r.image})
}catch(e){return J({error:String((e&&e.message)||e)},500)}
}};
