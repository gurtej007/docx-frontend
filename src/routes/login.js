import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getApiBase, consumeSessionExpiredMessage } from '../config';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [expiredNotice] = useState(() => consumeSessionExpiredMessage());

    async function handleSubmit(e) {
        e.preventDefault();
        const response = await fetch(`${getApiBase()}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (response.status === 200) {
            const data = await response.json();
            if (data.success) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('userEmail', data.user.email);
                navigate('/home');
            }
        } else {
            const data = await response.json();
            if (data.success === false) {
                alert(data.message || data.error);
            }
        }
    }

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>Welcome Back</h2>
                {expiredNotice && (
                    <p className="session-expired-notice">
                        Your session expired. Please log in again.
                    </p>
                )}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button type="submit" className="login-btn">
                        Login
                    </button>
                </form>
                <div className="switch-link">
                    Don't have an account? <a href="/register">Register here</a>
                </div>
            </div>
        </div>
    );
};

export default Login;
