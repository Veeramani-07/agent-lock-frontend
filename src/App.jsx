import React, { useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const BASE_URL = "https://agent-lock-backend.onrender.com";

const AgentDashboard = () => {
    const [actions, setActions] = useState([]);
    const [selectedCmdId, setSelectedCmdId] = useState(null);
    const [feedbackText, setFeedbackText] = useState("");

    useEffect(() => {
        // Fetch existing logs on initial load
        fetch(`${BASE_URL}/api/agent/actions`)
            .then(res => res.json())
            .then(data => setActions(data))
            .catch(err => console.error("API Fetch Error:", err));

        // STOMP WebSocket Connection
        const stompClient = new Client({
            webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
            onStompError: (frame) => console.error("STOMP Error:", frame.headers['message']),
            reconnectDelay: 5000,
            onConnect: () => {
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
            }
        });

        stompClient.activate();
        return () => stompClient.deactivate();
    }, []);

    // Send Approval or Rejection with Feedback
    const submitDecision = (commandId, decision, feedback = "") => {
        fetch(`${BASE_URL}/api/agent/decision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                commandId: commandId,
                decision: decision, // "APPROVED" or "REJECTED"
                feedbackPrompt: feedback
            })
        }).then(() => {
            setSelectedCmdId(null);
            setFeedbackText("");
        });
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h2>🛡️ Agent Lock - Live Supervisor Dashboard</h2>
            <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f2f2f2' }}>
                        <th>Command ID</th>
                        <th>Agent</th>
                        <th>Command</th>
                        <th>Risk Score</th>
                        <th>Status</th>
                        <th>Supervisor Feedback</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {actions.map((act) => (
                        <tr key={act.commandId}>
                            <td>{act.commandId}</td>
                            <td>{act.agentName}</td>
                            <td><code>{act.command}</code></td>
                            <td style={{ color: act.riskScore > 40 ? 'red' : 'green', fontWeight: 'bold' }}>
                                {act.riskScore}
                            </td>
                            <td><strong>{act.status}</strong></td>
                            <td style={{ fontStyle: 'italic', color: '#555' }}>
                                {act.feedbackPrompt || "—"}
                            </td>
                            <td>
                                {act.status === 'PAUSED' ? (
                                    <>
                                        <button 
                                            onClick={() => submitDecision(act.commandId, 'APPROVED')} 
                                            style={{ marginRight: '5px', background: 'green', color: 'white', cursor: 'pointer' }}>
                                            Approve
                                        </button>
                                        <button 
                                            onClick={() => setSelectedCmdId(act.commandId)} 
                                            style={{ background: 'red', color: 'white', cursor: 'pointer' }}>
                                            Reject...
                                        </button>
                                    </>
                                ) : (
                                    <span style={{ color: '#888' }}>Resolved</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Rejection Feedback Modal Box */}
            {selectedCmdId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '400px' }}>
                        <h3>🚫 Reject Action: {selectedCmdId}</h3>
                        <p>Provide feedback for the AI Agent to self-correct:</p>
                        <textarea 
                            rows="3" 
                            style={{ width: '95%', padding: '8px', marginBottom: '10px' }}
                            placeholder="e.g., Do not drop production database tables directly."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setSelectedCmdId(null)}>Cancel</button>
                            <button 
                                style={{ background: 'red', color: 'white' }}
                                onClick={() => submitDecision(selectedCmdId, 'REJECTED', feedbackText)}>
                                Submit Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentDashboard;