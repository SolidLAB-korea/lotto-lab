import { validateDataset,validateGame,countNumbers,weightsFor,generateGames,targetRound,rankGame } from './lotto.mjs';

const HISTORY_KEY='lotto-lab.history.v1';
const modes={hot:'많이 나온 번호',cold:'적게 나온 번호',random:'완전 무작위'};
const descriptions={hot:'전체 회차에서 자주 등장한 번호에 조금 더 비중을 둡니다.',cold:'전체 회차에서 드물게 등장한 번호에 조금 더 비중을 둡니다.',random:'모든 번호에 같은 비중을 두고 무작위로 추출합니다.'};

function validateRecords(records) {
  if(!Array.isArray(records)) throw new Error('저장 기록이 올바르지 않습니다.');
  const ids=new Set();
  for(const record of records) {
    if(!record || typeof record.id!=='string' || !record.id || ids.has(record.id)
      || typeof record.createdAt!=='string' || !Number.isFinite(Date.parse(record.createdAt))
      || !Number.isInteger(record.targetRound) || record.targetRound<1
      || !Object.hasOwn(modes,record.mode) || !Array.isArray(record.games) || record.games.length!==5) throw new Error('저장 기록의 형식이 올바르지 않습니다.');
    ids.add(record.id);
    record.games.forEach(validateGame);
    if(new Set(record.games.map(g=>[...g].sort((a,b)=>a-b).join(','))).size!==5) throw new Error('저장 기록에 중복 조합이 있습니다.');
  }
  return records;
}

export function readHistory(storage) {
  const text=storage.getItem(HISTORY_KEY);
  if(text===null) return [];
  const data=JSON.parse(text);
  if(data?.schemaVersion!==1) throw new Error('지원하지 않는 기록 버전입니다.');
  return validateRecords(data.records);
}

export function saveHistory(storage,records,expectedRecords) {
  const current=readHistory(storage); // 손상된 기존 기록은 명시적 초기화 전까지 보존한다.
  if(expectedRecords && JSON.stringify(current)!==JSON.stringify(expectedRecords)) throw new Error('다른 탭에서 기록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.');
  validateRecords(records);
  storage.setItem(HISTORY_KEY,JSON.stringify({schemaVersion:1,records}));
}

if(typeof document!=='undefined') initialize();

