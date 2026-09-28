import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { getApiBase } from '../config';

const Register = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        const response = await fetch(`${getApiBase()}/auth/register`, {
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
        <div className="register-container">
            <div className="register-box">
                <h2>Create Account</h2>
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
                            required
                        />
                    </div>
                    <button type="submit" className="register-btn">
                        Register
                    </button>
                </form>
                <div className="switch-link">
                    Already have an account? <a href="/login">Login here</a>
                </div>
            </div>
        </div>
    );
};

export default Register;