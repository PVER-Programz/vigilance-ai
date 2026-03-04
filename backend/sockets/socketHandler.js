const students = {};
const calculateIntegrity = require('../utils/integrityEngine');

const socketHandler = (io) => {
    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);

        socket.on('student-join', (data) => {
            students[socket.id] = {
                id: socket.id,
                name: data.name,
                totalScore: 0,
                visionScore: 0,
                browserScore: 0,
                audioScore: 0,
                typingScore: 0,
                riskLevel: "Low",
                lastEventTime: Date.now(),
                eventHistory: [],
                // PART 2: INITIAL INTEGRITY STATE
                integrityScore: 100,
                durations: {
                    multiFace: 0,
                    faceAbsent: 0,
                    gazeDeviation: 0,
                    audioSpeech: 0,
                    browserSwitch: 0,
                    typingAnomaly: 0
                },
                examTerminated: false
            };
            io.emit('update-students', students);
            console.log(`Student joined: ${data.name}`);
        });

        socket.on('video-frame', (data) => {
            if (students[socket.id]) {
                students[socket.id].latestFrame = data.image;
                // Emit to all to update proctors
                io.emit('update-students', students);
            }
        });

        socket.on('update-suspicion', (data) => {
            const student = students[socket.id];
            if (student) {
                const { score, domain, reason } = data;
                const points = typeof score === 'number' ? score : 0;

                // Update domain scores
                if (domain === 'vision') student.visionScore += points;
                else if (domain === 'browser') student.browserScore += points;
                else if (domain === 'audio') student.audioScore += points;
                else if (domain === 'typing') student.typingScore += points;

                // Update total and timestamp
                student.totalScore += points;
                student.lastEventTime = Date.now();

                // Add to event history
                student.eventHistory.unshift({
                    timestamp: Date.now(),
                    domain: domain || 'general',
                    points: points,
                    reason: reason || 'Unknown anomaly'
                });

                // Limit history
                if (student.eventHistory.length > 50) {
                    student.eventHistory.pop();
                }

                // Update risk level
                // Update risk level (Scale 0-100)
                if (student.totalScore < 30) student.riskLevel = "Low";
                else if (student.totalScore < 70) student.riskLevel = "Medium";
                else student.riskLevel = "High";

                // AUTO TERMINATION LOGIC (Terminates when totalScore hits 100)
                if (student.totalScore >= 100 && !student.examTerminated) {
                    student.examTerminated = true;

                    io.to(socket.id).emit('exam-terminated', {
                        reason: 'Suspicion score reached maximum threshold (100)'
                    });

                    io.emit('student-terminated', {
                        studentId: socket.id,
                        name: student.name
                    });
                }

                io.emit('update-students', students);
            }
        });

        // PART 2 — BACKEND INTEGRITY PROCESSING
        socket.on('update-integrity', ({ durations }) => {
            const student = students[socket.id];
            if (!student || student.examTerminated) return;

            const integrityScore = calculateIntegrity(durations);

            student.integrityScore = integrityScore;
            student.durations = durations;

            io.emit('update-students', students);

            // AUTO TERMINATION LOGIC (Terminates when 100 points of penalty are reached)
            if (integrityScore <= 0) {
                student.examTerminated = true;

                io.to(socket.id).emit('exam-terminated', {
                    reason: 'Integrity score reached zero (Maximum violations reached)'
                });

                io.emit('student-terminated', {
                    studentId: socket.id,
                    name: student.name
                });

                console.log(`Exam Terminated for student: ${student.name} (Score: ${integrityScore})`);
            }
        });

        // --- WebRTC Signaling Relays ---
        socket.on('webrtc-offer', ({ offer, targetId }) => {
            io.to(targetId).emit('webrtc-offer', { offer, from: socket.id });
        });

        socket.on('webrtc-answer', ({ answer, targetId }) => {
            io.to(targetId).emit('webrtc-answer', { answer, from: socket.id });
        });

        socket.on('webrtc-ice-candidate', ({ candidate, targetId }) => {
            io.to(targetId).emit('webrtc-ice-candidate', { candidate, from: socket.id });
        });

        socket.on('request-stream', ({ targetId }) => {
            // Relay request to the specific student
            io.to(targetId).emit('request-stream', { from: socket.id });
        });

        socket.on('disconnect', () => {
            if (students[socket.id]) {
                console.log(`Student disconnected: ${students[socket.id].name}`);
                delete students[socket.id];
                io.emit('update-students', students);
            }
        });
    });

    // Time Decay Mechanism (Every 5 seconds)
    setInterval(() => {
        const now = Date.now();
        let changed = false;

        Object.values(students).forEach(student => {
            if (now - student.lastEventTime > 5000 && student.totalScore > 0) {
                student.totalScore = Math.max(0, student.totalScore - 1);

                // Decay domain scores proportionally
                if (student.visionScore > 0) student.visionScore = Math.max(0, student.visionScore - 0.25);
                if (student.browserScore > 0) student.browserScore = Math.max(0, student.browserScore - 0.25);
                if (student.audioScore > 0) student.audioScore = Math.max(0, student.audioScore - 0.25);
                if (student.typingScore > 0) student.typingScore = Math.max(0, student.typingScore - 0.25);

                // Re-classify risk (Scale 0-100)
                if (student.totalScore < 30) student.riskLevel = "Low";
                else if (student.totalScore < 70) student.riskLevel = "Medium";
                else student.riskLevel = "High";

                changed = true;
            }
        });

        if (changed) {
            io.emit('update-students', students);
        }
    }, 5000);
};

module.exports = socketHandler;
