export const demoGroup = {
  id: 'focus-club',
  name: '새벽 운동팟',
  tags: ['#운동', '#기상', '#스트레칭', '#무지출', '#아침루틴'],
  activityBadge: '새 인증 2',
  recentActivity: '3분 전 인증 업데이트',
  members: 4,
  threshold: '3/4명 인증',
} as const;

export const demoPersonalSpace = {
  name: '개인공간',
  recentActivity: '오늘 #운동 인증 완료',
  tags: ['#운동', '#공부', '#무지출', '#독서'],
} as const;

export const demoGroups = [
  demoGroup,
  {
    id: 'study-squad',
    name: '밤공부 스쿼드',
    tags: ['#공부', '#집중', '#노트정리', '#기록', '#루틴', '#독서'],
    activityBadge: '새 채팅 5',
    recentActivity: '12분 전 채팅 도착',
    members: 5,
    threshold: '4/5명 인증',
  },
] as const;

export const demoDate = '2026-04-15';
