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

export function historyResultLabel(game,draw,dataAvailable) {
  if(!draw) return dataAvailable?'추첨 결과 대기':'당첨 데이터 확인 불가';
  const result=rankGame(game,draw);
  return `${result.rank?`${result.rank}등`:'미당첨'} · 본 번호 ${result.matches}개 일치${result.bonusMatch?' · 보너스 일치':''}`;
}

async function saveRecordImage(record,draw,dataAvailable) {
  validateRecords([record]);
  await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=900;canvas.height=980;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('이 브라우저에서 이미지 저장을 지원하지 않습니다.');
  const font='"Segoe UI", "Malgun Gothic", sans-serif';
  function text(value,x,y,size,color='#f2f3f5',weight=400) {
    ctx.font=`${weight} ${size}px ${font}`;ctx.fillStyle=color;ctx.fillText(value,x,y);
  }
  ctx.fillStyle='#101114';ctx.fillRect(0,0,900,980);
  text('LOTTO LAB · 로또 통계 연구소',48,65,22,'#d7fa65',700);
  text(`${record.targetRound}회 · 내 조합 기록`,48,124,36,'#f2f3f5',700);
  const created=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(record.createdAt));
  text(`${modes[record.mode]}  |  생성 ${created} KST`,48,164,19,'#a1a4af');
  const colors=[['#58492a','#ffe095'],['#243e5b','#95c6ff'],['#563039','#ffaab7'],['#3e4049','#d3d5dd'],['#2c463a','#9adebb']];
  for(const [i,game] of record.games.entries()) {
    const y=208+i*126;
    ctx.fillStyle='#202127';ctx.beginPath();ctx.roundRect(48,y,804,112,12);ctx.fill();
    text(String.fromCharCode(65+i),70,y+49,21,'#a1a4af',700);
    for(const [j,number] of game.entries()) {
      const x=160+j*120,cy=y+40;
      const [background,foreground]=colors[Math.min(4,Math.ceil(number/10)-1)];
      ctx.beginPath();ctx.arc(x,cy,27,0,Math.PI*2);ctx.fillStyle=background;ctx.fill();
      if(draw?.numbers.includes(number) || draw?.bonus===number) {
        ctx.strokeStyle=draw.numbers.includes(number)?'#d7fa65':'#b7a1ff';ctx.lineWidth=3;
        ctx.setLineDash(draw.numbers.includes(number)?[]:[5,4]);ctx.stroke();ctx.setLineDash([]);
      }
      ctx.textAlign='center';text(number,x,cy+8,23,foreground,700);ctx.textAlign='left';
    }
    text(historyResultLabel(game,draw,dataAvailable),122,y+92,18,'#c5c8d2');
  }
  if(draw)text(`추첨일 ${draw.date} · 테두리: 본 번호 일치 / 점선: 보너스 일치`,48,872,17,'#a1a4af');
  text('과거 출현 통계는 다음 회차 당첨 확률을 높여주지 않습니다.',48,923,18,'#a1a4af');
  text('비교 결과는 참고용입니다. 실제 복권은 공식 결과와 대조해 주세요.',48,953,17,'#a1a4af');
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('이미지를 만들지 못했습니다. 다시 시도해 주세요.');
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;
  const stamp=record.createdAt.replace(/[^0-9]/g,'').slice(0,14);
  link.download=`lotto-${record.targetRound}-${stamp}.png`;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
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
      const saveImage=el('button','secondary','이미지 저장');saveImage.type='button';
      saveImage.setAttribute('aria-label',`${record.targetRound}회 ${time.textContent} 생성 기록 이미지 저장`);
      saveImage.addEventListener('click',async()=>{
        saveImage.disabled=true;
        try {
          await saveRecordImage(record,dataset?.draws.find(d=>d.round===record.targetRound),!!dataset);
          $('history-status').textContent='PNG 이미지 다운로드를 요청했습니다.';
        }catch(error){$('history-status').textContent=`이미지 저장 실패: ${error.message}`;}
        finally{saveImage.disabled=false;}
      });
      const actions=el('div','history-actions');actions.append(saveImage,remove);
      head.append(el('strong','',`${record.targetRound}회`),el('span','tag',modes[record.mode]),time,actions);entry.append(head);
      const draw=dataset?.draws.find(d=>d.round===record.targetRound);
      for(const [i,game] of record.games.entries()) {
        const row=el('div','history-game');row.append(el('span','game-label',String.fromCharCode(65+i)),balls(game,draw));
        const label=historyResultLabel(game,draw,!!dataset);
        const rank=draw && rankGame(game,draw).rank;
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
