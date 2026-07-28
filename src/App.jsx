import React, { useEffect, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const BASE_URL = "https://agent-lock-backend.onrender.com";

// Initial logs for instant visual feedback on page load
const FALLBACK_LOGS = [
    {
        commandId: 'CMD_101',
        agentName: 'Codex-Refactor-Bot',
        command: 'git push origin main --force',
        riskScore: 85,
        status: 'PAUSED',
        feedbackPrompt: 'Waiting for supervisor review...'
    },
    {
        commandId: 'CMD_100',
        agentName: 'Data-Sync-Agent',
        command: 'SELECT * FROM users LIMIT 10',
        riskScore: 12,
        status: 'APPROVED_AUTO',
        feedbackPrompt: 'Safe execution'
    }
];

const AgentDashboard = () => {
    const [actions, setActions] = useState([]);
    const [selectedCmdId, setSelectedCmdId] = useState(null);
    const [feedbackText, setFeedbackText] = useState("");
    const [simulating, setSimulating] = useState(false);

    useEffect(() => {
        // Fetch existing logs on initial load
        fetch(`${BASE_URL}/api/agent/actions`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    setActions(data);
                } else {
                    setActions(FALLBACK_LOGS);
                }
            })
            .catch(err => {
                console.error("API Fetch Error:", err);
                setActions(FALLBACK_LOGS);
            });

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

    // Send Simulation Request from UI
    const triggerSimulation = async () => {
        setSimulating(true);
        const randomId = `CMD_${Math.floor(200 + Math.random() * 800)}`;
        try {
            await fetch(`${BASE_URL}/api/agent/intercept`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    commandId: randomId,
                    agentName: "Codex-DB-Agent",
                    command: "DROP TABLE users;",
                    riskScore: 90
                })
            });
        } catch (err) {
            console.error("Simulation Trigger Error:", err);
        } finally {
            setSimulating(false);
        }
    };

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>🛡️ Agent Lock - Live Supervisor Dashboard</h2>
                <button
                    onClick={triggerSimulation}
                    disabled={simulating}
                    style={{
                        padding: '10px 16px',
                        background: '#0066cc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                >
                    {simulating ? "Triggering..." : "⚡ Simulate High-Risk Action"}
                </button>
            </div>

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
                            <td>
                                <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    background: act.status === 'PAUSED' ? '#fff3cd' : act.status === 'APPROVED' ? '#d4edda' : '#f8d7da',
                                    color: act.status === 'PAUSED' ? '#856404' : act.status === 'APPROVED' ? '#155724' : '#721c24',
                                    fontWeight: 'bold'
                                }}>
                                    {act.status}
                                </span>
                            </td>
                            <td style={{ fontStyle: 'italic', color: '#555' }}>
                                {act.feedbackPrompt || "—"}
                            </td>
                            <td>
                                {act.status === 'PAUSED' ? (
                                    <>
                                        <button 
                                            onClick={() => submitDecision(act.commandId, 'APPROVED')} 
                                            style={{ marginRight: '5px', background: 'green', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                                            Approve
                                        </button>
                                        <button 
                                            onClick={() => setSelectedCmdId(act.commandId)} 
                                            style={{ background: 'red', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>
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
                                style={{ background: 'red', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
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