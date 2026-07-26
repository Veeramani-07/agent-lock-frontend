import React, { useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

// Fix for Vite + SockJS 'global is not defined' issue
if (typeof window !== 'undefined') {
    window.global = window;
}

const BASE_URL = "https://agent-lock-backend.onrender.com";

const AgentDashboard = () => {
    const [actions, setActions] = useState([]);

    useEffect(() => {
        // 1. Fetch existing logs on initial load
        fetch(`${BASE_URL}/api/agent/actions`)
            .then(res => res.json())
            .then(data => setActions(data))
            .catch(err => console.error("API Fetch Error:", err));

        // 2. STOMP WebSocket Connection
        const stompClient = new Client({
            webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
            reconnectDelay: 5000,
            onConnect: () => {
                console.log("Connected to Agent-Lock WebSocket!");
                stompClient.subscribe('/topic/actions', (message) => {
                    const updatedAction = JSON.parse(message.body);
                    setActions((prevActions) => {
                        const index = prevActions.findIndex(a => a.commandId === updatedAction.commandId);
                        if (index !== -1) {
                            const copy = [...prevActions];
                            copy[index] = updatedAction;
                            return copy;
                        }
                        return [updatedAction, ...prevActions];
                    });
                });
            },
            onStompError: (frame) => {
                console.error("Broker error:", frame.headers['message']);
            }
        });

        stompClient.activate();
        return () => stompClient.deactivate();
    }, []);

    // 3. Explicit Decision Handler
    const handleDecision = (commandId, decisionStatus) => {
        fetch(`${BASE_URL}/api/agent/decision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                commandId: commandId,
                decision: decisionStatus,
                feedbackPrompt: decisionStatus === 'REJECTED_HUMAN' 
                    ? 'Rejected by human supervisor' 
                    : 'Approved by human supervisor'
            })
        }).catch(err => console.error("Decision update failed:", err));
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h2>🛡️ Agent Lock - Live Supervisor Dashboard</h2>
            <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ background: '#f2f2f2' }}>
                        <th>Command ID</th>
                        <th>Agent</th>
                        <th>Command</th>
                        <th>Risk Score</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {actions.length === 0 ? (
                        <tr>
                            <td colSpan="6" style={{ textAlign: 'center' }}>No actions logged yet. Send a test payload!</td>
                        </tr>
                    ) : (
                        actions.map((act) => (
                            <tr key={act.commandId}>
                                <td>{act.commandId}</td>
                                <td>{act.agentName}</td>
                                <td><code>{act.command}</code></td>
                                <td style={{ color: act.riskScore > 40 ? 'red' : 'green', fontWeight: 'bold' }}>
                                    {act.riskScore}
                                </td>
                                <td><strong>{act.status}</strong></td>
                                <td>
                                    {act.status === 'PAUSED' ? (
                                        <>
                                            <button 
                                                onClick={() => handleDecision(act.commandId, 'APPROVED')} 
                                                style={{ marginRight: '8px', background: '#28a745', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}>
                                                Approve
                                            </button>
                                            <button 
                                                onClick={() => handleDecision(act.commandId, 'REJECTED_HUMAN')} 
                                                style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}>
                                                Reject
                                            </button>
                                        </>
                                    ) : (
                                        <span style={{ color: '#888' }}>Resolved ({act.status})</span>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default AgentDashboard;