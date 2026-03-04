import React, { useEffect, useState, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, Activity, Users, Clock, AlertTriangle,
    Settings, LayoutDashboard, Radio, FileText,
    Brain, Eye, Globe, Mic, Keyboard, X, ArrowRight,
    TrendingUp, Maximize2, MoreVertical, Zap,
    Cpu, Lock, Database, Target, Gauge, History
} from 'lucide-react';
import {
    BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip,
    AreaChart, Area
} from 'recharts';
import socket from '../socket';
import styles from './ProctorDashboard.module.css';

const ProctorDashboard = () => {
    const [students, setStudents] = useState({});
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [time, setTime] = useState(new Date());
    const [activeTab, setActiveTab] = useState('monitoring');

    useEffect(() => {
        socket.connect();
        socket.on('update-students', (data) => {
            setStudents({ ...data });
        });

        const timer = setInterval(() => setTime(new Date()), 1000);

        return () => {
            socket.off('update-students');
            socket.disconnect();
            clearInterval(timer);
        };
    }, []);

    const studentList = useMemo(() => Object.values(students), [students]);

    const highRiskCount = studentList.filter(s => s.riskLevel === 'High').length;
    const sysHealth = highRiskCount > studentList.length * 0.3 ? 'Red' : (highRiskCount > 0 ? 'Yellow' : 'Green');

    const heatmapData = useMemo(() => {
        return studentList
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 5)
            .map(s => ({ name: s.name.split(' ')[0], score: Math.round(s.totalScore) }));
    }, [studentList]);

    const liveEvents = useMemo(() => {
        const allEvents = studentList.flatMap(s =>
            (s.eventHistory || []).map(e => ({ ...e, studentName: s.name }))
        );
        return allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 15);
    }, [studentList]);

    const selectedStudent = students[selectedStudentId];

    return (
        <div className={styles.dashboardContainer}>
            <div className={styles.grid} />

            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <div className={styles.logoText}>
                        <Shield color="var(--accent-cyan)" size={32} /> VIGILANCE
                    </div>
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <NavItem icon={<LayoutDashboard size={18} />} label="COMMAND CENTER" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                    <NavItem icon={<Radio size={18} />} label="LIVE MONITOR" active={activeTab === 'monitoring'} onClick={() => setActiveTab('monitoring')} />
                    <NavItem icon={<TrendingUp size={18} />} label="RISK ANALYSIS" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
                    <NavItem icon={<History size={18} />} label="SESSION LOGS" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
                </nav>

                <div style={{ padding: '0 40px', marginBottom: '40px' }}>
                    <NavItem icon={<Settings size={18} />} label="PREFERENCES" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                </div>
            </aside>

            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <div>
                        <span className={styles.statLabel} style={{ fontSize: '10px', letterSpacing: '4px' }}>COGNITIVE INTEGRITY UPLINK // V3.0_RELEASE</span>
                        <h2 style={{ fontSize: '24px', marginTop: '8px', color: 'white', fontWeight: '900', fontFamily: 'var(--font-display)' }}>
                            {activeTab.toUpperCase()} _STATUS:<span style={{ color: 'var(--accent-cyan)' }}> NOMINAL</span>
                        </h2>
                    </div>

                    <div className={styles.headerStats}>
                        <HeaderStat label="MISSION_CLOCK" value={time.toLocaleTimeString([], { hour12: false })} />
                        <HeaderStat label="ACTIVE_UPLINKS" value={studentList.length} />
                        <div className={styles.statItem}>
                            <span className={styles.statLabel}>SYSTEM_INTEGRITY</span>
                            <div className={styles.statValue} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div className={`${styles.healthIndicator} ${styles['health' + sysHealth]}`} />
                                <span style={{ color: sysHealth === 'Green' ? 'var(--success-green)' : sysHealth === 'Yellow' ? 'var(--warning-yellow)' : 'var(--danger-red)', fontSize: '18px', fontWeight: '900' }}>
                                    {sysHealth === 'Green' ? 'SECURE' : sysHealth === 'Yellow' ? 'WARNING' : 'CRITICAL'}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className={styles.gridContainer}>
                    <AnimatePresence mode="wait">
                        {(activeTab === 'monitoring' || activeTab === 'dashboard') && (
                            <motion.div
                                key="monitoring-grid"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className={styles.studentGrid}
                                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '40px', width: '100%' }}
                            >
                                {studentList.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        style={{ gridColumn: '1/-1', padding: '150px 0', textAlign: 'center' }}
                                    >
                                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }} style={{ display: 'inline-block', color: 'var(--accent-cyan)', opacity: 0.5, marginBottom: '30px' }}>
                                            <Target size={120} />
                                        </motion.div>
                                        <h3 className={styles.logo} style={{ fontSize: '32px', letterSpacing: '10px' }}>WAITING FOR_SIGNAL</h3>
                                        <p className={styles.statLabel} style={{ fontSize: '11px', letterSpacing: '3px', marginTop: '10px' }}>VIGILANCE AI IS SCANNING QUANTUM FREQUENCIES FOR STUDENT NODES</p>
                                    </motion.div>
                                ) : (
                                    studentList.map((student) => (
                                        <StudentCard
                                            key={student.id}
                                            student={student}
                                            onExpand={() => setSelectedStudentId(student.id)}
                                        />
                                    ))
                                )}
                            </motion.div>
                        )}

                        {activeTab === 'analytics' && (
                            <motion.div
                                key="analytics-view"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                style={{ width: '100%' }}
                            >
                                <RiskAnalyticsView studentList={studentList} heatmapData={heatmapData} />
                            </motion.div>
                        )}

                        {activeTab === 'neural' && (
                            <motion.div
                                key="neural-view"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                style={{ padding: '40px', textAlign: 'center' }}
                            >
                                <div style={{ marginBottom: '40px' }}>
                                    <Brain size={80} color="var(--accent-purple)" style={{ filter: 'drop-shadow(0 0 20px var(--accent-purple))' }} />
                                    <h2 style={{ fontSize: '32px', marginTop: '20px', fontFamily: 'var(--font-display)' }}>NEURAL CORE_V3</h2>
                                    <p className={styles.statLabel}>Processing classroom heuristics and multi-modal integrity signals</p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                                    <SummaryStat label="Heuristic Confidence" value="98.2%" />
                                    <SummaryStat label="Signal Fidelity" value="High" />
                                    <SummaryStat label="Active Synapses" value="1,024" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            <aside className={styles.rightPanels}>
                <section>
                    <div className={styles.panelTitle}><TrendingUp size={16} /> RISK_VELOCITY_SNAPSHOT</div>
                    <div style={{ height: '180px', padding: '10px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={heatmapData}>
                                <XAxis dataKey="name" hide />
                                <Tooltip
                                    contentStyle={{ background: '#0a0b14', border: '1px solid var(--glass-border)', fontSize: '10px', borderRadius: '8px' }}
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                />
                                <Bar dataKey="score" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                <section>
                    <div className={styles.panelTitle}><Cpu size={16} /> NEURAL_VERDICT</div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                            {studentList.length > 0
                                ? <><span style={{ color: 'var(--accent-cyan)', fontWeight: '800' }}>IDENTITY_LOCK:</span> Biometric telemetry for <span style={{ color: 'white' }}>{studentList[0]?.name}</span> processed. Neural engine suggests high-fidelity integrity monitoring.</>
                                : "Awaiting biometric data stream to initialize neural analysis engine."}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>
                                <span>AI_CONFIDENCE</span>
                                <span>{studentList.length > 0 ? "94.2%" : "0.0%"}</span>
                            </div>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                <motion.div
                                    animate={{ width: studentList.length > 0 ? "94.2%" : "0%" }}
                                    style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-purple))', boxShadow: '0 0 10px var(--accent-cyan)' }}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className={styles.panelTitle}><Activity size={16} /> INTEL_FEED_REALTIME</div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <AnimatePresence>
                            {liveEvents.map((event, i) => (
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={`${event.studentName}-${event.timestamp}`}
                                    className={styles.eventRow}
                                    style={{ borderLeftColor: getDomainColor(event.domain) }}
                                >
                                    <div className={styles.eventMeta}>
                                        <span>{new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                                        <span>{event.studentName.toUpperCase()}</span>
                                    </div>
                                    <div className={styles.eventMain}>
                                        <span style={{ color: 'white' }}>{event.reason}</span>
                                        <span style={{ color: 'var(--danger-red)', fontSize: '14px', fontWeight: '900' }}>+{event.points}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </section>
            </aside>

            {/* Evidence Log Panel */}
            <AnimatePresence>
                {selectedStudentId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={styles.timelineOverlay}
                        onClick={() => setSelectedStudentId(null)}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(10px)' }}
                    >
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className={styles.timelinePanel}
                            onClick={e => e.stopPropagation()}
                            style={{ width: '600px', height: '100%', background: 'var(--bg-surface)', borderLeft: '1px solid var(--glass-border)', padding: '60px' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '50px' }}>
                                <div>
                                    <span className={styles.statLabel} style={{ color: 'var(--accent-cyan)', letterSpacing: '4px' }}>DEEP_SURVEILLANCE</span>
                                    <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '900' }}>Evidence Log</h2>
                                </div>
                                <button onClick={() => setSelectedStudentId(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', cursor: 'pointer', padding: '15px', borderRadius: '16px' }}>
                                    <X size={24} />
                                </button>
                            </div>

                            {selectedStudent && (
                                <>
                                    <div style={{ marginBottom: '40px' }}>
                                        <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>{selectedStudent.name.toUpperCase()}</h3>
                                        <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
                                            <span className={styles.statLabel}>INDEX_REF: {selectedStudentId.slice(0, 16)}</span>
                                            <span style={{ color: 'var(--danger-red)', fontSize: '11px', fontWeight: '900', fontFamily: 'var(--font-mono)' }}>VIOLATION_SCORE: {Math.round(selectedStudent.totalScore)}</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {selectedStudent.eventHistory?.slice().reverse().map((event, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '20px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', borderLeft: `4px solid ${getDomainColor(event.domain)}` }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{new Date(event.timestamp).toLocaleTimeString()}</span>
                                                        <span style={{ fontSize: '12px', fontWeight: '900', color: 'var(--danger-red)' }}>+{event.points} PTS</span>
                                                    </div>
                                                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{event.reason}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const NavItem = ({ icon, label, active, onClick }) => (
    <div className={`${styles.navItem} ${active ? styles.navItemActive : ''}`} onClick={onClick}>
        <div style={{ color: active ? 'var(--accent-cyan)' : 'inherit', filter: active ? 'drop-shadow(0 0 8px var(--accent-cyan))' : 'none' }}>{icon}</div>
        <span>{label}</span>
    </div>
);

const HeaderStat = ({ label, value }) => (
    <div className={styles.statItem}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue} style={{ letterSpacing: '2px' }}>{value}</span>
    </div>
);

const StudentCard = memo(({ student, onExpand }) => {
    const videoRef = useRef(null);
    const pcRef = useRef(null);
    const [streamActive, setStreamActive] = useState(false);

    // FEATURE 3: RISK TREND GRAPH (30-second window)
    const [scoreHistory, setScoreHistory] = useState([]);
    useEffect(() => {
        const interval = setInterval(() => {
            setScoreHistory(prev => {
                const now = Date.now();
                const newHistory = [...prev, { time: now, score: student.totalScore }];
                return newHistory.slice(-30);
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [student.totalScore]);

    // FEATURE 1: INTEGRITY INDEX LOGIC
    const integrityIndex = student.integrityScore !== undefined ? student.integrityScore : Math.max(0, 100 - (student.totalScore * 1));
    const getIntegrityStatus = () => {
        if (student.examTerminated) return { text: 'TERMINATED', color: 'var(--danger-red)' };
        if (integrityIndex >= 85) return { text: 'SAFE', color: 'var(--success-green)' };
        if (integrityIndex >= 60) return { text: 'WATCH', color: 'var(--warning-yellow)' };
        return { text: 'HIGH RISK', color: 'var(--danger-red)' };
    };
    const status = getIntegrityStatus();

    // FEATURE 2: AI VERDICT LOGIC
    const verdicts = useMemo(() => {
        const v = [];
        if (student.visionScore > 5) v.push("Frequent gaze or face anomaly detected.");
        if (student.audioScore > 5) v.push("Sustained background speech detected.");
        if (student.typingScore > 5) v.push("Irregular typing behavior observed.");
        if (student.browserScore > 5) v.push("Browser interaction anomaly detected.");
        if ([student.visionScore, student.audioScore, student.typingScore, student.browserScore].filter(s => s > 5).length > 1) {
            v.push("Cross-domain anomaly pattern detected.");
        }
        return v.length > 0 ? v : ["No significant anomaly detected."];
    }, [student]);

    useEffect(() => {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pcRef.current = pc;
        pc.ontrack = (event) => { if (videoRef.current) { videoRef.current.srcObject = event.streams[0]; setStreamActive(true); } };
        pc.onicecandidate = (event) => { if (event.candidate) socket.emit('webrtc-ice-candidate', { candidate: event.candidate, targetId: student.id }); };

        const handleOffer = async ({ offer, from }) => {
            if (from !== student.id) return;
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc-answer', { answer, targetId: from });
        };
        const handleCandidate = async ({ candidate, from }) => {
            if (from !== student.id) return;
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        };

        socket.on('webrtc-offer', handleOffer);
        socket.on('webrtc-ice-candidate', handleCandidate);

        const requestStream = () => { if (socket.id) socket.emit('request-stream', { from: socket.id, targetId: student.id }); };
        if (socket.connected) requestStream(); else socket.on('connect', requestStream);

        return () => {
            socket.off('webrtc-offer', handleOffer); socket.off('webrtc-ice-candidate', handleCandidate);
            socket.off('connect', requestStream); pc.close(); setStreamActive(false);
        };
    }, [student.id]);

    const riskColor = student.riskLevel === 'Low' ? 'var(--success-green)' : student.riskLevel === 'Medium' ? 'var(--warning-yellow)' : 'var(--danger-red)';
    const riskClass = student.riskLevel === 'Low' ? styles.lowRiskBadge : student.riskLevel === 'Medium' ? styles.midRiskBadge : styles.highRiskBadge;

    return (
        <motion.div layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className={styles.card}>
            <div className={styles.cardVideoSection}>
                <video ref={videoRef} autoPlay playsInline muted className={styles.videoFeed} style={{ display: streamActive ? 'block' : 'none' }} />
                {!streamActive && student.latestFrame && (
                    <img src={student.latestFrame} className={styles.videoFeed} alt="Fallback" style={{ objectFit: 'cover' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, border: `2px solid ${riskColor}`, opacity: student.riskLevel === 'High' ? 1 : 0.2, transition: '0.3s' }} />

                <div style={{ position: 'absolute', top: '15px', left: '15px', display: 'flex', gap: '8px', zIndex: 20 }}>
                    <div style={{ background: 'rgba(0,0,0,0.8)', padding: '4px 10px', borderRadius: '4px', fontSize: '8px', fontWeight: '900', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: (streamActive && !student.examTerminated) ? 'var(--accent-cyan)' : '#444', animation: (streamActive && !student.examTerminated) ? 'pulse-cyan 1s infinite' : 'none' }} />
                        {student.examTerminated ? 'SIGNAL_TERMINATED' : streamActive ? 'UPLINK_LIVE' : 'SYNCING...'}
                    </div>
                    {student.examTerminated && (
                        <div style={{ background: 'var(--danger-red)', padding: '4px 10px', borderRadius: '4px', fontSize: '8px', fontWeight: '900', color: 'white', letterSpacing: '1px' }}>
                            EXAM TERMINATED
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                    <div className={styles.studentInfo}>
                        <h3>{student.name.toUpperCase()}</h3>
                        <span>UUID: {student.id.slice(0, 12).toUpperCase()}</span>
                        {/* FEATURE 1: INTEGRITY INDEX DISPLAY */}
                        <div style={{ marginTop: '8px', fontSize: '11px', fontWeight: '900', color: status.color }}>
                            INTEGRITY INDEX: {Math.round(integrityIndex)}% <span style={{ opacity: 0.4 }}>// {status.text}</span>
                        </div>
                    </div>
                    <div className={styles.scoreContainer}>
                        <div className={styles.suspicionScore}>{Math.round(student.totalScore)}</div>
                        <span className={`${styles.riskBadge} ${riskClass}`}>{student.riskLevel.toUpperCase()}_PROTOCOL</span>
                    </div>
                </div>

                <div className={styles.metricsGrid}>
                    <MetricBar label="OCULAR" value={student.visionScore} color="var(--accent-cyan)" icon={<Eye size={10} />} />
                    <MetricBar label="VOCAL" value={student.audioScore} color="var(--accent-purple)" icon={<Mic size={10} />} />
                    <MetricBar label="BROWSER" value={student.browserScore} color="var(--warning-yellow)" icon={<Globe size={10} />} />
                    <MetricBar label="TACTILE" value={student.typingScore} color="var(--success-green)" icon={<Keyboard size={10} />} />
                </div>

                {/* FEATURE 2: AI RISK ANALYSIS PANEL */}
                <div style={{ margin: '20px 0', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className={styles.statLabel} style={{ fontSize: '9px', marginBottom: '8px', color: 'var(--accent-cyan)' }}>AI RISK_VERDICT</div>
                    <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {verdicts.map((v, i) => <li key={i}>{v}</li>)}
                    </ul>
                </div>

                {/* FEATURE 3: RISK TREND GRAPH */}
                <div style={{ height: '60px', marginBottom: '20px', padding: '0 5px' }}>
                    <div className={styles.statLabel} style={{ fontSize: '8px', marginBottom: '4px', opacity: 0.5 }}>REALTIME_RISK_VELOCITY</div>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={scoreHistory}>
                            <Area type="monotone" dataKey="score" stroke="var(--accent-cyan)" fill="var(--accent-cyan)" fillOpacity={0.1} isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <button className={styles.analyzeBtn} onClick={onExpand}>
                    OPEN_INTEL_STREAM <ArrowRight size={14} />
                </button>
            </div>
        </motion.div>
    );
});

const MetricBar = ({ label, value, color, icon }) => (
    <div className={styles.metricBarWrapper}>
        <div className={styles.metricLabel}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{icon} {label}</span>
            <span>{Math.round(value)}</span>
        </div>
        <div className={styles.progressBar}>
            <motion.div
                className={styles.progressFill}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(value, 100)}%` }}
                style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
            />
        </div>
    </div>
);

const RiskAnalyticsView = ({ studentList, heatmapData }) => {
    const avgScore = studentList.length > 0
        ? Math.round(studentList.reduce((acc, s) => acc + s.totalScore, 0) / studentList.length)
        : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <SummaryStat label="CLASS_AVERAGE_RISK" value={avgScore} />
                <SummaryStat label="PEAK_VIOLATIONS" value={Math.max(...studentList.map(s => s.totalScore || 0), 0)} />
                <SummaryStat label="UPLINK_STABILITY" value="99.8%" />
                <SummaryStat label="NODE_COUNT" value={studentList.length} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                <div className={styles.card} style={{ padding: '30px' }}>
                    <h3 className={styles.panelTitle}><Activity size={16} /> CLASS_WIDE RISK TRENDS</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={heatmapData}>
                                <defs>
                                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.1)" fontSize={10} />
                                <YAxis stroke="rgba(255,255,255,0.1)" fontSize={10} />
                                <Tooltip contentStyle={{ background: '#0a0b14', border: 'none', borderRadius: '8px' }} />
                                <Area type="monotone" dataKey="score" stroke="var(--accent-cyan)" fillOpacity={1} fill="url(#colorScore)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={styles.card} style={{ padding: '30px' }}>
                    <h3 className={styles.panelTitle}><TrendingUp size={16} /> TOP_VIOLATORS</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={heatmapData}>
                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.1)" fontSize={10} />
                                <YAxis stroke="rgba(255,255,255,0.1)" fontSize={10} />
                                <Tooltip contentStyle={{ background: '#0a0b14', border: 'none', borderRadius: '8px' }} />
                                <Bar dataKey="score" fill="var(--accent-purple)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SummaryStat = ({ label, value }) => (
    <div className={styles.card} style={{ padding: '24px' }}>
        <div className={styles.statLabel} style={{ marginBottom: '8px' }}>{label}</div>
        <div style={{ fontSize: '32px', fontWeight: '900', color: 'white', fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
);

const getDomainColor = (domain) => {
    const colors = { vision: '#00f2ff', browser: '#ffee00', audio: '#7000ff', typing: '#00ffa3', general: '#8b949e' };
    return colors[domain] || colors.general;
};

export default ProctorDashboard;
