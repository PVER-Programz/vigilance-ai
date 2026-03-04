import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { FaceMesh } from '@mediapipe/face_mesh';
import { Camera } from '@mediapipe/camera_utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield, Users, Eye, Globe, Mic, Keyboard,
    AlertTriangle, CheckCircle, Activity, Box,
    Terminal, ShieldCheck, Zap, Radio, Target
} from 'lucide-react';
import socket from '../socket';
import styles from './StudentDashboard.module.css';

const FRAME_RATE = 15;
const EMIT_INTERVAL_MS = 1000;
const FACE_ABSENT_THRESHOLD_SEC = 3;
const YAW_THRESHOLD_DEG = 25;
const CONTINUOUS_SPEECH_THRESHOLD_SEC = 2;
const COOLDOWN_MS = 5000;
const MOUTH_OPEN_THRESHOLD = 0.01;

const StudentDashboard = () => {
    const videoRef = useRef(null);
    const cameraRef = useRef(null);
    const faceMeshRef = useRef(null);

    const frameDataRef = useRef({
        faceCount: 0, yawAngle: 0, faceAbsentSeconds: 0, multiFaceFlag: false,
        tabSwitches: 0, pastes: 0, copies: 0, devtoolsOpen: false,
        micActive: false, audioEnergy: 0, continuousSpeechSeconds: 0,
        baselineNoise: 0, isCalibrated: false, calibrationFrames: 0,
        calibrationSum: 0, lastIncreaseTime: 0, mode: 'quiz',
        mouthMoving: false, lastMouthDist: 0, audioFlagged: false,
        keystrokeTimes: [], typingSpeed: 0, burstFlag: false,
        typingAnomaly: false, visionStates: { multiFace: false, absent: false, yaw: false },
        // PART 1: TRACK DURATIONS
        violationDurations: {
            multiFace: 0,
            faceAbsent: 0,
            gazeDeviation: 0,
            audioSpeech: 0,
            browserSwitch: 0,
            typingAnomaly: 0
        }
    });

    const [displayData, setDisplayData] = useState({
        faceCount: 0, yawAngle: 0, faceAbsentSeconds: 0, suspicionScore: 0,
        tabSwitches: 0, pastes: 0, copies: 0, devtoolsOpen: false,
        micActive: false, audioEnergy: 0, isTalking: false, mode: 'quiz',
        isCalibrating: true, baselineNoise: 0, speechDuration: 0,
        audioFlagged: false, typingSpeed: 0, burstFlag: false, typingAnomaly: false,
        // PART 3: STUDENT FRONTEND TERMINATION UI
        examTerminated: false,
        integrityScore: 100
    });

    const [examTerminated, setExamTerminated] = useState(false);

    const user = useMemo(() => JSON.parse(localStorage.getItem('user')) || { name: 'OPERATOR' }, []);

    const calculateYaw = useCallback((landmarks) => {
        const noseTip = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const eyeCenterX = (leftEye.x + rightEye.x) / 2;
        const eyeWidth = Math.abs(rightEye.x - leftEye.x);
        if (eyeWidth === 0) return 0;
        const offset = noseTip.x - eyeCenterX;
        return (offset / eyeWidth) * 90;
    }, []);

    const onFaceMeshResults = useCallback((results) => {
        const faces = results.multiFaceLandmarks || [];
        const faceCount = faces.length;
        let yawAngle = 0;
        if (faceCount > 0) {
            yawAngle = calculateYaw(faces[0]);
            const upperLip = faces[0][13];
            const lowerLip = faces[0][14];
            const dist = Math.abs(upperLip.y - lowerLip.y);
            const diff = Math.abs(dist - frameDataRef.current.lastMouthDist);
            frameDataRef.current.mouthMoving = diff > 0.002 || dist > MOUTH_OPEN_THRESHOLD;
            frameDataRef.current.lastMouthDist = dist;
        } else {
            frameDataRef.current.mouthMoving = false;
        }
        frameDataRef.current.faceCount = faceCount;
        frameDataRef.current.yawAngle = parseFloat(Math.abs(yawAngle).toFixed(1));
        frameDataRef.current.multiFaceFlag = faceCount > 1;
    }, [calculateYaw]);

    useEffect(() => {
        socket.connect();
        socket.emit('student-join', { name: user.name });

        const faceMesh = new FaceMesh({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        faceMesh.setOptions({
            maxNumFaces: 4,
            refineLandmarks: true,
            minDetectionConfidence: 0.35,
            minTrackingConfidence: 0.35,
        });
        faceMesh.onResults(onFaceMeshResults);
        faceMeshRef.current = faceMesh;

        const pcs = {};
        let localStream = null;
        let mediaReady = null;

        const emitSuspicion = (points, domain, reason) => {
            // PART 3: STOP EMITS IF TERMINATED
            if (frameDataRef.current.examTerminated) return;

            const now = Date.now();
            if (now - frameDataRef.current.lastIncreaseTime < COOLDOWN_MS) return;
            socket.emit('update-suspicion', { score: points, domain, reason });
            frameDataRef.current.lastIncreaseTime = now;
            setDisplayData(prev => ({ ...prev, suspicionScore: prev.suspicionScore + points }));
        };

        const startMedia = async () => {
            try {
                localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                    .catch(() => navigator.mediaDevices.getUserMedia({ video: true })); // Failover to video-only

                if (videoRef.current) {
                    videoRef.current.srcObject = localStream;
                    videoRef.current.play().catch(e => console.warn("Auto-play blocked", e));
                }

                const camera = new Camera(videoRef.current, {
                    onFrame: async () => {
                        if (faceMeshRef.current && videoRef.current) await faceMeshRef.current.send({ image: videoRef.current });
                    },
                    width: 640, height: 480,
                });
                camera.start();
                cameraRef.current = camera;
                return localStream;
            } catch (err) { console.error("Media failed:", err); return null; }
        };
        mediaReady = startMedia();

        // FALLBACK: EMIT FRAME VIA SOCKET EVERY 2 SECONDS
        const fallbackFrameTimer = setInterval(() => {
            if (videoRef.current && !frameDataRef.current.examTerminated) {
                const canvas = document.createElement('canvas');
                canvas.width = 160; // Low res for bandwidth
                canvas.height = 120;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const imageData = canvas.toDataURL('image/jpeg', 0.5);
                socket.emit('video-frame', { image: imageData });
            }
        }, 2000);

        const handleVisibilityChange = () => {
            if (document.hidden) {
                emitSuspicion(3, 'browser', 'Tab switched');
                frameDataRef.current.tabSwitches += 1;
                // TRACK DURATION
                frameDataRef.current.violationDurations.browserSwitch += 1;
            }
        };
        const handleBlur = () => emitSuspicion(2, 'browser', 'Window blur');
        const handleCopy = () => { emitSuspicion(2, 'browser', 'Copy detected'); frameDataRef.current.copies += 1; };
        const handlePaste = () => { emitSuspicion(4, 'browser', 'Paste detected'); frameDataRef.current.pastes += 1; };
        const handleKeyDown = () => {
            frameDataRef.current.keystrokeTimes.push(Date.now());
            const now = Date.now();
            frameDataRef.current.keystrokeTimes = frameDataRef.current.keystrokeTimes.filter(t => now - t < 5000);
        };

        const devToolsTimer = setInterval(() => {
            if (window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160) {
                emitSuspicion(3, 'browser', 'DevTools open');
                frameDataRef.current.devtoolsOpen = true;
            } else { frameDataRef.current.devtoolsOpen = false; }
        }, 1000);

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("copy", handleCopy);
        document.addEventListener("paste", handlePaste);
        document.addEventListener("keydown", handleKeyDown);

        let audioContext = null, analyser = null, microphone = null, audioStream = null;
        const startAudio = async () => {
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                microphone = audioContext.createMediaStreamSource(audioStream);
                microphone.connect(analyser);
                analyser.fftSize = 256;
                frameDataRef.current.micActive = true;
            } catch (err) { frameDataRef.current.micActive = false; }
        };
        startAudio();

        const audioAnalysisTimer = setInterval(() => {
            if (analyser) {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 15; i < dataArray.length; i++) sum += dataArray[i];
                const currentAvg = sum / (dataArray.length - 15);
                if (!frameDataRef.current.isCalibrated) {
                    frameDataRef.current.calibrationSum += currentAvg;
                    frameDataRef.current.calibrationFrames += 1;
                    if (frameDataRef.current.calibrationFrames >= 30) {
                        frameDataRef.current.baselineNoise = frameDataRef.current.calibrationSum / 30;
                        frameDataRef.current.isCalibrated = true;
                        setDisplayData(prev => ({ ...prev, isCalibrating: false }));
                    }
                }
                frameDataRef.current.audioEnergy = Math.round(currentAvg);
            }
        }, 100);

        const monitorTimer = setInterval(() => {
            const { faceCount, audioEnergy, baselineNoise, isCalibrated, mode, mouthMoving } = frameDataRef.current;
            if (faceCount === 0) frameDataRef.current.faceAbsentSeconds += 1;
            else frameDataRef.current.faceAbsentSeconds = 0;

            const isNoisy = isCalibrated && audioEnergy > (baselineNoise + 8);
            let shouldFlag = false;
            if (frameDataRef.current.micActive && isNoisy) {
                frameDataRef.current.continuousSpeechSeconds += 1;
                if (mode === "quiz" && frameDataRef.current.continuousSpeechSeconds > CONTINUOUS_SPEECH_THRESHOLD_SEC) {
                    shouldFlag = true; emitSuspicion(3, 'audio', 'Continuous speech detected');
                } else if (mode === "viva" && frameDataRef.current.continuousSpeechSeconds > CONTINUOUS_SPEECH_THRESHOLD_SEC) {
                    if (!mouthMoving || audioEnergy > (baselineNoise * 5)) {
                        shouldFlag = true; emitSuspicion(3, 'audio', 'Suspicious background audio');
                    }
                }
            } else frameDataRef.current.continuousSpeechSeconds = 0;
            frameDataRef.current.audioFlagged = shouldFlag;

            // PART 1 - STEP 2: TRACK DURATIONS (1-second interval)
            if (frameDataRef.current.multiFaceFlag) {
                frameDataRef.current.violationDurations.multiFace += 1;
            }
            if (frameDataRef.current.faceAbsentSeconds >= FACE_ABSENT_THRESHOLD_SEC) {
                frameDataRef.current.violationDurations.faceAbsent += 1;
            }
            if (frameDataRef.current.yawAngle > YAW_THRESHOLD_DEG) {
                frameDataRef.current.violationDurations.gazeDeviation += 1;
            }
            if (frameDataRef.current.continuousSpeechSeconds > CONTINUOUS_SPEECH_THRESHOLD_SEC) {
                frameDataRef.current.violationDurations.audioSpeech += 1;
            }
            if (frameDataRef.current.typingAnomaly) {
                frameDataRef.current.violationDurations.typingAnomaly += 1;
            }

            const now = Date.now(), keys = frameDataRef.current.keystrokeTimes;
            const last1s = keys.filter(t => now - t < 1000).length;
            const last2s = keys.filter(t => now - t < 2000).length;
            frameDataRef.current.typingSpeed = last1s;
            if (mode === "quiz") {
                if (last1s > 8) { emitSuspicion(2, 'typing', 'High typing speed'); frameDataRef.current.typingAnomaly = true; }
                else if (last2s > 40) { emitSuspicion(3, 'typing', 'Burst typing detected'); frameDataRef.current.burstFlag = true; }
                else { frameDataRef.current.typingAnomaly = false; frameDataRef.current.burstFlag = false; }
            }
        }, 1000);

        const createPeerConnection = (proctorId) => {
            if (pcs[proctorId]) return pcs[proctorId];
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            mediaReady.then(stream => { if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream)); });
            pc.onicecandidate = (event) => { if (event.candidate) socket.emit('webrtc-ice-candidate', { candidate: event.candidate, targetId: proctorId }); };
            pcs[proctorId] = pc;
            return pc;
        };

        socket.on('request-stream', async ({ from }) => {
            await mediaReady;
            const pc = createPeerConnection(from);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc-offer', { offer, targetId: from });
        });

        socket.on('webrtc-answer', async ({ answer, from }) => {
            const pc = pcs[from];
            if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on('webrtc-ice-candidate', async ({ candidate, from }) => {
            const pc = pcs[from];
            if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        });

        // PART 3: EXAM TERMINATION LISTENER
        socket.on('exam-terminated', (data) => {
            setExamTerminated(true);
            frameDataRef.current.examTerminated = true;
            setDisplayData(prev => ({ ...prev, integrityScore: 0 })); // Force set to 0 for UI clarity
            // We keep the camera running so the proctor can still see the student after termination
            // if (cameraRef.current) cameraRef.current.stop();
            // if (faceMeshRef.current) faceMeshRef.current.close();
            // if (localStream) localStream.getTracks().forEach(track => track.stop());
            if (audioContext) audioContext.close();
        });

        // SYNC INTEGRITY SCORE FROM BACKEND
        socket.on('update-students', (students) => {
            const me = students[socket.id];
            if (me && me.integrityScore !== undefined) {
                setDisplayData(prev => ({ ...prev, integrityScore: me.integrityScore }));
            }
        });

        const emitTimer = setInterval(() => {
            const { faceCount, yawAngle, faceAbsentSeconds, multiFaceFlag, visionStates } = frameDataRef.current;
            if (multiFaceFlag && !visionStates.multiFace) {
                emitSuspicion(5, 'vision', 'Multiple faces detected');
                visionStates.multiFace = true;
            } else if (!multiFaceFlag) visionStates.multiFace = false;

            if (faceAbsentSeconds >= FACE_ABSENT_THRESHOLD_SEC && !visionStates.absent) {
                emitSuspicion(3, 'vision', 'Face absent for 3s');
                visionStates.absent = true;
            } else if (faceAbsentSeconds === 0) visionStates.absent = false;

            if (yawAngle > YAW_THRESHOLD_DEG && !visionStates.yaw) {
                emitSuspicion(2, 'vision', 'Looking away (high yaw)');
                visionStates.yaw = true;
            } else if (yawAngle <= YAW_THRESHOLD_DEG) visionStates.yaw = false;

            // PART 1 - STEP 3: SEND DURATIONS TO BACKEND
            if (!frameDataRef.current.examTerminated) {
                socket.emit('update-integrity', {
                    durations: frameDataRef.current.violationDurations
                });
            }

            setDisplayData(prev => ({
                ...prev, faceCount, yawAngle, faceAbsentSeconds,
                tabSwitches: frameDataRef.current.tabSwitches,
                pastes: frameDataRef.current.pastes,
                copies: frameDataRef.current.copies,
                devtoolsOpen: frameDataRef.current.devtoolsOpen,
                micActive: frameDataRef.current.micActive,
                audioEnergy: frameDataRef.current.audioEnergy,
                isTalking: frameDataRef.current.isCalibrated && frameDataRef.current.audioEnergy > (frameDataRef.current.baselineNoise + 8),
                mode: frameDataRef.current.mode,
                isCalibrating: !frameDataRef.current.isCalibrated,
                baselineNoise: Math.round(frameDataRef.current.baselineNoise),
                speechDuration: frameDataRef.current.continuousSpeechSeconds,
                audioFlagged: frameDataRef.current.audioFlagged,
                typingSpeed: frameDataRef.current.typingSpeed,
                burstFlag: frameDataRef.current.burstFlag,
                typingAnomaly: frameDataRef.current.typingAnomaly,
            }));
        }, EMIT_INTERVAL_MS);

        return () => {
            clearInterval(monitorTimer); clearInterval(emitTimer); clearInterval(devToolsTimer); clearInterval(audioAnalysisTimer);
            clearInterval(fallbackFrameTimer);
            Object.values(pcs).forEach(pc => pc.close());
            if (audioContext) audioContext.close();
            if (audioStream) audioStream.getTracks().forEach(track => track.stop());
            if (localStream) localStream.getTracks().forEach(track => track.stop());
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("copy", handleCopy);
            document.removeEventListener("paste", handlePaste);
            document.removeEventListener("keydown", handleKeyDown);
            if (cameraRef.current) cameraRef.current.stop();
            if (faceMeshRef.current) faceMeshRef.current.close();
            socket.disconnect();
        };
    }, [onFaceMeshResults, user.name]);

    // PART 3: MAIN DASHBOARD RENDER MODIFICATION
    if (examTerminated) {
        return (
            <div className={styles.studentViewport} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#0a0b14' }}>
                <div className={styles.grid} />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ padding: '60px', background: 'rgba(255, 61, 113, 0.1)', border: '1px solid var(--danger-red)', borderRadius: '24px', backdropFilter: 'blur(20px)', zIndex: 100 }}
                >
                    <AlertTriangle size={80} color="var(--danger-red)" style={{ marginBottom: '24px' }} />
                    <h1 style={{ fontSize: '48px', color: 'white', marginBottom: '16px', fontWeight: '900' }}>🚫 Exam Terminated</h1>
                    <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                        Integrity score dropped below threshold.<br />
                        Please contact administrator.
                    </p>
                    <div className={styles.systemStatus} style={{ justifyContent: 'center' }}>
                        <Terminal size={16} color="var(--danger-red)" />
                        <span className={styles.monoLabel} style={{ color: 'var(--danger-red)' }}>PROTOCOL_TERMINATED_BY_VIGILANCE_AI</span>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className={styles.studentViewport}>
            <div className={styles.nebula1} />
            <div className={styles.nebula2} />
            <div className={styles.grid} />

            <header className={styles.header}>
                <div className={styles.systemStatus}>
                    <ShieldCheck size={32} color="var(--accent-cyan)" style={{ filter: 'drop-shadow(0 0 10px rgba(0,242,255,0.4))' }} />
                    <div className={styles.logoText}>VIGILANCE AI <span style={{ opacity: 0.3 }}>|</span> <span style={{ color: 'var(--accent-cyan)', fontSize: '12px' }}>V3.0_UPLINK</span></div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div className={styles.statusIndicator} />
                    <select
                        className={styles.modeSelect}
                        value={displayData.mode}
                        onChange={(e) => {
                            const newMode = e.target.value;
                            setDisplayData(prev => ({ ...prev, mode: newMode }));
                            frameDataRef.current.mode = newMode;
                        }}
                    >
                        <option value="quiz">PROTOCOL: STRICT_QUIZ</option>
                        <option value="viva">PROTOCOL: VIVA_INTEL</option>
                    </select>
                    <span className={styles.userName}>{user.name}</span>
                </div>
            </header>

            <main className={styles.mainLayout}>
                <section className={styles.videoSection}>
                    <div className={styles.cameraContainer}>
                        <video ref={videoRef} className={styles.cameraFeed} playsInline autoPlay muted />
                        <div className={styles.hudOverlay}>
                            <div className={styles.scanLine} />
                            <div className={styles.corners} />

                            {/* HUD HUD */}
                            <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', gap: '8px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-pink)', animation: 'pulse-cyan 1s infinite' }} />
                                <span className={styles.monoLabel} style={{ fontSize: '10px', color: 'white' }}>REC // LIVE_SIGNAL</span>
                            </div>

                            <div style={{ position: 'absolute', bottom: '30px', left: '30px', display: 'flex', gap: '16px' }}>
                                <Badge icon={<Radio size={12} />} label="STABLE_STREAM" color="var(--accent-cyan)" />
                                <Badge label={`FPS: 24.0`} />
                                <Badge label={`YAW: ${displayData.yawAngle}°`} color={displayData.yawAngle > 25 ? 'var(--danger-red)' : 'rgba(255,255,255,0.4)'} />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                        <SummaryStat icon={<Users size={20} />} label="Active Faces" value={displayData.faceCount} />
                        <SummaryStat icon={<Activity size={20} />} label="Vocal Peak" value={displayData.audioEnergy + 'dB'} />
                        <SummaryStat icon={<Terminal size={20} />} label="Data Mask" value={`${displayData.copies}/${displayData.pastes}`} />
                    </div>
                </section>

                <aside className={styles.metricsSidebar}>
                    <MetricCard
                        icon={<Shield size={24} />}
                        label="Integrity Index"
                        value={displayData.integrityScore + '%'}
                        className={styles.suspicionCard}
                        danger={displayData.integrityScore <= 30}
                        progress={displayData.integrityScore}
                    />

                    <MetricSection title="Biometric Telemetry">
                        <MetricRow label="Ocular Presence" value={displayData.faceCount > 0 ? "LOCK" : "LOST"} alert={displayData.faceCount === 0} />
                        <MetricRow label="Yaw Deviation" value={`${displayData.yawAngle}°`} alert={displayData.yawAngle > 25} />
                        <MetricRow label="Face Absent" value={`${displayData.faceAbsentSeconds}s`} alert={displayData.faceAbsentSeconds > 2} />
                    </MetricSection>

                    <MetricSection title="Vocal Frequency">
                        <MetricRow label="Energy Level" value={displayData.audioEnergy} />
                        <MetricRow label="Pattern Analysis" value={displayData.isTalking ? "SPEECH" : "SILENT"} alert={displayData.isTalking} />
                        <MetricRow label="Calibrated Baseline" value={displayData.isCalibrating ? "CALIBRATING..." : displayData.baselineNoise} />
                    </MetricSection>

                    <MetricSection title="Interaction Pattern">
                        <MetricRow label="Keystroke Vel" value={displayData.typingSpeed + ' cps'} />
                        <MetricRow label="System Hooks" value={displayData.devtoolsOpen ? "COMPROMISED" : "SECURE"} alert={displayData.devtoolsOpen} />
                        <MetricRow label="Tab Switches" value={displayData.tabSwitches} alert={displayData.tabSwitches > 0} />
                    </MetricSection>
                </aside>
            </main>
        </div>
    );
};

