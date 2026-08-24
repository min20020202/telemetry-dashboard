# NS26F IMU Data Viewer

`실행.command`를 더블클릭한 뒤 브라우저에서 Telemetry CSV를 선택합니다.

## 제공 기능

- 원시값과 필터값 독립 표시
- 5Hz/10Hz Butterworth, Median, Moving Average 선택
- 가속도·자이로·합성 가속도 그래프
- 표시 시간 구간 지정
- 현재 구간의 98% 범위와 전체 극값 계산
- IMU 샘플 간격, 오류 카운터, 배터리 확인

필터는 50Hz IMU 데이터에 오프라인 zero-phase 방식으로 적용됩니다. CSV 원본은 수정하지 않으며 파일은 브라우저 밖으로 전송되지 않습니다.
