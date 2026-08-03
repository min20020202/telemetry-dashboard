# NS26F 텔레메트리 홈페이지 공동 작업 안내

- GitHub 저장소: <https://github.com/min20020202/telemetry-dashboard>
- 실제 홈페이지: <https://nssur-telemetry-dashboard-v2.vercel.app>

이 안내서는 **최초 한 번만 해야 하는 설정**과 **앞으로 작업할 때마다 해야 하는 과정**으로 나뉩니다. VS Code는 이미 설치되어 있다고 가정합니다.

---

## 1. 최초 한 번만 설정하기

### 1-1. GitHub 초대 수락

1. 초대받은 **본인의 GitHub 계정**으로 로그인합니다.
2. GitHub 알림이나 이메일에서 `telemetry-dashboard` 저장소 초대를 엽니다.
3. `Accept invitation`을 누릅니다.

저장소 소유자 `min20020202`의 계정이나 비밀번호는 필요하지 않습니다.

### 1-2. Git 설치 확인

Mac의 터미널을 열고 실행합니다.

```bash
git --version
```

`git version ...`이 표시되면 이미 설치된 것이므로 다음 단계로 넘어갑니다.

명령을 찾을 수 없다는 메시지가 나오면 다음 명령을 실행하고 설치 창에서 `설치`를 누릅니다.

```bash
xcode-select --install
```

### 1-3. Live Server 설치

1. VS Code 왼쪽의 `Extensions`를 엽니다.
2. `Live Server`를 검색합니다.
3. 제작자가 `Ritwick Dey`인지 확인합니다.
4. `Install`을 누릅니다.

Live Server는 수정한 홈페이지를 실제 사이트에 올리기 전에 자기 컴퓨터에서 확인하는 도구입니다.

### 1-4. VS Code에서 GitHub 로그인

1. VS Code 왼쪽 아래 계정 아이콘을 클릭합니다.
2. `Sign in with GitHub`를 선택합니다.
3. 저장소 초대를 수락한 **본인의 GitHub 계정**으로 로그인합니다.
4. 브라우저에서 VS Code 접근 권한을 승인합니다.

### 1-5. 프로젝트 내려받기(Clone)

1. VS Code에서 `Command + Shift + P`를 누릅니다.
2. `Git: Clone`을 검색해서 선택합니다.
3. 아래 주소를 입력합니다.

```text
https://github.com/min20020202/telemetry-dashboard.git
```

4. 프로젝트를 저장할 위치를 선택합니다.
5. 다운로드가 끝나면 `Open`을 누릅니다.
6. 신뢰 여부를 물으면 `Yes, I trust the authors`를 선택합니다.

여기까지는 최초 한 번만 하면 됩니다.

---

## 2. 앞으로 작업할 때마다 해야 하는 과정

### 2-1. 작업 전에 업데이트된 코드 받기(Pull)

다른 사람이 수정한 최신 파일을 먼저 받아야 합니다.

1. VS Code에서 `telemetry-dashboard` 프로젝트를 엽니다.
2. 상단 메뉴에서 `Terminal → New Terminal`을 선택합니다.
3. 다음 명령을 실행합니다.

```bash
git pull origin main
```

`Already up to date`가 나오면 이미 최신 상태입니다.

Pull은 다음 방향으로 파일을 가져옵니다.

```text
GitHub의 최신 코드 → 내 컴퓨터
```

> 다른 사람이 올린 작업을 놓치지 않도록 파일을 수정하기 전에 항상 Pull합니다.

### 2-2. 홈페이지 수정

주요 파일의 역할은 다음과 같습니다.

| 파일 | 역할 |
| --- | --- |
| `index.html` | 화면 구성, 버튼, 문구 |
| `style.css` | 색상, 크기, 위치 등 디자인 |
| `app.js` | CSV 분석, 차트, GPS 등 기능 |
| `filters.js` | 노이즈 필터 (그래프 우클릭 메뉴) |
| `steering.js` | 조향 영점 보정 (핸들 위젯 ⚙ 버튼) |
| `realtime.js` | 5번 탭 실시간 무선 텔레메트리 |
| `tools/rf_bridge.py` | RF 수신 PC에서 실행하는 중계 서버 (웹사이트와 별개) |
| `team_logo.png` | 팀 로고 |
| `vercel.json` | 배포 설정 — 특별한 이유가 없으면 수정하지 않기 |

파일을 수정한 뒤 `Command + S`로 저장합니다.

### 2-3. Live Server로 확인

1. `index.html`을 엽니다.
2. VS Code 오른쪽 아래 `Go Live`를 누릅니다.

`Go Live`가 보이지 않으면 `index.html`을 마우스 오른쪽 버튼으로 누르고 `Open with Live Server`를 선택합니다.

브라우저에 열리는 `http://127.0.0.1:5500` 주소는 자기 컴퓨터에서만 보이는 테스트 주소입니다.

다음 항목을 확인합니다.

- 화면과 로고가 깨지지 않았는지
- 버튼과 탭이 정상적으로 작동하는지
- CSV와 차트 기능에 오류가 없는지
- 의도한 수정 내용이 정확히 표시되는지

### 2-4. 수정한 코드 업로드(Commit + Push)

1. VS Code 왼쪽의 `Source Control`을 엽니다.
2. `Changes`에 표시된 수정 파일을 확인합니다.
3. 메시지 입력란에 수정 내용을 간단히 작성합니다.
4. `Commit`을 누릅니다.
5. 확인창이 나오면 `Stage All Changes and Commit`을 선택합니다.
6. `Sync Changes` 또는 `Push`를 누릅니다.

이 과정은 다음 방향으로 파일을 보냅니다.

```text
내 컴퓨터의 수정 코드 → GitHub → Vercel → 실제 홈페이지
```

GitHub에 Push되면 Vercel이 실제 홈페이지를 자동으로 배포합니다. Vercel에 따로 로그인하거나 배포 버튼을 누를 필요는 없습니다.

### 2-5. 실제 홈페이지 확인

잠시 기다린 뒤 실제 홈페이지를 확인합니다.

<https://nssur-telemetry-dashboard-v2.vercel.app>

변경 내용이 바로 보이지 않으면 `Command + Shift + R`로 강력 새로고침합니다.

---

## 매번 기억할 순서

```text
1. Pull — GitHub에서 최신 코드 받기
2. Edit — 코드 수정하기
3. Go Live — 로컬에서 확인하기
4. Commit — 수정 내용을 기록하기
5. Sync Changes/Push — GitHub에 업로드하기
6. 실제 홈페이지 확인하기
```

## 주의사항

- 작업을 시작하기 전에 항상 Pull합니다.
- `main` 브랜치에 Push하면 실제 홈페이지에 자동 반영됩니다.
- 실제 주행 CSV, 개인정보, 비밀번호, API 키는 GitHub에 올리지 않습니다.
- 두 사람이 동시에 같은 파일을 수정하지 않도록 작업 내용을 미리 공유합니다.
- Push 오류가 나면 올바른 GitHub 계정으로 로그인했고 초대를 수락했는지 확인합니다.
- 충돌이나 오류가 발생하면 파일을 계속 수정하거나 삭제하기 전에 상황을 공유합니다.
