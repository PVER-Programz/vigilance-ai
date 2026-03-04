import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Mail, ArrowRight, Zap, Target } from 'lucide-react';
import styles from './Login.module.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const API_URL = `http://${window.location.hostname}:5000`;
            const res = await axios.post(`${API_URL}/api/auth/login`, { email, password });
            localStorage.setItem('user', JSON.stringify(res.data));

            if (res.data.role === 'student') {
                navigate('/student');
            } else {
                navigate('/proctor');
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginPage}>
            <div className={styles.nebula1} />
            <div className={styles.nebula2} />
            <div className={styles.grid} />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className={styles.loginCard}
            >
                <div className={styles.logoArea}>
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.5, duration: 1 }}
                        className={styles.logoIcon}
                    >
                        <Shield size={56} />
                    </motion.div>
                    <h1 className={styles.logo}>VIGILANCE AI</h1>
                    <span className={styles.tagline}>Cognitive Integrity Uplink</span>
                </div>

                <form onSubmit={handleLogin} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Security Clearance (Email)</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type="email"
                                className={styles.input}
                                placeholder="name@vantage.sys"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                spellCheck="false"
                            />
                            <Mail size={18} className={styles.inputIcon} />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Access Key (Password)</label>
                        <div className={styles.inputWrapper}>
                            <input
                                type="password"
                                className={styles.input}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <Lock size={18} className={styles.inputIcon} />
                        </div>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className={styles.submitBtn}
                        disabled={loading}
                    >
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                >
                                    <Target size={18} />
                                </motion.div>
                                Authenticating...
                            </div>
                        ) : (
                            <>
                                Initialize Uplink <ArrowRight size={18} />
                            </>
                        )}
                    </motion.button>
                </form>

                <div className={styles.footer}>
                    <p>Authorization Required. All sessions are monitored by VIGILANCE AI.</p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
