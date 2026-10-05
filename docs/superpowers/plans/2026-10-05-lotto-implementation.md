# 로또 통계 연구소 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 전체 회차 통계 기반 5게임 생성, 브라우저 기록, 당첨 비교를 제공하는 무료 공개 웹사이트를 완성한다.

**Architecture:** 정적 웹사이트가 같은 사이트의 검증된 회차 JSON을 읽는다. 브라우저에서 통계와 번호를 계산하고 localStorage에 기록한다. 예약 작업이 공식 데이터를 갱신한 뒤 GitHub Pages로 배포한다.

**Tech Stack:** HTML, CSS, JavaScript ES modules, Node.js 내장 API, GitHub Actions/Pages. 제품용 외부 패키지와 빌드 도구는 추가하지 않는다.

**Spec:** `docs/superpowers/specs/2026-10-05-lotto-design.md`

## Global Constraints

- 전체 회차의 본 번호 6개와 보너스 번호 1개를 동일하게 집계한다.
- 많이 나온 번호 중심·적게 나온 번호 중심·완전 무작위 중 선택해 5게임을 생성한다.
- 한 게임 안에서는 번호가 중복되지 않고, 생성된 5게임도 서로 다른 조합이다.
- 매주 토요일 22:17과 일요일 09:17 한국 시간에 갱신을 시도하고 수동 실행도 제공한다.
- '과거 출현 통계는 다음 회차 당첨 확률을 높여주지 않습니다'를 표시한다.
- 로그인, 서버 데이터베이스, 결제, 포함·제외 번호 설정은 만들지 않는다.
- 공식 데이터 수집과 공개 URL, 예약 실행을 실제 검증하기 전에는 운영 완료를 주장하지 않는다.

## Review Focus

1. 공식 사이트가 정상 HTTP 상태로 로그인 HTML을 반환해도 기존 데이터가 보존되어야 한다 → 작업 1.
2. 결과 갱신 지연과 토요일 추첨 경계에도 이미 추첨한 회차를 대상으로 생성하지 않아야 한다 → 작업 2.
3. 손상된 저장 기록과 저장 공간 부족에도 기존 기록이 덮어써지지 않아야 한다 → 작업 3.
4. 저장소 하위 경로로 배포해도 모듈과 JSON이 로드되어야 한다 → 작업 4.
5. 두 갱신 작업의 실행이 겹쳐도 검증되지 않은 파일이나 이전 결과가 배포되지 않아야 한다 → 작업 4.

## 파일 구성과 공통 데이터

- `index.html`, `styles.css`: 접근성 있는 반응형 대시보드.
- `app.mjs`: 화면, 데이터 로딩, 저장 기록과 오류 처리.
- `lotto.mjs`: 데이터 검증, 통계, 생성, 대상 회차, 등수 계산.
- `scripts/update-data.mjs`: 공식 결과 수집과 검증 후 파일 교체.
- `data/draws.json`: `{schemaVersion:1, updatedAt:ISO문자열, schedule:{anchorRound,anchorDrawAt,periodDays:7}, draws:[{round,date,numbers,bonus}]}`. `anchorDrawAt`은 시간대 오프셋이 포함된 공식 추첨 기준 시각이며 근거를 README에 적는다.
- `tests/check.mjs`: Node.js 내장 assert 기반 단일 실행 검사. 비공식 테스트 데이터는 이 파일 안에서만 사용한다.
- `.github/workflows/update-and-deploy.yml`: 갱신, 검증, 배포.
- `README.md`: 로컬 실행, 공식 데이터 출처, 운영 연결 및 검증 결과.

## 작업 1: 공식 데이터 확보와 안전한 갱신

**Files:** `scripts/update-data.mjs`, `data/draws.json`, `lotto.mjs`, `tests/check.mjs`, `README.md`.

**Interfaces:** `validateDataset(value) -> 검증된 dataset 또는 예외`; `updateData({outputPath,fetchImpl}) -> {changed,latestRound}`. fetchImpl은 기본 fetch를 사용하고 검사에서만 대체한다.

