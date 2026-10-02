import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiBase, getWsUrl, authHeaders, clearSession, isAuthError, isTokenExpired, markSessionExpired } from '../config';

const Doc = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const [content, setContent] = useState('');
  const versionRef = useRef(0);
  const [title, setTitle] = useState('Untitled Document');
  const [logs, setLogs] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showSave, setShowSave] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const editorRef = useRef(null);
  const lastContentRef = useRef('');
  const authRedirectStartedRef = useRef(false);
  const pendingCaretRef = useRef(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('VIEWER');
  const [shareLoading, setShareLoading] = useState(false);

  const goToLogin = () => {
    if (authRedirectStartedRef.current) return;
    authRedirectStartedRef.current = true;
    clearSession();
    markSessionExpired();
    navigate('/login', { replace: true });
  };

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const token = localStorage.getItem('token');
  // Connect to WebSocket when component mounts
  useEffect(() => {
    if (!docId) return;
    
    addLog('🔌 Connecting to WebSocket...');
    const socket = new WebSocket(getWsUrl());

    socket.onopen = () => {
      addLog('✅ WebSocket connected');
      setConnected(true);
      
      addLog(`📨 Joining document: ${docId}`);
      socket.send(JSON.stringify({
        type: 'join',
        payload: { docId, userEmail: localStorage.getItem('userEmail'), token: token },
      }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    };

    socket.onerror = (error) => {
      addLog('❌ WebSocket error');
      console.error(error);
    };

    socket.onclose = () => {
      addLog('🔌 WebSocket disconnected');
      setConnected(false);
      if (isTokenExpired(localStorage.getItem('token'))) {
        goToLogin();
      }
    };

    setWs(socket);

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [docId]);
  const handleMessage = (msg) => {
    addLog(`📩 Received: ${msg.type}`);

    switch (msg.type) {
      case 'join':
        if (msg.success) {
          addLog('✅ Successfully joined document');
        }
        setOnlineUsers(msg.payload.useronline);
        break;
      case 'leave':
        if (msg.success) {
          addLog('✅ Successfully left document');
        }
        setOnlineUsers(msg.payload.useronline);
        break;

      case 'init':
        addLog(`📄 Loaded document (version ${msg.version})`);
        const initialContent = msg.content || '';
        setContent(initialContent);
        lastContentRef.current = initialContent;
        versionRef.current = msg.version || 0;  // Use ref
        if (msg.title) {
          setTitle(msg.title);
        }
        if (msg.onlineUsers) {
          setOnlineUsers(msg.onlineUsers);
        }
        setUserRole(msg.role);
        break;

      case 'insert':
        addLog(`📝 Insert at pos ${msg.payload.pos}: "${msg.payload.text}"`);
        applyInsert(msg.payload.pos, msg.payload.text);
        versionRef.current = msg.payload.version;  // Use ref
        break;

      case 'delete':
        addLog(`🗑️ Delete at pos ${msg.payload.pos}, len ${msg.payload.len}`);
        applyDelete(msg.payload.pos, msg.payload.len);
        versionRef.current = msg.payload.version;  // Use ref
        break;

      case 'titleUpdate':
        addLog(`📝 Title updated: ${msg.title}`);
        setTitle(msg.title);
        setShowSave(false);  // Hide edit mode if open
        break;

      case 'error':
        addLog(`❌ Error: ${msg.message}`);
        if (isAuthError(msg.message)) {
          goToLogin();
          return;
        }
        alert('Error: ' + msg.message);
        break;

      default:
        break;
    }
  };

  const rememberCaretForRemoteEdit = (adjust) => {
    const el = editorRef.current;
    if (!el) return;
    pendingCaretRef.current = {
      start: adjust(el.selectionStart),
      end: adjust(el.selectionEnd),
    };
  };

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    const el = editorRef.current;
    if (!caret || !el) return;
    el.selectionStart = caret.start;
    el.selectionEnd = caret.end;
    pendingCaretRef.current = null;
  }, [content]);

  const applyInsert = (pos, text) => {
    rememberCaretForRemoteEdit((index) => (index > pos ? index + text.length : index));
    setContent(prev => {
      const newContent = prev.slice(0, pos) + text + prev.slice(pos);
      lastContentRef.current = newContent;
      return newContent;
    });
  };

  const applyDelete = (pos, len) => {
    rememberCaretForRemoteEdit((index) => {
      if (index <= pos) return index;
      if (index >= pos + len) return index - len;
      return pos;
    });
    setContent(prev => {
      const newContent = prev.slice(0, pos) + prev.slice(pos + len);
      lastContentRef.current = newContent;
      return newContent;
    });
  };

  const canEdit = userRole === 'OWNER' || userRole === 'EDITOR';

  const handleContentChange = (e) => {
    if (!canEdit) {
      return;
    }
    if (isTokenExpired(localStorage.getItem('token'))) {
      goToLogin();
      return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const newContent = e.target.value;
    const oldContent = lastContentRef.current;
    const cursorPos = e.target.selectionStart;

    // Detect insert
    if (newContent.length > oldContent.length) {
      const insertedText = newContent.slice(
        cursorPos - (newContent.length - oldContent.length),
        cursorPos
      );
      const pos = cursorPos - insertedText.length;

      addLog(`📤 Sending insert at pos ${pos}: "${insertedText}"`);
      
      ws.send(JSON.stringify({
        type: 'insert',   
        payload: {
          docId,
          pos,
          text: insertedText,
          baseVersion: versionRef.current  // Use ref
        }
      }));
      
      // IMPORTANT: Update own version immediately after sending
      versionRef.current = versionRef.current + 1;  // Use ref
    } 
    // Detect delete
    else if (newContent.length < oldContent.length) {
      const len = oldContent.length - newContent.length;
      const pos = cursorPos;

      addLog(`📤 Sending delete at pos ${pos}, len ${len}`);
      
      ws.send(JSON.stringify({
        type: 'delete',
        payload: {
          docId,
          pos,
          len,
          baseVersion: versionRef.current  // Use ref
        }
      }));
      
      // IMPORTANT: Update own version immediately after sending
      versionRef.current = versionRef.current + 1;  // Use ref
    }

    setContent(newContent);
    lastContentRef.current = newContent;
  };

  // Handle share document
  const handleShare = async () => {
    if (!shareEmail.trim()) {
      alert('Please enter an email address');
      return;
    }

    setShareLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/docx/share`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          docId,
          email: shareEmail,
          role: selectedRole
        })
      });

      if (response.status === 401) {
        goToLogin();
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        alert(`Document shared with ${shareEmail} as ${selectedRole}`);
        setShowModal(false);
        setShareEmail('');
        setSelectedRole('VIEWER');
      } else {
        alert('Error: ' + data.message);
      }
    } catch (error) {
      alert('Error sharing document: ' + error.message);
    } finally {
      setShareLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    const response = await fetch(`${getApiBase()}/docx/update/${docId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ title }),
    });
    if (response.status === 401) {
      goToLogin();
      return;
    }
    if(response.ok){
      alert('Title saved successfully');
      setShowSave(false);
    } else {
      alert('Error saving title');
    }
  };

  return (
    <div className="doc-container">
      {/* Header */}
      <div className="doc-header">
        <div className="doc-title-container">
          {!showSave ? (
            <span
              className="doc-title-display"
              onClick={() => {
                if (canEdit) setShowSave(true);
              }}
            >
              {title || 'Untitled Document'}
            </span>
          ) : (
            <div className="doc-title-edit">
              <input
                type="text"
                className="doc-title-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled Document"
                autoFocus
              />
              <button onClick={handleSaveTitle} className="save-title-btn" title="Save title">
                ✓
              </button>
            </div>
          )}
        </div>
        <div className="doc-info">
          <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'} 
          </span>
          <div className="online-users-container">
            {onlineUsers.map((email) => {
              const initials = email.substring(0, 2).toUpperCase();
              return (
                <div key={email} className="user-avatar-wrapper">
                  <div className="user-avatar">
                    {initials}
                  </div>
                  <span className="user-tooltip">{email}</span>
                </div>
              );
            })}
            <span className="online-count">{onlineUsers.length} online</span>
          </div>
        </div>
        <div className="share">
          <button onClick={() => setShowModal(true)} className="share-btn" disabled={userRole !== 'OWNER'}>
            👥 Share Document
          </button>
        </div>
      </div>
      {/* Editor - Single A4 Page */}
      <div className="editor-container">
        <div className="page">
          <textarea
            ref={editorRef}
            className="page-content"
            value={content}
            onChange={handleContentChange}
            placeholder={canEdit ? 'Start typing...' : 'View only'}
            disabled={!connected}
            readOnly={!canEdit}
          />
        </div>
      </div>

      {/* Share Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Share Document</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter user's email"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="modal-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Select Role</label>
                <select
                  id="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="modal-select"
                >
                  <option value="VIEWER">Viewer - Can only view</option>
                  <option value="EDITOR">Editor - Can edit</option>
                  <option value="OWNER"> Owner - Full control</option>
                </select>
              </div>

              <div className="role-description">
                {selectedRole === 'VIEWER' && (
                  <p>Viewer can only read the document</p>
                )}
                {selectedRole === 'EDITOR' && (
                  <p>Editor can read and edit the document</p>
                )}
                {selectedRole === 'OWNER' && (
                  <p>Owner has full control including delete and share</p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-cancel" 
                onClick={() => setShowModal(false)}
                disabled={shareLoading}
              >
                Cancel
              </button>
              <button 
                className="btn-share" 
                onClick={handleShare}
                disabled={shareLoading}
              >
                {shareLoading ? 'Sharing...' : 'Share Document'}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default Doc;
