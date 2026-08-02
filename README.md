# NS26F Telemetry Dashboard

NS26F 데이터로거의 CSV 로그를 브라우저에서 분석하는 독립형 정적 웹 프로젝트입니다.

## 로컬 실행

macOS에서는 `대시보드_실행.command`를 더블클릭하거나 아래 명령을 실행합니다.

```bash
python3 -m http.server 8081
```

그다음 <http://localhost:8081>을 엽니다.

## Vercel 배포

```bash
npx vercel --prod
```

CSV는 서버에 저장하지 않고 브라우저에서 직접 파싱합니다.

## 주요 파일

- `index.html`: 페이지 구조
- `style.css`: 화면 스타일
- `app.js`: CSV 파싱, EMU CAN 해석, 차트 및 GPS 기능
- `vercel.json`: Vercel 정적 배포 설정