- [x] 공식 사이트의 현재 결과 경로, 전체 회차 접근, 추첨 시각을 실제 확인하고 근거 URL을 README에 기록한다. 전체 수집 경로가 막히면 여기서 사실을 보고하고 대체 출처를 사용자와 결정한다.
- [x] 검사 작성: `assert.throws(() => validateDataset({draws:[]}))`; 누락·중복 회차, 범위 밖 번호, 보너스 중복을 각각 거부하고 정상 2회차는 승인한다.
- [x] `node tests/check.mjs`를 실행해 미구현 함수로 실패함을 확인한다.
- [x] 검증과 수집 구현. 요청별 제한 시간, 제한된 재시도, 낮은 요청 빈도를 적용한다. 최초 실행은 전체를 확보하고 이후에는 기존 파일 검증 후 누락된 최신 회차만 추가한다. 기존 회차가 달라지면 교체하지 않고 보고한다. 수집 파일 전체 검증 후 같은 디렉터리의 임시 파일을 원자적으로 교체한다.
- [x] HTTP 200 로그인 HTML, 시간 초과, 중간 회차 실패를 모의 입력으로 주고 기존 파일 내용이 그대로인지 assert로 확인한다. 모두 성공하기 전에는 updatedAt도 바뀌지 않아야 한다.
- [x] `node tests/check.mjs`와 `node scripts/update-data.mjs`를 실행한다. 전체 회차 연속성, 첫 회차·최근 회차를 공식 결과와 대조한다. 재실행 시 데이터 중복이 없어야 한다.

## 작업 2: 통계·생성·대상 회차·당첨 판정

**Files:** `lotto.mjs`, `tests/check.mjs`.

**Interfaces:** `countNumbers(draws) -> 길이 45의 횟수 배열`; `weightsFor(counts,mode) -> 가중치 배열`; `generateGames(counts,mode,randomUnit?) -> number[5][6]`; `targetRound(schedule,nowMs) -> 정수`; `rankGame(game,draw) -> {matches,bonusMatch,rank}`. mode는 `hot|cold|random`, rank는 1~5 또는 null이다. randomUnit의 기본값은 Web Crypto로 만든 [0,1) 난수다.

- [x] 검사 작성: 집계 합계가 `draws.length*7`; `[0,2,5]`의 hot 가중치 `[1,3,6]`, cold `[6,4,1]`, random `[1,1,1]`; 5게임 각각 길이 6, 범위 1~45, 오름차순, 중복 조합 없음.
- [x] `node tests/check.mjs`로 새 검사가 실패하는 것을 확인한다.
- [x] 위 함수들을 구현한다. 가중치 비복원 추출을 사용하고 게임 조합 중복 시 다시 추출한다. 최대 1,000번 시도 후 예외를 던져 부분 결과 저장을 막는다. mode·counts·난수 입력을 검증한다.
- [x] 경계 검사: 공식 anchorDrawAt 1ms 전은 anchorRound, 해당 시각부터는 anchorRound+1, 7일 뒤는 anchorRound+2. 시스템 시간대가 달라도 같은 결과여야 한다. 일정 메타데이터가 잘못되면 생성이 차단된다.
- [x] 판정 검사: 6개=1등, 5개+보너스=2등, 5개=3등, 4개=4등, 3개=5등, 나머지=null. 고정 난수가 같은 게임만 만들면 재시도 제한에서 실패하는지 확인한다.
- [x] `node tests/check.mjs`가 모두 통과하는지 확인한다.

## 작업 3: 대시보드와 브라우저 기록

**Files:** `index.html`, `styles.css`, `app.mjs`, `tests/check.mjs`.

**Interfaces:** app은 작업 1·2 함수를 가져온다. `readHistory(storage) -> 기록 배열 또는 예외`; `saveHistory(storage,records) -> void 또는 예외`. 기록은 `{id,createdAt,targetRound,mode,games}`이며 저장 봉투는 `{schemaVersion:1,records}`다.

