import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateDataset, countNumbers, weightsFor, generateGames, targetRound, rankGame } from '../lotto.mjs';
import { updateData } from '../scripts/update-data.mjs';
import { readHistory, saveHistory } from '../app.mjs';

const schedule = { anchorRound: 1, anchorDrawAt: '2002-12-07T20:35:00+09:00', periodDays: 7 };
const draws = [
  { round: 1, date: '2002-12-07', numbers: [10,23,29,33,37,40], bonus: 16 },
  { round: 2, date: '2002-12-14', numbers: [9,13,21,25,32,42], bonus: 2 },
];
const dataset = { schemaVersion: 1, updatedAt: '2026-10-05T00:00:00Z', schedule, draws };
assert.equal(validateDataset(dataset), dataset);
assert.throws(() => validateDataset({ ...dataset, draws: [] }));
for (const bad of [
  [{...draws[0], round:2}], [draws[0],draws[0]],
  [{...draws[0],numbers:[0,23,29,33,37,40]}],
  [{...draws[0],bonus:10}], [{...draws[0],date:'2002-02-30'}],
]) assert.throws(() => validateDataset({...dataset,draws:bad}));

const directory = await mkdtemp(join(tmpdir(), 'lotto-check-'));
const outputPath = join(directory, 'draws.json');
const raw = d => ({ltEpsd:d.round,ltRflYmd:d.date.replaceAll('-',''),bnsWnNo:d.bonus,
  ...Object.fromEntries(d.numbers.map((n,i)=>[`tm${i+1}WnNo`,n]))});
try {
  const initial = JSON.stringify({...dataset,draws:[draws[0]]});
  for (const response of [
    () => new Response('<html>login</html>'),
    () => { throw new Error('Timeout'); },
    () => Response.json({data:{list:[raw({...draws[1],round:3})]}}),
  ]) {
    await writeFile(outputPath, initial);
    await assert.rejects(() => updateData({outputPath,fetchImpl:async()=>response(),requestDelayMs:0}));
    assert.equal(await readFile(outputPath,'utf8'),initial);
  }
  await writeFile(outputPath, initial);
  const fetchImpl = async url => Response.json({data:{list:url.includes('New') ? draws.map(raw) : [raw(draws[1])]}});
  assert.equal((await updateData({outputPath,fetchImpl,requestDelayMs:0})).latestRound,2);
  assert.equal(JSON.parse(await readFile(outputPath,'utf8')).draws.length,2);
  assert.equal((await updateData({outputPath,fetchImpl,requestDelayMs:0})).changed,false);
  await rm(outputPath);
  const twelve=Array.from({length:12},(_,i)=>({...draws[0],round:i+1,
    date:new Date(Date.UTC(2002,11,7)+i*7*86400000).toISOString().slice(0,10)}));
  const windowFetch=async url=>{
    const center=Number(new URL(url).searchParams.get('srchLtEpsd'));
    const first=Math.max(1,Math.min(center-5,3));
    return Response.json({data:{list:url.includes('New') ? twelve.slice(first-1,first+9).map(raw) : [raw(twelve[11])]}});
  };
  assert.equal((await updateData({outputPath,fetchImpl:windowFetch,requestDelayMs:0})).latestRound,12);
  assert.equal(JSON.parse(await readFile(outputPath,'utf8')).draws.length,12);
} finally { await rm(directory,{recursive:true,force:true}); }
console.log('PASS: dataset validation and safe data update');

const counts=countNumbers(draws);
assert.equal(counts.reduce((a,b)=>a+b),14);
assert.equal(counts[22],1);
assert.equal(counts[15],1); // bonus counts equally
assert.deepEqual(weightsFor([0,2,5],'hot'),[1,3,6]);
assert.deepEqual(weightsFor([0,2,5],'cold'),[6,4,1]);
assert.deepEqual(weightsFor([0,2,5],'random'),[1,1,1]);
assert.throws(()=>weightsFor(counts,'unknown'));
for(const mode of ['hot','cold','random']) {
  const games=generateGames(counts,mode);
  assert.equal(games.length,5);
  assert.equal(new Set(games.map(g=>g.join(','))).size,5);
  for(const game of games) {
    assert.equal(new Set(game).size,6);
    assert.ok(game.every(n=>Number.isInteger(n)&&n>=1&&n<=45));
    assert.deepEqual(game,[...game].sort((a,b)=>a-b));
  }
}
assert.throws(()=>generateGames(counts,'random',()=>0),/다른 조합/);
assert.throws(()=>generateGames(counts,'random',()=>1));
const boundary=Date.parse('2002-12-07T20:35:00+09:00');
assert.equal(targetRound(schedule,boundary-1),1);
assert.equal(targetRound(schedule,boundary),2);
assert.equal(targetRound(schedule,boundary+7*86400000),3);
assert.throws(()=>targetRound({},boundary));
for(const [game,expected] of [
  [[10,23,29,33,37,40],1], [[10,23,29,33,37,16],2],
  [[10,23,29,33,37,1],3], [[10,23,29,33,1,2],4],
  [[10,23,29,1,2,3],5], [[10,23,1,2,3,4],null],
]) assert.equal(rankGame(game,draws[0]).rank,expected);
console.log('PASS: statistics, weighted generation, draw boundaries and all ranks');

let stored=null;
const storage={getItem:()=>stored,setItem:(_k,v)=>{stored=v;}};
assert.deepEqual(readHistory(storage),[]);
const records=[{id:'sample',createdAt:'2026-10-05T00:00:00Z',targetRound:1245,
  mode:'hot',games:generateGames(counts,'hot')}];
saveHistory(storage,records);
assert.deepEqual(readHistory(storage),records);
for(const bad of ['{broken',JSON.stringify({schemaVersion:9,records}),
  JSON.stringify({schemaVersion:1,records:[{...records[0],games:[[1,1,2,3,4,5]]}]})]) {
  stored=bad;
  assert.throws(()=>readHistory(storage));
  assert.throws(()=>saveHistory(storage,records));
  assert.equal(stored,bad);
}
stored=JSON.stringify({schemaVersion:1,records});
const before=stored;
assert.throws(()=>saveHistory({...storage,setItem:()=>{throw new Error('QuotaExceeded');}},[]));
assert.equal(stored,before);
// 다른 탭에서 변경한 기록을 오래된 배열로 덮어쓰지 않는다.
const original=readHistory(storage);
const tabB=[{...records[0],id:'tab-b'},...original];
saveHistory(storage,tabB,original);
const concurrentValue=stored;
assert.throws(()=>saveHistory(storage,[],original),/다른 탭/);
assert.equal(stored,concurrentValue);
console.log('PASS: browser history validation, corrupt data preservation and quota errors');
