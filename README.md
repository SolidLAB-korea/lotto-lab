# 로또 통계 연구소

전체 회차 통계를 참고해 세 가지 방식으로 5게임을 생성하는 정적 웹사이트입니다. 과거 통계가 당첨 확률을 높여주지는 않습니다.

## 실행

설치할 제품용 패키지는 없습니다. 이 폴더에서 다음 명령을 실행한 뒤 http://127.0.0.1:8000 에 접속합니다.

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Python 3와 최신 브라우저가 필요합니다. 파일을 더블클릭하는 file:// 방식 대신 HTTP로 접속합니다. 서버를 종료하려면 실행한 터미널에서 Ctrl+C를 누릅니다. 번호 기록은 로그인 없이 localStorage에 저장되며, 다른 주소나 브라우저에서는 공유되지 않습니다.

검사와 데이터 갱신에는 Node.js 24 이상을 사용합니다.

```powershell
node tests/check.mjs
node scripts/update-data.mjs --check
node scripts/update-data.mjs
```

## 공식 데이터

- 출처: [동행복권 회차별 결과](https://www.dhlottery.co.kr/lt645/result)
- 최신 결과 조회: `https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do`
- 묶음 조회: `https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=회차`
- 응답의 `data.list`에서 회차·추첨일·본 번호·보너스 번호만 보관합니다. 공식 사이트 내부 조회 경로이므로 변경되면 수집 경로를 재확인해야 합니다.
- 설정 파일: `data/source.json`. 검증된 회차 파일: `data/draws.json`.
- [공식 추첨 안내](https://www.dhlottery.co.kr/lt645/intro): 매주 토요일 20:35경, 방송 사정에 따라 변동 가능. 이 예정 시각을 경계로 다음 회차를 지정하며 추첨 방송의 실시간 진행 상황을 확인하는 기능은 없습니다. 기기의 시계가 정확해야 합니다.
- 첫 추첨일 2002-12-07, 첫 회차 1회를 기준으로 7일 간격을 사용합니다. 일정은 회차 파일 메타데이터에 보관합니다.
- 기존 데이터의 일정 메타데이터를 보존합니다. 공식 추첨 일정이 바뀌면 기존 `data/draws.json`의 `schedule`도 수동으로 갱신해야 합니다. `data/source.json`만 수정해도 기존 일정이 자동 이전되는 기능은 이번 범위에서 제외했습니다.

2026-10-05에 공식 조회로 1~1244회 전체를 확보했습니다. 1244회(2026-10-03)의 본 번호는 1,13,18,26,34,38, 보너스는 25입니다. 총 8,708개 번호를 집계했습니다. 수집 실패나 검증 오류 시 기존 정상 파일을 교체하지 않습니다.

## 생성과 결과 비교

내 조합 기록의 각 항목에서 **이미지 저장**을 누르면 회차·생성 방식·생성 시각·5게임·당첨 비교를 담은 PNG를 다운로드합니다. 이미지 크기는 900×980이며 화면 너비와 관계없이 번호가 모두 포함됩니다. 기기의 브라우저 다운로드 기능을 사용하고 저장된 기록은 변경하지 않습니다.

많이 나온 번호의 가중치는 출현 횟수+1, 적게 나온 번호는 최대 출현 횟수-해당 번호 출현 횟수+1입니다. 무작위는 모두 동일한 가중치입니다. Web Crypto 난수로 중복 없이 6개씩 추출합니다. 같은 5게임 조합은 재추출하고 시도 제한을 넘으면 오류를 표시합니다.

생성 시 다음 추첨 회차를 함께 기록합니다. 결과 데이터가 갱신된 뒤 사이트를 다시 열면 기록과 비교합니다. 실제 복권을 구매했는지는 확인하지 않고 당첨금을 산정하지 않습니다.

## 무료 공개 배포

[GitHub 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)에 따라 GitHub Free에서는 공개 저장소를 사용합니다.

1. 공개 GitHub 저장소에 이 폴더의 소스와 `data/draws.json`을 업로드합니다. `tmp/`, `.git/`과 개인 기록은 업로드하지 않습니다.
2. 저장소 Settings → Pages → Source를 GitHub Actions로 선택합니다.
3. Actions → Update official draws and deploy Lotto Lab → Run workflow를 실행합니다.
4. 성공한 deploy 작업의 출력 주소에서 실제 화면과 최신 회차를 확인합니다.

기본 브랜치 이름은 저장소에서 자동으로 읽습니다. 토요일 22:17와 일요일 09:17 한국 시간에 갱신하며 예약 실행은 지연될 수 있습니다. 갱신과 검사가 성공해야만 배포합니다. 작업 동시 실행은 직렬화하고, 원격 브랜치가 실행 도중 변경되면 오래된 소스의 배포를 중단합니다. 브랜치 보호가 봇의 데이터 커밋을 막으면 저장소 정책에 맞는 별도 운영 설정이 필요합니다.

공개 사이트 artifact에는 HTML, CSS, 브라우저 모듈, 회차 JSON만 들어갑니다. 데이터 수집은 브라우저가 아니라 GitHub runner에서 수행합니다. runner의 공식 사이트 접근 가능 여부는 최초 workflow 실행으로 검증해야 합니다.

## 확인 상태

- 실제 공식 사이트 수집: 성공, 1~1244회 연속 데이터.
- Node 검사: 데이터 경계, 안전한 갱신, 통계·가중치·게임 중복 방지, 등수, 추첨 시각 경계, 손상 기록 보존과 저장 공간 오류 확인.
- 실제 브라우저: 세 방식 생성, 새로고침 후 기록 유지, 1440px PC 및 390px 모바일 화면, 개별 삭제, 전체 삭제 확인·취소, 서로 다른 탭의 기록 충돌 방지 확인. 분리된 로컬 검사 주소에서 1~5등과 추첨 대기 화면을 확인했습니다.
- 공개 주소: https://solidlab-korea.github.io/lotto-lab/
- 저장소: https://github.com/SolidLAB-korea/lotto-lab (기본 브랜치 `codex/lotto-lab`).
- GitHub runner 공식 사이트 수집·검사·Pages 배포 성공. 공개 사이트에서 최신 회차 표시, 생성, 저장, 두 탭 충돌 차단과 개별 삭제 확인.
- 수동 실행 2건을 연속 요청해 두 번째 실행의 대기 상태와 두 건의 성공을 확인했습니다. 실행 기록: [최초 배포](https://github.com/SolidLAB-korea/lotto-lab/actions/runs/37303224723), [첫 수동 실행](https://github.com/SolidLAB-korea/lotto-lab/actions/runs/37303530202), [두 번째 수동 실행](https://github.com/SolidLAB-korea/lotto-lab/actions/runs/37303545230).
- 매주 예약 실행은 설정했으며 실제 예약 시각의 실행은 아직 확인하지 않았습니다. 공식 사이트 오류 시 기존 데이터 보존은 로컬 검사로 검증했으며 운영 사이트를 의도적으로 실패시키는 실험은 수행하지 않았습니다.

기록을 생성한 localhost 주소와 공개 사이트 주소는 별도 저장 공간을 사용합니다.
`n## 검색·AI 인용 기반`n정적 통계·FAQ·메타·사이트맵·llms.txt는 `node scripts/build-seo.mjs`로 생성합니다. `node tests/seo-check.mjs`로 검사합니다. 배포 시 최신 공식 결과로 재생성하므로 HTML 통계가 갱신됩니다. 등록·측정 안내는 [docs/seo/registration-and-measurement.md](docs/seo/registration-and-measurement.md)를 확인하세요. 검색 순위·색인·AI 인용 성과는 아직 미측정입니다.
