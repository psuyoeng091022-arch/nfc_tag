import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Home,
  List,
  Smartphone,
  Volume2,
  Bell,
  BellOff,
  Clock,
  CheckCircle2,
  Radio,
  User,
  X,
  AlarmClock,
} from "lucide-react";

/* ---------------------------------------------------------
   디자인 토큰
   - 이 앱은 "환자"가 사용합니다. 약봉투에 붙은 NFC 태그를 스마트폰에
     대면, 이미 데이터베이스(약국/보호자가 등록)에 저장된 내 복약목록과
     알람 설정이 자동으로 표시됩니다. 환자가 직접 데이터를 입력하지 않습니다.
   - 태그 직후에는 "등록 완료" 정도만 짧게 확인하고, 실제 복약 시간이
     되었을 때 화면 팝업 + 음성으로 크게 안내하는 것이 핵심 시나리오입니다.
   - 고대비 + 큰 글씨로 시각장애인/고령자도 쉽게 쓰도록 설계
--------------------------------------------------------- */
const COLORS = {
  bg: "#F5F8FA",
  surface: "#FFFFFF",
  primary: "#123C5C",
  primaryDark: "#0B2740",
  accent: "#FF6B4A",
  accentSoft: "#FFE7E0",
  success: "#2E9E6D",
  successSoft: "#E4F5EC",
  text: "#14213D",
  textSoft: "#5B6B82",
  border: "#E3E8EF",
  navy10: "#EAF1F6",
};

const STORAGE_KEY = "myMedicationProfile";

// 경진대회 데모용 샘플 데이터. 실제 서비스에서는 약국/보호자가
// 데이터베이스에 미리 등록해 둔 값을 태그 인식 시 그대로 불러옵니다.
// timing: 식전 / 식후 / 취침전 등 짧은 복용 시점 표시용 (알람 문구에 사용)
const DEMO_PROFILE = {
  name: "홍길동",
  tagId: "tag8h3q9",
  meds: [
    {
      id: "m1",
      name: "타이레놀 500mg",
      times: ["08:00", "20:00"],
      timing: "식후",
      alarmOn: true,
    },
    {
      id: "m2",
      name: "혈압약 암로디핀",
      times: ["13:00"],
      timing: "식전",
      alarmOn: true,
    },
  ],
};

function speak(text) {
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.98;
    window.speechSynthesis.speak(u);
  } catch (e) {
    console.error("음성 재생 실패", e);
  }
}

function buildRegisterCompleteScript(profile) {
  const lines = profile.meds
    .map((m) => `${m.name}, ${m.times.join(", ")} ${m.timing} 복용`)
    .join(". ");
  return `${profile.name}님의 복약 알림 등록이 완료되었습니다. ${lines}.`;
}

function buildAlarmScript(profile, med) {
  return `${profile.name}님, ${med.name} ${med.timing} 복용 시간입니다.`;
}

/* ---------------------------------------------------------
   공용 UI 조각
--------------------------------------------------------- */
function Pill_({ children, tone = "navy" }) {
  const tones = {
    navy: { bg: COLORS.navy10, color: COLORS.primary },
    accent: { bg: COLORS.accentSoft, color: "#B94427" },
    success: { bg: COLORS.successSoft, color: COLORS.success },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        background: t.bg,
        color: t.color,
        fontSize: 13,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {children}
    </span>
  );
}

