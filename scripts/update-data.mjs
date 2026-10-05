import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateDataset } from '../lotto.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const settings = JSON.parse(await readFile(new URL('../data/source.json',import.meta.url),'utf8'));

function normalize(row) {
  if (!row || !/^\d{8}$/.test(String(row.ltRflYmd))) throw new Error('공식 응답의 날짜가 올바르지 않습니다.');
  const ymd = String(row.ltRflYmd);
  return {round:Number(row.ltEpsd),date:`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6)}`,
    numbers:Array.from({length:6},(_,i)=>Number(row[`tm${i+1}WnNo`])).sort((a,b)=>a-b),bonus:Number(row.bnsWnNo)};
}

export async function updateData({outputPath=resolve(root,'data/draws.json'),fetchImpl=fetch,requestDelayMs=250}={}) {
  let existing;
  try { existing=validateDataset(JSON.parse(await readFile(outputPath,'utf8'))); }
  catch(error) { if(error.code !== 'ENOENT') throw error; }
  const pause = ms => new Promise(r=>setTimeout(r,ms));
  async function get(url) {
    for(let attempt=0;attempt<2;attempt++) {
      try {
        await pause(requestDelayMs);
        const response=await fetchImpl(url,{signal:AbortSignal.timeout(20000),headers:{accept:'application/json'}});
        if(!response.ok) throw new Error(`공식 조회 HTTP ${response.status}`);
        const json=await response.json();
        if(!Array.isArray(json?.data?.list) || !json.data.list.length) throw new Error('공식 결과 목록이 없습니다.');
        return json.data.list.map(normalize);
      } catch(error) { if(attempt===1) throw error; await pause(requestDelayMs*3); }
    }
  }
  const latestRows=await get(settings.latestUrl);
  const latest=latestRows.reduce((a,b)=>a.round>b.round?a:b);
  if(!Number.isInteger(latest.round) || latest.round<1) throw new Error('최신 회차가 잘못되었습니다.');
  const previous=existing?.draws ?? [];
  if(latest.round<previous.length) throw new Error('공식 최신 결과가 기존 데이터보다 뒤처졌습니다.');
  const rounds=new Map(previous.map(d=>[d.round,d]));
  function merge(rows) {
    for(const row of rows) {
      if(!Number.isInteger(row.round) || row.round<1 || row.round>latest.round) throw new Error('공식 회차 범위 오류');
      const old=rounds.get(row.round);
      if(old && JSON.stringify(old)!==JSON.stringify(row)) throw new Error(`기존 ${row.round}회 결과와 공식 응답이 다릅니다.`);
      rounds.set(row.round,row);
    }
  }
  merge(latestRows);
  // 마지막 저장 회차도 다시 대조해 잘못된 기존 데이터의 조용한 유지를 막는다.
  let cursor=Math.max(1,previous.length);
  while(cursor<=latest.round) {
    const url=new URL(settings.batchUrl);
    url.searchParams.set('srchDir','center');
    url.searchParams.set('srchLtEpsd',String(Math.min(cursor+5,latest.round)));
    merge(await get(url.href));
    const before=cursor;
    while(cursor<=latest.round && rounds.has(cursor)) cursor++;
    if(cursor===before) throw new Error(`${cursor}회 결과가 누락되었습니다.`);
  }
  const candidate=validateDataset({schemaVersion:1,updatedAt:new Date().toISOString(),
    schedule:existing?.schedule ?? settings.schedule,draws:[...rounds.values()].sort((a,b)=>a.round-b.round)});
  if(candidate.draws.length!==latest.round) throw new Error('전체 회차 수가 맞지 않습니다.');
  if(existing && JSON.stringify(existing.draws)===JSON.stringify(candidate.draws)) return {changed:false,latestRound:latest.round};
  await mkdir(dirname(outputPath),{recursive:true});
  const temporary=`${outputPath}.${process.pid}.tmp`;
  try { await writeFile(temporary,JSON.stringify(candidate,null,2)+'\n','utf8'); await rename(temporary,outputPath); }
  finally { await unlink(temporary).catch(e=>{if(e.code!=='ENOENT') throw e;}); }
  return {changed:true,latestRound:latest.round};
}

if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    if(process.argv.includes('--check')) {
      const dataset=validateDataset(JSON.parse(await readFile(resolve(root,'data/draws.json'),'utf8')));
      console.log(`PASS: ${dataset.draws.length} consecutive official draws`);
    } else console.log(await updateData());
  } catch(error) { console.error(`갱신 실패: ${error.message}`); process.exitCode=1; }
}
