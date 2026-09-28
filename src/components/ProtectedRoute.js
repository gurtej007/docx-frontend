import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem('token'));

    useEffect(() => {
        const onStorage = (event) => {
            // to update tabs if token is changed in some other tab, due to relogin 
            if (event.key !== 'token' && event.key !== 'userEmail') return;

            const nextToken = localStorage.getItem('token');
            if (!nextToken) {
                setToken(null);
                return;
            }

            if (nextToken !== token) {
                window.location.reload();
            }
        };

        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [token]);

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
