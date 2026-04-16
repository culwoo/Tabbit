# Tabbit

React Native / Expo 워크스페이스입니다. 이 폴더는 앱 코드만 담당하고, 기획과 진행 상태 관리는 상위 `GodLife/` 루트 문서에서 합니다.

## 현재 상태

- `Tabbit/`는 `Expo Router + local Development Build + Android-first` 기준으로 정리된 앱 워크스페이스입니다.
- 현재 첫 진입은 `sign-in` placeholder 화면이고, 로그인 이후에는 `캘린더 / 홈 / 카메라` 3탭 셸로 이어집니다.
- 제품 방향과 Memory 문서는 상위 경로의 `현재상태.md`, `다음할일.md`, `plans/`에 있습니다.
- 구현은 계획 단위를 쪼개서 진행하며, 한 대화에서 하나의 큰 주제만 다루는 것을 기본 규칙으로 삼습니다.

## 폴더 원칙

- `app/`: Expo Router 라우트 파일만 둡니다.
- `src/features`: 화면/기능 단위 코드
- `src/components/ui`: 공용 UI 조립 블록
- `src/config`: 환경변수 접근 단일 진입점
- `src/lib`, `src/store`, `src/theme`, `src/providers`, `src/types`: 공용 레이어
- `android/`: 로컬 dev build용 네이티브 Android 프로젝트를 소스에 유지합니다.

## 먼저 읽을 문서

- `../현재상태.md`
- `../다음할일.md`
- `../plans/01-워크스페이스.md`

## 기본 개발 방향

- Expo + Development Build
- Expo Router
- Android 실기기 우선
- iOS는 보조 검증 대상

## 자주 쓰는 명령어

```bash
npm install
npm run start
npm run start:clear
npm run android
npm run android:device
npm run lint
npm run typecheck
npm run doctor
```

## Supabase 부트스트랩

- 환경변수 접근은 `src/config/env.ts` 한 곳으로만 모읍니다.
- `.env.example`를 복사해 `.env`를 만들고 아래 값을 채웁니다.

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

- 구형 키 체계를 쓰는 프로젝트라면 `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 대신 `EXPO_PUBLIC_SUPABASE_ANON_KEY`를 넣어도 됩니다.
- Google OAuth 리디렉트 URL은 Supabase Auth 설정에 `tabbit://**` 패턴을 포함해야 합니다.
- 로컬 백엔드 개발은 Docker 기반 `npx supabase` 흐름을 기본 전제로 둡니다.

## 메모

- `npm run start`는 `expo start --dev-client`로 실행됩니다.
- `app.json`과 `android/` 식별자는 `Tabbit` / `com.tabbit.app` 기준으로 맞춰져 있습니다.
- Expo 스타터 데모 화면, 데모 컴포넌트, 리셋 스크립트는 제거되었습니다.
- `GodLife/` 루트에는 앱 코드를 두지 않고, Memory 문서만 유지합니다.
