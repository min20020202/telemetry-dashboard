# NS26F 텔레메트리 홈페이지 수정 안내

이 문서는 공동 작업자가 VS Code에서 홈페이지를 수정하고 실제 사이트에 반영하는 방법을 설명합니다.

- GitHub 저장소: <https://github.com/min20020202/telemetry-dashboard>
- 실제 홈페이지: <https://nssur-telemetry-dashboard-v2.vercel.app>

## 처음 한 번만 설정하기

### 1. GitHub 초대 수락

본인의 GitHub 계정으로 로그인한 뒤 전달받은 Collaborator 초대를 수락합니다. 저장소 소유자의 계정을 공유받을 필요는 없습니다.

### 2. VS Code 설치

<https://code.visualstudio.com>에서 macOS용 VS Code를 설치합니다.

### 3. Git 설치

Mac의 터미널에서 다음 명령을 실행합니다.

```bash
xcode-select --install
```

설치가 끝나면 다음 명령으로 확인합니다.

```bash
git --version
```

`git version ...`이 표시되면 정상입니다.

### 4. Live Server 설치

1. VS Code 왼쪽의 `Extensions`를 엽니다.
2. `Live Server`를 검색합니다.
3. 제작자가 `Ritwick Dey`인지 확인하고 설치합니다.

Live Server는 수정한 사이트를 실제 배포 전에 자기 컴퓨터에서 확인하는 도구입니다.

### 5. VS Code에서 GitHub 로그인

1. VS Code 왼쪽 아래 계정 아이콘을 클릭합니다.
2. `Sign in with GitHub`를 선택합니다.
3. 초대를 수락한 **본인의 GitHub 계정**으로 로그인합니다.
4. 브라우저에서 VS Code 접근 권한을 승인합니다.

### 6. 프로젝트 내려받기

1. VS Code에서 `Command + Shift + P`를 누릅니다.
2. `Git: Clone`을 선택합니다.
3. 아래 주소를 입력합니다.

```text
https://github.com/min20020202/telemetry-dashboard.git
```

4. 저장할 위치를 선택합니다.
5. 다운로드가 끝나면 `Open`을 누릅니다.
6. 신뢰 여부를 물으면 `Yes, I trust the authors`를 선택합니다.

## 홈페이지 수정하기

### 1. 작업 전에 최신 파일 받기

매번 작업을 시작하기 전에 VS Code 터미널에서 실행합니다.

```bash
git pull origin main
```

이 명령은 다른 사람이 GitHub에 올린 최신 변경 내용을 내 컴퓨터로 받아옵니다.

### 2. 사이트 미리보기

1. `index.html`을 엽니다.
2. 오른쪽 아래 `Go Live`를 누릅니다.

버튼이 보이지 않으면 `index.html`을 마우스 오른쪽 버튼으로 누르고 `Open with Live Server`를 선택합니다.

열리는 `http://127.0.0.1:5500` 주소는 자기 컴퓨터에서만 보이는 테스트 주소입니다.

### 3. 파일 수정

주요 파일의 역할은 다음과 같습니다.

| 파일 | 역할 |
| --- | --- |
| `index.html` | 화면 구성, 버튼, 문구 |
| `style.css` | 색상, 크기, 위치 등 디자인 |
| `app.js` | CSV 분석, 차트, GPS 등 기능 |
| `team_logo.png` | 팀 로고 |
| `vercel.json` | 배포 설정 — 특별한 이유가 없으면 수정하지 않기 |

수정한 뒤 `Command + S`로 저장하고 Live Server 화면에서 결과를 확인합니다.

### 4. 실제 사이트에 반영

1. VS Code 왼쪽의 `Source Control`을 엽니다.
2. `Changes`에 표시된 파일을 확인합니다.
3. 메시지 입력란에 수정 내용을 간단히 작성합니다.
4. `Commit`을 누릅니다.
5. 확인창이 나오면 `Stage All Changes and Commit`을 선택합니다.
6. `Sync Changes` 또는 `Push`를 누릅니다.

Push가 완료되면 GitHub에 저장되고 Vercel이 실제 홈페이지를 자동으로 배포합니다. 별도로 Vercel에 로그인하거나 배포할 필요는 없습니다.

## 매번 기억할 작업 순서

```text
1. Pull로 최신 파일 받기
2. 파일 수정하기
3. Live Server로 확인하기
4. Commit하기
5. Sync Changes 또는 Push하기
6. 실제 홈페이지 확인하기
```

## 주의사항

- `main` 브랜치에 Push하면 실제 홈페이지에 바로 반영됩니다.
- 작업 시작 전에 항상 Pull합니다.
- 실제 주행 CSV, 개인정보, 비밀번호, API 키는 GitHub에 올리지 않습니다.
- 두 사람이 동시에 같은 파일을 수정하지 않도록 작업 내용을 미리 공유합니다.
- 오류가 발생하면 파일을 계속 수정하거나 삭제하기 전에 상황을 공유합니다.
- 저장소 소유자의 GitHub 계정이나 Vercel 계정을 공유받을 필요가 없습니다.

## 문제가 생겼을 때

- `Go Live`가 없으면 Live Server 확장 프로그램이 설치·활성화됐는지 확인합니다.
- `Push` 권한 오류가 나면 올바른 GitHub 계정으로 로그인했고 Collaborator 초대를 수락했는지 확인합니다.
- 다른 사람의 변경 내용이 보이지 않으면 `git pull origin main`을 실행합니다.
- 실제 사이트가 바로 바뀌지 않으면 잠시 기다린 뒤 `Command + Shift + R`로 강력 새로고침합니다.
