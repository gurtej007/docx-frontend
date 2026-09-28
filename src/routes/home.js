import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getApiBase, authHeaders, clearSession, markSessionExpired } from '../config';

const Home = () => {
    const navigate = useNavigate();
    const [docs, setDocs] = useState([]);
    const [userEmail, setUserEmail] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const docsPerPage = 8;

    const goToLogin = () => {
        clearSession();
        markSessionExpired();
        navigate('/login', { replace: true });
    };

    useEffect(() => {
        // Get user email from localStorage or session
        const email = localStorage.getItem('userEmail');
        setUserEmail(email);
        
        async function getDocs() {
            const response = await fetch(`${getApiBase()}/docx/`, {
                method: 'GET',
                headers: authHeaders(),
            });
            if (response.status === 401) {
                goToLogin();
                return;
            }
            const data = await response.json();
            if(data.success){
                setDocs(data.docs);
            }
        }
        getDocs();
    }, [navigate]);  // Empty dependency array - runs once when component mounts

    const createNewDoc = async () => {
        const response = await fetch(`${getApiBase()}/docx/create`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                title: 'Untitled Document',
                content: '',
            }),
        });

        if (response.status === 401) {
            goToLogin();
            return;
        }

        const data = await response.json();
        if (data.success) {
            navigate(`/doc/${data.doc.id}`);
        } else {
            alert(data.error || 'Failed to create document');
        }
    };

    const handleDelete = async (docId) => {
        const response = await fetch(`${getApiBase()}/docx/delete/${docId}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });

        if (response.status === 401) {
            goToLogin();
            return;
        }

        const data = await response.json();
        if (data.success) {
            // Refresh the document list
            setDocs(docs.filter(doc => doc.id !== docId));
        } else {
            alert(data.message || 'Failed to delete document');
        }
    };

    // Pagination logic
    const totalPages = Math.ceil(docs.length / docsPerPage);
    const indexOfLastDoc = currentPage * docsPerPage;
    const indexOfFirstDoc = indexOfLastDoc - docsPerPage;
    const currentDocs = docs.slice(indexOfFirstDoc, indexOfLastDoc);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);
    const nextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };
    const prevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    return (
        <div className='home'>
            <div className="home-header">
                <h1>My Documents</h1>
                <button onClick={createNewDoc} className="create-doc-btn">
                    + New Document
                </button>
            </div>
            
            <div className="doc-list">
                {docs.length === 0 ? (
                    <div className="empty-state">
                        <p>No documents yet. Create your first document!</p>
                    </div>
                ) : (
                    <>
                        <div className="doc-items-container">
                            {currentDocs.map((doc) => (
                                <div 
                                    key={doc.id} 
                                    className="doc-item"
                                    onClick={() => navigate(`/doc/${doc.id}`)}
                                >
                                    <div>
                                        <h3>{doc.title}</h3>
                                        <p>Role: {doc.role}</p>
                                    </div>
                                    <div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (doc.role !== 'OWNER') {
                                                    alert('You are not allowed to delete this document');
                                                    return;
                                                }
                                                handleDelete(doc.id);
                                            }}
                                            className="delete-btn"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {totalPages > 1 && (
                            <div className="pagination">
                                <button 
                                    onClick={prevPage} 
                                    disabled={currentPage === 1}
                                    className="pagination-btn"
                                >
                                    Previous
                                </button>
                                
                                <div className="page-numbers">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                                        <button
                                            key={number}
                                            onClick={() => paginate(number)}
                                            className={`page-number ${currentPage === number ? 'active' : ''}`}
                                        >
                                            {number}
                                        </button>
                                    ))}
                                </div>
                                
                                <button 
                                    onClick={nextPage} 
                                    disabled={currentPage === totalPages}
                                    className="pagination-btn"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Home;