function TopBar({ title, subtitle }) {
  return (
    <div style={{ padding: "28px 20px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.textSoft, fontSize: 13, fontWeight: 600 }}>
        <Radio size={14} color={COLORS.accent} />
        NFC 태그를 이용한 약복용 도우미
      </div>
      <h1 style={{ margin: "6px 0 4px", fontSize: 26, fontWeight: 800, color: COLORS.text, letterSpacing: "-0.02em" }}>
        {title}
      </h1>
      {subtitle && <p style={{ margin: 0, fontSize: 14.5, color: COLORS.textSoft, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
  );
}

const secondaryFullBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: COLORS.navy10,
  color: COLORS.primary,
  border: "none",
  borderRadius: 14,
  padding: "14px 18px",
  fontSize: 14.5,
  fontWeight: 800,
  cursor: "pointer",
};

const primaryBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: COLORS.primary,
  color: "#fff",
  border: "none",
  borderRadius: 14,
  padding: "15px 18px",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
};

function pingStyle(delay) {
  return {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: COLORS.accent,
    opacity: 0.5,
    animation: `nfcPing 1.4s cubic-bezier(0,0,0.2,1) ${delay}s infinite`,
  };
}

/* ---------------------------------------------------------
   화면: 홈 = NFC 태그 스캔
   태그하면 "약 정보 상세"가 아니라 "등록 완료" 짧은 확인만 보여줌
--------------------------------------------------------- */
function TagHomeScreen({ profile, onGo }) {
  const [scanning, setScanning] = useState(false);
  const [showResult, setShowResult] = useState(false);

  const runScan = () => {
    setShowResult(false);
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setShowResult(true);
      speak(buildRegisterCompleteScript(profile));
    }, 1400);
  };

  return (
    <div>
      <TopBar title={`${profile.name}님, 안녕하세요`} subtitle="약봉투의 NFC 태그를 스마트폰에 대면 복약 알림이 등록돼요." />

      <div style={{ padding: "0 20px" }}>
        <div
          style={{
            background: COLORS.primaryDark,
            borderRadius: 20,
            padding: "36px 20px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <button onClick={runScan} disabled={scanning} style={{ background: "none", border: "none", cursor: scanning ? "default" : "pointer" }}>
            <div style={{ position: "relative", width: 104, height: 104, margin: "0 auto" }}>
              {scanning && (
                <>
                  <span style={pingStyle(0)} />
                  <span style={pingStyle(0.35)} />
                </>
              )}
              <div
                style={{
                  position: "relative",
                  width: 104,
                  height: 104,
                  borderRadius: "50%",
                  background: COLORS.accent,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Smartphone size={44} color="#fff" />
              </div>
            </div>
          </button>
          <div style={{ color: "#fff", fontWeight: 700, marginTop: 20, fontSize: 16 }}>
            {scanning ? "태그를 인식하는 중..." : "여기를 눌러 약봉투 태그하기"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12.5, marginTop: 4 }}>#{profile.tagId}</div>
        </div>

        {showResult && (
          <div
            style={{
              marginTop: 18,
              background: COLORS.surface,
              border: `1.5px solid ${COLORS.border}`,
              borderRadius: 18,
              padding: 22,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: COLORS.successSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto",
              }}
            >
              <CheckCircle2 size={26} color={COLORS.success} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 17, color: COLORS.text, marginTop: 12 }}>
              복약 알림 등록이 완료됐어요
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 14, textAlign: "left" }}>
              {profile.meds.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: COLORS.navy10,
                    borderRadius: 12,
                    padding: "10px 14px",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{m.name}</span>
                  <Pill_ tone="navy">
                    <Clock size={11} /> {m.times.join(", ")} · {m.timing}
                  </Pill_>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
              <button onClick={() => speak(buildRegisterCompleteScript(profile))} style={secondaryFullBtn}>
                <Volume2 size={17} /> 음성 다시 듣기
              </button>
              <button onClick={() => onGo("list")} style={primaryBtnStyle}>
                내 복약목록·알람 관리로 이동
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   화면: 내 복약목록 & 알람 설정
--------------------------------------------------------- */
function ListScreen({ profile, onToggleAlarm, onTestAlarm }) {
  return (
    <div>
      <TopBar title="내 복약목록" subtitle="이 화면을 열어두면 15초마다 시간을 확인해 알림을 울립니다." />

      <div style={{ padding: "0 20px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: COLORS.surface, border: `1.5px solid ${COLORS.border}`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: COLORS.navy10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={18} color={COLORS.primary} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, color: COLORS.text }}>{profile.name}님</div>
        </div>
      </div>

      <div style={{ padding: "0 20px", display: "grid", gap: 12 }}>
        {profile.meds.map((m) => (
          <div key={m.id} style={{ background: COLORS.surface, border: `1.5px solid ${COLORS.border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text }}>{m.name}</div>
              <Pill_ tone="accent">{m.timing}</Pill_>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {m.times.map((t) => (
                <Pill_ key={t} tone="navy">
                  <Clock size={11} /> {t}
                </Pill_>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                onClick={() => onToggleAlarm(m.id)}
                style={{
                  ...secondaryFullBtn,
                  flex: 1,
                  background: m.alarmOn ? COLORS.successSoft : COLORS.navy10,
                  color: m.alarmOn ? COLORS.success : COLORS.primary,
                  padding: "11px 12px",
                  fontSize: 13,
                }}
              >
                {m.alarmOn ? <Bell size={15} /> : <BellOff size={15} />}
                {m.alarmOn ? "알림 켬" : "알림 꺼짐"}
              </button>
              <button onClick={() => onTestAlarm(m)} style={{ ...secondaryFullBtn, flex: 1, padding: "11px 12px", fontSize: 13 }}>
                <AlarmClock size={15} /> 알람 미리보기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   복용 시간 알람 팝업 (화면 위에 크게 뜨는 배너)
--------------------------------------------------------- */
function AlarmBanner({ alarm, onClose }) {
  if (!alarm) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(11,39,64,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 24,
      }}
    >
      <div
        style={{
          background: COLORS.surface,
          borderRadius: 22,
          padding: "30px 24px",
          width: "100%",
          maxWidth: 320,
          textAlign: "center",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: COLORS.accentSoft,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
          }}
        >
          <AlarmClock size={28} color={COLORS.accent} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.accent, marginTop: 14 }}>복약 알림</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: COLORS.text, marginTop: 8, lineHeight: 1.5 }}>
          {alarm.profileName}님,<br />
          {alarm.medName} {alarm.timing} 복용 시간입니다
        </div>
        <button onClick={onClose} style={{ ...primaryBtnStyle, width: "100%", marginTop: 20 }}>
          <CheckCircle2 size={17} /> 확인했어요
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   알림 체크 (화면이 열려있는 동안 15초마다 현재 시각과 비교)
--------------------------------------------------------- */
function useAlarmClock(profile, onFire) {
  const firedRef = useRef(new Set());

  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const nowStr = `${hh}:${mm}`;

      profile.meds.forEach((m) => {
        if (!m.alarmOn) return;
        m.times.forEach((t) => {
          const timeOnly = t.match(/\d{2}:\d{2}/)?.[0];
          if (!timeOnly) return;
          const key = `${m.id}-${timeOnly}-${now.toDateString()}`;
          if (timeOnly === nowStr && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            onFire(m);
          }
        });
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [profile, onFire]);
}

/* ---------------------------------------------------------
   메인 앱
--------------------------------------------------------- */
export default function App() {
  const [view, setView] = useState("home");
  const [profile, setProfile] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [alarm, setAlarm] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        if (res?.value) {
          setProfile(JSON.parse(res.value));
        } else {
          // 데이터베이스에 이미 등록되어 있다고 가정한 데모용 초기 데이터
          setProfile(DEMO_PROFILE);
          await window.storage.set(STORAGE_KEY, JSON.stringify(DEMO_PROFILE), false);
        }
      } catch (e) {
        setProfile(DEMO_PROFILE);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setProfile(next);
    try {
      await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
    } catch (e) {
      console.error("저장 실패", e);
    }
  }, []);

  const triggerAlarm = useCallback(
    (med) => {
      if (!profile) return;
      setAlarm({ profileName: profile.name, medName: med.name, timing: med.timing });
      speak(buildAlarmScript(profile, med));
    },
    [profile]
  );

  useAlarmClock(profile, triggerAlarm);

  const handleToggleAlarm = (medId) => {
    if (!profile) return;
    persist({
      ...profile,
      meds: profile.meds.map((m) => (m.id === medId ? { ...m, alarmOn: !m.alarmOn } : m)),
    });
  };

  const nav = [
    { key: "home", label: "홈", icon: Home },
    { key: "list", label: "내목록", icon: List },
  ];

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "0 auto",
        minHeight: 640,
        background: COLORS.bg,
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif",
        display: "flex",
        flexDirection: "column",
        borderRadius: 24,
        overflow: "hidden",
        border: `1px solid ${COLORS.border}`,
        position: "relative",
      }}
    >
      <style>{`
        @keyframes nfcPing {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <AlarmBanner alarm={alarm} onClose={() => setAlarm(null)} />

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {!loaded || !profile ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textSoft }}>불러오는 중...</div>
        ) : view === "home" ? (
          <TagHomeScreen profile={profile} onGo={setView} />
        ) : (
          <ListScreen profile={profile} onToggleAlarm={handleToggleAlarm} onTestAlarm={triggerAlarm} />
        )}
      </div>

      <div style={{ display: "flex", borderTop: `1.5px solid ${COLORS.border}`, background: COLORS.surface, padding: "8px 6px" }}>
        {nav.map((n) => {
          const active = view === n.key;
          const Icon = n.icon;
          return (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "8px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: active ? COLORS.primary : COLORS.textSoft,
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.6 : 2} />
              <span style={{ fontSize: 11, fontWeight: active ? 800 : 600 }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