const Badge = ({ icon, label, color = 'rgba(255,255,255,0.4)' }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '8px', fontSize: '9px', fontWeight: '800', color: color, letterSpacing: '2px', fontFamily: 'var(--font-mono)'
    }}>
        {icon} {label}
    </div>
);

const SummaryStat = ({ icon, label, value }) => (
    <div className={styles.metricCard} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '24px' }}>
        <div style={{ color: 'var(--accent-cyan)', background: 'rgba(0,242,255,0.05)', padding: '12px', borderRadius: '12px' }}>{icon}</div>
        <div>
            <div className={styles.monoLabel} style={{ marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: 'white' }}>{value}</div>
        </div>
    </div>
);

const MetricSection = ({ title, children }) => (
    <div className={styles.metricCard}>
        <h4 className={styles.monoLabel} style={{ marginBottom: '24px', opacity: 0.6 }}>{title}</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {children}
        </div>
    </div>
);

const MetricRow = ({ label, value, alert }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</span>
        <span style={{
            fontSize: '14px', fontWeight: '800', fontFamily: 'var(--font-mono)',
            color: alert ? 'var(--accent-pink)' : 'white'
        }}>{value}</span>
    </div>
);

const MetricCard = ({ icon, label, value, danger, progress, className }) => (
    <div className={`${styles.metricCard} ${className} ${danger ? styles.suspicionHigh : ''}`}>
        <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>{icon} {label}</span>
            {danger && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}><Target size={18} color="var(--accent-pink)" /></motion.div>}
        </div>
        <div className={styles.metricValue} style={{ color: danger ? 'var(--accent-pink)' : 'white' }}>{value}</div>
        <div className={styles.indicatorBar}>
            <motion.div
                className={styles.indicatorFill}
                animate={{ width: `${progress !== undefined ? progress : 0}%` }}
                style={{ background: danger ? 'linear-gradient(90deg, var(--accent-pink), #ff5e00)' : 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))' }}
            />
        </div>
    </div>
);

export default StudentDashboard;