- [x] 검사 작성: 손상 JSON·알 수 없는 버전·잘못된 게임은 거부한다. `setItem`이 예외를 던지면 기존 값은 그대로이고 저장 실패가 전파된다.
- [x] `node tests/check.mjs`로 저장 관련 검사 실패를 확인한 뒤 readHistory/saveHistory를 구현한다. DOM 없는 import가 가능하도록 화면 초기화는 document가 있을 때만 실행한다.
- [x] 상단 데이터 상태, 방식 선택, 생성 버튼, 번호 카드 5개, 45개 빈도 차트, 상위·하위 빈도 목록, 기록과 판정 화면을 구현한다. 차트는 CSS로 만들고 번호·횟수 텍스트도 제공한다. 같은 횟수면 번호 오름차순으로 정렬한다.
- [x] 데이터 로딩 중·오류 시 생성 버튼을 비활성화한다. 갱신 지연, 기록 저장 실패, 손상 기록 초기화를 명확히 안내한다. JSON 값은 textContent로 표시한다. 개별 삭제와 확인 후 전체 삭제를 제공한다.
- [x] `node tests/check.mjs`를 실행한다. 실제 브라우저의 390px·1440px 화면에서 키보드 조작, 세 가지 방식 생성, 새로고침 후 기록 유지, 삭제·확인 취소, 추첨 대기 및 판정 표시를 확인한다. 합성 당첨 데이터는 검증 용도로만 사용하고 제품 데이터에 섞지 않는다.

## 작업 4: 무료 배포와 자동 운영 확인

**Files:** `.github/workflows/update-and-deploy.yml`, `README.md`.

**Interfaces:** 갱신 스크립트 성공 및 검사 통과 후에만 검증된 정적 파일을 Pages artifact로 배포한다. workflow_dispatch와 예약 트리거를 제공한다.

- [x] GitHub 계정 접근, 원격 저장소, Pages 사용 가능 여부를 확인한다. 연결할 계정 정보가 없으면 로컬 완성과 배포 가능한 파일까지 끝낸 뒤 필요한 연결 정보만 요청한다.
- [x] cron `17 13 * * 6`, `17 0 * * 0`을 설정한다(UTC 기준, 한국 시간 토요일 22:17·일요일 09:17). 배포 작업은 concurrency로 직렬화하고 진행 중 작업을 취소하지 않는다. 갱신과 검사 실패 시 데이터 저장·배포 단계를 실행하지 않는다.
- [x] workflow의 검증 데이터 저장 단계는 저장소 쓰기 권한을 최소 범위로 사용한다. 공개 artifact에는 정적 파일과 회차 JSON만 포함한다. git 쓰기는 환경 권한이 허용되는 방식으로 처리하며 실패하면 배포가 완료됐다고 보고하지 않는다.
- [x] 저장소 하위 URL에서 CSS·모듈·JSON이 정상 로드되는지 확인한다. 경로는 루트 절대 경로 대신 상대 경로를 사용한다.
- [x] 수동 workflow를 실제 실행해 공식 데이터 확보, 검사, 파일 저장, 공개 URL의 최신 회차를 확인한다. 공식 조회 실패 시 기존 파일이 보존되는 로컬 검사도 확인한다. 운영 사이트에 의도적인 실패를 주입하지 않는다.
- [x] 두 workflow를 연속 실행해 concurrency 직렬화를 확인한다. 예약 실행은 실제 실행 기록 확인 전까지 '설정 완료·예약 실행 미확인'으로 보고한다.
- [x] README에 실행 명령, 확인된 수집 경로와 추첨 기준, 공개 주소, 데이터 기준 회차, 실제 검증과 미검증 항목을 기록한다. 로컬 서버는 사용 가능한 Python의 `python -m http.server 8000`을 우선 사용한다.

## 자체 검토와 실행 방식

설계의 모든 기능을 위 네 작업에 배치했다. 데이터·저장 경계에서 검증하고 생성·판정·시간 계산은 하나의 검사 파일로 확인한다. 새 프레임워크, 회원 시스템, DB, 구매 기능은 추가하지 않는다.

권장 방식은 현재 대화에서 직접 구현하는 Native 방식이다. 작은 정적 사이트이고 네 작업의 인터페이스가 단순하다. 사용자가 계획을 검토하고 실행 방식을 선택한 뒤 구현을 시작한다. 하위 에이전트 방식은 별도로 선택하는 경우에만 사용한다.

실행 결과: 2026-10-05 직접 구현과 공개 배포 완료. 실제 수동 갱신·직렬 실행·공개 브라우저 동작을 검증했다. 주간 예약 트리거는 설정했으나 실제 예약 시각의 실행은 아직 확인하지 않았다. 상세 근거는 README.md와 progress.md에 기록했다.