async function initialize() {
  const $=id=>document.getElementById(id);
  const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const dateFormat=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
  const timeFormat=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false});
  let dataset,counts,records=[],storageBlocked=false;
  function ball(number,draw) {
    const node=el('span',`ball n${Math.min(5,Math.ceil(number/10))}`,number);
    if(draw?.numbers.includes(number)) {node.classList.add('matched');node.title='본 번호 일치';}
    else if(draw?.bonus===number) {node.classList.add('bonus-matched');node.title='보너스 번호 일치';}
    return node;
  }
  function balls(game,draw) {const node=el('div','balls');node.append(...game.map(n=>ball(n,draw)));return node;}
  function renderGames(games) {
    $('games').replaceChildren(...games.map((g,i)=>{
      const row=el('div','game-row');row.append(el('span','game-label',String.fromCharCode(65+i)),balls(g));return row;
    }));
  }
  function renderHistory() {
    $('history-count').textContent=records.length;
    $('clear-history').disabled=!records.length || storageBlocked;
    const list=$('history-list');list.replaceChildren();
    if(!records.length) {
      const empty=el('div','empty-history','아직 저장한 조합이 없어요.');
      empty.append(el('span','','첫 5게임을 생성하면 여기에 기록됩니다.'));list.append(empty);return;
    }
    for(const record of records) {
      const entry=el('article','history-entry');
      const head=el('div','history-head');
      const time=el('time','',`${dateFormat.format(new Date(record.createdAt))} ${timeFormat.format(new Date(record.createdAt))}`);
      time.dateTime=record.createdAt;
      const remove=el('button','secondary','삭제');remove.type='button';remove.disabled=storageBlocked;
      remove.setAttribute('aria-label',`${record.targetRound}회 ${time.textContent} 생성 기록 삭제`);
      remove.addEventListener('click',()=>persist(records.filter(r=>r.id!==record.id)));
      head.append(el('strong','',`${record.targetRound}회`),el('span','tag',modes[record.mode]),time,remove);entry.append(head);
      const draw=dataset?.draws.find(d=>d.round===record.targetRound);
      for(const [i,game] of record.games.entries()) {
        const row=el('div','history-game');row.append(el('span','game-label',String.fromCharCode(65+i)),balls(game,draw));
        let label=dataset?'추첨 결과 대기':'당첨 데이터 확인 불가';
        let rank;
        if(draw) {
          const result=rankGame(game,draw);rank=result.rank;
          label=`${rank?`${rank}등`:'미당첨'} · 본 번호 ${result.matches}개 일치${result.bonusMatch?' · 보너스 일치':''}`;
        }
        row.append(el('span',`result-label${rank?' winner':''}`,label));entry.append(row);
      }
      if(draw)entry.append(el('p','entry-note','테두리 표시: 본 번호 일치 · 점선 표시: 보너스 번호 일치'));
      list.append(entry);
    }
  }
  function storageError(error) {
    $('history-status').textContent=`기록에 접근하거나 저장하지 못했습니다. 기존 기록을 보존합니다. ${error.message}`;
    storageBlocked=true;$('reset-history').hidden=false;renderHistory();
  }
  function persist(next) {
    try {saveHistory(localStorage,next,records);records=next;$('history-status').textContent='';renderHistory();return true;}
    catch(error){storageError(error);return false;}
  }
  try {records=readHistory(localStorage);}catch(error){storageError(error);}
  renderHistory();
  function confirmDelete(message) {
    const dialog=$('delete-dialog');
    $('delete-message').textContent=message;
    dialog.returnValue='cancel';
    return new Promise(resolve=>{
      dialog.addEventListener('close',()=>resolve(dialog.returnValue==='delete'),{once:true});
      dialog.showModal();
    });
  }
  $('clear-history').addEventListener('click',async()=>{
    if(await confirmDelete('이 브라우저에 저장한 모든 조합을 삭제합니다. 삭제한 기록은 복구할 수 없습니다.'))persist([]);
  });
  $('reset-history').addEventListener('click',async()=>{
    if(!await confirmDelete('기존 저장 기록을 초기화합니다. 삭제한 기록은 복구할 수 없습니다.'))return;
    try{localStorage.removeItem(HISTORY_KEY);records=[];storageBlocked=false;$('reset-history').hidden=true;$('history-status').textContent='저장 기록을 초기화했습니다.';renderHistory();}
    catch(error){storageError(error);}
  });
  document.querySelectorAll('input[name="mode"]').forEach(input=>input.addEventListener('change',()=>{$('mode-description').textContent=descriptions[input.value];}));
  function refreshTarget() {
    const round=targetRound(dataset.schedule);
    const drawAt=new Date(Date.parse(dataset.schedule.anchorDrawAt)+(round-dataset.schedule.anchorRound)*7*86400000);
    $('target-round').textContent=`${round.toLocaleString('ko-KR')}회`;
    $('generation-target').textContent=`${round}회 조합`;
    $('target-date').textContent=`${dateFormat.format(drawAt)} 추첨 예정`;
    const stale=dataset.draws.length<round-1;
    $('data-status').classList.toggle('warning',stale);
    $('data-status').textContent=stale?`최신 결과 갱신이 지연되고 있습니다. ${dataset.draws.length}회까지의 검증된 통계로 생성합니다.`:`1회부터 ${dataset.draws.length}회까지 · 공식 당첨 결과 검증 완료 · 추첨 예정 시각 토요일 20:35경 (방송 사정에 따라 변동 가능)`;
    return round;
  }
  $('generate').addEventListener('click',()=>{
    try {
      const mode=document.querySelector('input[name="mode"]:checked').value;
      const round=refreshTarget();
      const games=generateGames(counts,mode);renderGames(games);
      const record={id:crypto.randomUUID(),createdAt:new Date().toISOString(),targetRound:round,mode,games};
      const saved=!storageBlocked && persist([record,...records]);
      $('generation-status').classList.toggle('error',!saved);
      $('generation-status').textContent=saved?`${round}회 조합 5게임을 이 브라우저에 저장했습니다.`:'5게임을 생성했지만 기록을 저장하지 못했습니다. 번호를 따로 보관해 주세요.';
    }catch(error){$('generation-status').textContent=error.message;$('generation-status').classList.add('error');}
  });
  try {
    const response=await fetch(new URL('./data/draws.json',import.meta.url),{cache:'no-store'});
    if(!response.ok)throw new Error(`데이터 HTTP ${response.status}`);
    dataset=validateDataset(await response.json());counts=countNumbers(dataset.draws);
    const latest=dataset.draws.at(-1);
    $('latest-round').textContent=`${latest.round}회`;$('latest-date').textContent=`${latest.date.replaceAll('-','.')} 추첨`;
    const bonus=el('div','bonus-wrap');bonus.append(el('span','bonus-plus','+'),ball(latest.bonus));bonus.setAttribute('aria-label',`보너스 번호 ${latest.bonus}`);
    $('latest-balls').append(...latest.numbers.map(n=>ball(n)),bonus);
    $('draw-count').textContent=`${dataset.draws.length.toLocaleString('ko-KR')}회`;
    $('number-count').textContent=counts.reduce((a,b)=>a+b).toLocaleString('ko-KR');
    $('updated-date').textContent=dateFormat.format(new Date(dataset.updatedAt));
    $('updated-time').textContent=`${timeFormat.format(new Date(dataset.updatedAt))} KST · 수집 성공`;
    const ordered=counts.map((count,i)=>({number:i+1,count}));
    const hot=[...ordered].sort((a,b)=>b.count-a.count||a.number-b.number).slice(0,5);
    const cold=[...ordered].sort((a,b)=>a.count-b.count||a.number-b.number).slice(0,5);
    for(const [id,items] of [['hot-list',hot],['cold-list',cold]]) {
      const list=$(id);if(id==='cold-list')list.classList.add('cold');
      list.replaceChildren(...items.map((item,i)=>{
        const row=el('li');const track=el('div','rank-track');const fill=el('div','rank-fill');fill.style.width=`${item.count/Math.max(...counts)*100}%`;track.append(fill);
        row.append(el('span','rank-index',i+1),el('span','rank-number',item.number),track,el('span','rank-count',`${item.count}회`));return row;
      }));
    }
    const maximum=Math.max(...counts);
    $('frequency-chart').replaceChildren(...ordered.map(({number,count})=>{
      const type=hot.some(i=>i.number===number)?'hot':cold.some(i=>i.number===number)?'cold':'';
      const column=el('div',`chart-column ${type}`);column.setAttribute('aria-label',`${number}번 ${count}회`);
      const track=el('div','bar-track');const bar=el('div','bar');bar.style.height=`${count/maximum*100}%`;track.append(bar);
      column.append(track,el('span','chart-number',number),el('span','chart-count',count));return column;
    }));
    refreshTarget();renderHistory();$('generate').disabled=false;
    // ponytail: 브라우저의 시계 기준 예정 회차. 공식 일정 변경 시 source.json 일정을 갱신한다.
    setInterval(()=>{try{refreshTarget();}catch(error){$('generate').disabled=true;$('data-status').textContent=error.message;}},30000);
  }catch(error){$('data-status').textContent=`공식 당첨 데이터를 불러오지 못했습니다. 새로고침해 주세요. (${error.message})`;$('data-status').classList.add('warning');}
}
