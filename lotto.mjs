export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}

export function validateGame(game) {
  if (!Array.isArray(game) || game.length !== 6 || new Set(game).size !== 6
    || game.some(n => !Number.isInteger(n) || n < 1 || n > 45)) throw new Error('번호는 1~45의 서로 다른 정수 6개여야 합니다.');
  return game;
}

export function validateDataset(value) {
  if (!value || value.schemaVersion !== 1 || !Number.isFinite(Date.parse(value.updatedAt))
    || !Array.isArray(value.draws) || !value.draws.length) throw new Error('당첨 데이터 형식이 올바르지 않습니다.');
  const s = value.schedule;
  if (!s || !Number.isInteger(s.anchorRound) || s.anchorRound < 1 || s.periodDays !== 7
    || typeof s.anchorDrawAt !== 'string' || !/[+-]\d{2}:\d{2}$/.test(s.anchorDrawAt)
    || !Number.isFinite(Date.parse(s.anchorDrawAt))) throw new Error('추첨 일정이 올바르지 않습니다.');
  for (const [i,d] of value.draws.entries()) {
    if (!d || d.round !== i+1 || !validDate(d.date)) throw new Error('회차가 누락되거나 추첨 날짜가 잘못되었습니다.');
    validateGame(d.numbers);
    if (!Number.isInteger(d.bonus) || d.bonus < 1 || d.bonus > 45 || d.numbers.includes(d.bonus)) throw new Error('보너스 번호가 올바르지 않습니다.');
    const expectedDate = new Date(Date.parse(s.anchorDrawAt)+(d.round-s.anchorRound)*7*86400000+9*3600000).toISOString().slice(0,10);
    if (d.date !== expectedDate) throw new Error('회차와 추첨 일정이 일치하지 않습니다.');
  }
  return value;
}

export function countNumbers(draws) {
  const counts=Array(45).fill(0);
  for(const draw of draws) for(const number of [...draw.numbers,draw.bonus]) counts[number-1]++;
  return counts;
}

export function weightsFor(counts,mode) {
  if(!Array.isArray(counts) || !counts.length || counts.some(n=>!Number.isSafeInteger(n)||n<0)
    || !['hot','cold','random'].includes(mode)) throw new Error('추출 방식 또는 통계가 올바르지 않습니다.');
  const max=Math.max(...counts);
  return counts.map(n=>mode==='hot'?n+1:mode==='cold'?max-n+1:1);
}

function randomUnit() {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
}

export function generateGames(counts,mode,random=randomUnit) {
  if(counts?.length!==45) throw new Error('45개 번호 통계가 필요합니다.');
  const weights=weightsFor(counts,mode);
  const games=[],seen=new Set();
  for(let attempt=0;games.length<5 && attempt<1000;attempt++) {
    const candidates=weights.map((weight,i)=>({number:i+1,weight}));
    const game=[];
    while(game.length<6) {
      const unit=random();
      if(!Number.isFinite(unit)||unit<0||unit>=1) throw new Error('난수 값이 올바르지 않습니다.');
      let threshold=unit*candidates.reduce((s,c)=>s+c.weight,0);
      let index=candidates.length-1;
      for(let i=0;i<candidates.length;i++) {
        threshold-=candidates[i].weight;
        if(threshold<0) {index=i;break;}
      }
      game.push(candidates.splice(index,1)[0].number);
    }
    game.sort((a,b)=>a-b);
    const key=game.join(',');
    if(!seen.has(key)) {seen.add(key);games.push(game);}
  }
  if(games.length!==5) throw new Error('서로 다른 조합 5개를 만들지 못했습니다. 다시 시도해 주세요.');
  return games;
}

export function targetRound(schedule,nowMs=Date.now()) {
  if(!schedule || !Number.isInteger(schedule.anchorRound) || schedule.anchorRound<1
    || schedule.periodDays!==7 || typeof schedule.anchorDrawAt!=='string'
    || !/[+-]\d{2}:\d{2}$/.test(schedule.anchorDrawAt)
    || !Number.isFinite(Date.parse(schedule.anchorDrawAt)) || !Number.isFinite(nowMs)) throw new Error('추첨 일정을 확인할 수 없습니다.');
  return Math.max(1,schedule.anchorRound+Math.floor((nowMs-Date.parse(schedule.anchorDrawAt))/(7*86400000))+1);
}

export function rankGame(game,draw) {
  validateGame(game);
  validateGame(draw.numbers);
  const matches=game.filter(n=>draw.numbers.includes(n)).length;
  const bonusMatch=game.includes(draw.bonus);
  const rank=matches===6?1:matches===5?(bonusMatch?2:3):matches===4?4:matches===3?5:null;
  return {matches,bonusMatch,rank};
}
