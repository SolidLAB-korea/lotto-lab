import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDataset, countNumbers, validDate} from '../lotto.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const site=JSON.parse(await readFile(resolve(root,'data/site.json'),'utf8'));
const data=validateDataset(JSON.parse(await readFile(resolve(root,'data/draws.json'),'utf8')));
const url=new URL(site.url);
if(url.protocol!=='https:' || !site.url.endsWith('/') || !validDate(site.modified)) throw new Error('Invalid site metadata');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const latest=data.draws.at(-1), counts=countNumbers(data.draws);
const sorted=counts.map((count,i)=>({number:i+1,count})).sort((a,b)=>b.count-a.count || a.number-b.number);
const modified=[site.modified,latest.date].sort().at(-1);
const schema={'@context':'https://schema.org','@graph':[
  {'@type':'WebSite','@id':site.url+'#website',url:site.url,name:site.name,inLanguage:'ko',sameAs:site.repository},
  {'@type':'WebPage','@id':site.url+'#webpage',url:site.url,name:site.title,description:site.description,inLanguage:'ko',dateModified:modified,isPartOf:{'@id':site.url+'#website'}},
  {'@type':'FAQPage','@id':site.url+'#faq',mainEntity:site.faq.map(f=>({'@type':'Question',name:f.question,acceptedAnswer:{'@type':'Answer',text:f.answer}}))}
]};
const head=`<title>${escape(site.title)}</title>
  <meta name="description" content="${escape(site.description)}">
  <link rel="canonical" href="${site.url}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="${escape(site.name)}">
  <meta property="og:title" content="${escape(site.title)}">
  <meta property="og:description" content="${escape(site.description)}">
  <meta property="og:url" content="${site.url}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escape(site.title)}">
  <meta name="twitter:description" content="${escape(site.description)}">
  <script type="application/ld+json">${json(schema)}</script>`;
const content=`<section class="panel search-info" aria-labelledby="data-guide-title">
  <h2 id="data-guide-title">로또 번호 통계는 어떻게 집계하나요?</h2>
  <p>동행복권 공식 결과의 본 번호와 보너스 번호를 함께 집계합니다.</p>
  <p>${latest.date} 추첨 ${latest.round}회까지, 1회부터 ${data.draws.length}회차의 번호 ${counts.reduce((a,b)=>a+b,0).toLocaleString('ko-KR')}개를 자체 집계했습니다. 공식 당첨 결과의 원출처는 동행복권입니다.</p>
  <p>최근 ${latest.round}회 본 번호: ${latest.numbers.join(', ')} · 보너스: ${latest.bonus}</p>
  <div class="chart-scroll"><table><caption>누적 출현 횟수 상위 5개 번호 · 보너스 포함 · ${latest.date} 기준</caption><thead><tr><th scope="col">번호</th><th scope="col">출현 횟수</th></tr></thead><tbody>${sorted.slice(0,5).map(n=>`<tr><th scope="row">${n.number}</th><td>${n.count}</td></tr>`).join('')}</tbody></table></div>
  <p>많이 나온 번호의 추출 비중은 출현 횟수 + 1, 적게 나온 번호는 최다 출현 횟수 − 해당 번호 출현 횟수 + 1입니다. 완전 무작위는 모든 번호에 같은 비중을 줍니다. 과거 통계는 다음 당첨 확률을 높이지 않습니다.</p>
  <p>매주 토요일 밤과 일요일 오전에 공식 결과 갱신을 시도하며, 검증에 성공한 데이터만 배포합니다. 집계 기준일은 마지막으로 확인한 추첨 날짜입니다.</p>
  <p><a href="https://www.dhlottery.co.kr/lt645/result" target="_blank" rel="noopener noreferrer">동행복권 공식 결과</a> · <a href="${site.repository}" target="_blank" rel="noopener noreferrer">LOTTO LAB 공개 소스와 문의</a></p>
  <h2 id="faq-title">로또 번호 생성기 자주 묻는 질문</h2>
  ${site.faq.map(f=>`<details><summary>${escape(f.question)}</summary><p>${escape(f.answer)}</p></details>`).join('\n')}
</section>`;
let html=await readFile(resolve(root,'index.html'),'utf8');
for(const [name,value] of [['head',head],['content',content]]) {
  const pattern=new RegExp(`<!-- SEO:${name}:start -->[\\s\\S]*?<!-- SEO:${name}:end -->`);
  if(!pattern.test(html)) throw new Error(`Missing SEO ${name} markers`);
  html=html.replace(pattern,()=>`<!-- SEO:${name}:start -->\n${value}\n<!-- SEO:${name}:end -->`);
}
const output=resolve(root,process.argv[2] ?? '.');
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'index.html'),html);
await writeFile(resolve(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(site.url)}</loc><lastmod>${modified}</lastmod></url></urlset>\n`);
await writeFile(resolve(output,'llms.txt'),`# ${site.name}\n\n> 동행복권 공식 결과를 자체 집계하는 로또 6/45 번호 생성기입니다.\n\n## 페이지\n- [번호 생성기·통계·FAQ](${site.url}): 세 가지 방식의 5게임 생성, 브라우저 기록, PNG 저장\n- [전체 회차 데이터](${site.url}data/draws.json): 추첨 결과 JSON\n- [공개 소스와 문의](${site.repository})\n\n## 데이터 정책\n- 원출처: https://www.dhlottery.co.kr/lt645/result\n- 자체 산출: 본 번호와 보너스 번호를 함께 센 누적 출현 횟수\n- 기준: ${latest.date}, ${latest.round}회까지\n- 공식 결과 갱신을 매주 토요일 밤·일요일 오전에 시도하며 검증 실패 시 이전 데이터를 유지합니다.\n- 과거 통계는 다음 회차 당첨 확률을 높이지 않습니다.\n- 개인정보나 개인 조합 기록은 공개 데이터에 포함되지 않습니다.\n- 프로젝트 경로의 안내 파일입니다. AI 인용을 보장하지 않습니다.\n`);
console.log(`PASS: static SEO output (${latest.round} draws, ${output})`);
