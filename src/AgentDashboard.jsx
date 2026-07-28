import React, { useEffect, useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

const BASE_URL = "https://agent-lock-backend.onrender.com";

// Default Initial Fallback Logs
const FALLBACK_LOGS = [
    {
        commandId: 'CMD_101',
        agentName: 'Codex-Refactor-Bot (AI)',
        command: 'git push origin main --force',
        riskScore: 85,
        status: 'PAUSED',
        feedbackPrompt: 'Waiting for supervisor review...',
        createdAt: Date.now()
    },
    {
        commandId: 'CMD_100',
        agentName: 'Data-Sync-Agent (AI)',
        command: 'SELECT * FROM users LIMIT 10',
        riskScore: 12,
        status: 'APPROVED_AUTO',
        feedbackPrompt: 'Safe execution',
        createdAt: Date.now() - 60000
    }
];

const AgentDashboard = () => {
    const [actions, setActions] = useState([]);
    const [selectedCmdId, setSelectedCmdId] = useState(null);
    const [feedbackText, setFeedbackText] = useState("");
    const [simulating, setSimulating] = useState(false);
    
    // Ref to hold current actions for inside intervals without closure bugs
    const actionsRef = useRef(actions);
    actionsRef.current = actions;

    // Send Approval or Rejection Decision to Backend
    const submitDecision = (commandId, decision, feedback = "") => {
        fetch(`${BASE_URL}/api/agent/decision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                commandId: commandId,
                decision: decision,
                feedbackPrompt: feedback
            })
        })
        .then(() => {
            setSelectedCmdId(null);
            setFeedbackText("");
        })
        .catch(err => console.error("Decision Submit Error:", err));

        // Optimistic State Update
        setActions(prev => 
            prev.map(act => 
                act.commandId === commandId 
                    ? { ...act, status: decision, feedbackPrompt: feedback || (decision === 'APPROVED' ? 'Approved' : 'Rejected') } 
                    : act
            )
        );
    };

    // ⏱️ 30-Second Auto Timeout Mechanism
    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            actionsRef.current.forEach((act) => {
                if (act.status === 'PAUSED') {
                    const elapsedSeconds = Math.floor((now - (act.createdAt || now)) / 1000);
                    if (elapsedSeconds >= 30) {
                        // Auto-reject on 30s timeout
                        submitDecision(
                            act.commandId, 
                            'REJECTED', 
                            'Auto-rejected: 30s Supervisor response timeout exceeded.'
                        );
                    }
                }
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Initial Fetch & WebSocket Subscription
    useEffect(() => {
        fetch(`${BASE_URL}/api/agent/actions`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const initializedData = data.map(item => ({
                        ...item,
                        createdAt: item.createdAt || Date.now()
                    }));
                    setActions(initializedData);
                } else {
                    setActions(FALLBACK_LOGS);
                }
            })
            .catch(err => {
                console.error("API Fetch Error:", err);
                setActions(FALLBACK_LOGS);
            });

        const stompClient = new Client({
            webSocketFactory: () => new SockJS(`${BASE_URL}/ws`),
            reconnectDelay: 5000,
            onConnect: () => {
                stompClient.subscribe('/topic/actions', (message) => {
                    const updatedAction = JSON.parse(message.body);
                    const actionWithTimestamp = {
                        ...updatedAction,
                        createdAt: Date.now()
                    };

                    setActions((prevActions) => {
                        const index = prevActions.findIndex(a => a.commandId === actionWithTimestamp.commandId);
                        if (index !== -1) {
                            const copy = [...prevActions];
                            copy[index] = actionWithTimestamp;
                            return copy;
                        }
                        return [actionWithTimestamp, ...prevActions];
                    });
                });
            }
        });

        stompClient.activate();
        return () => stompClient.deactivate();
    }, []);

    // ⚡ Trigger High-Risk AI Simulation
    const triggerSimulation = async () => {
        setSimulating(true);
        const randomId = `CMD_${Math.floor(200 + Math.random() * 800)}`;
        
        // AI Commands List to simulate realistic LLM Tool-Call outputs
        const aiCommands = [
            { cmd: "rm -rf /var/www/production_db", agent: "Codex-CLI-Agent", risk: 98 },
            { cmd: "DROP TABLE production_users;", agent: "Codex-DB-Bot", risk: 95 },
            { cmd: "kubectl delete namespace production", agent: "Codex-DevOps-AI", risk: 92 },
            { cmd: "ALTER TABLE transactions DROP COLUMN amount;", agent: "Codex-Fintech-Bot", risk: 89 }
        ];

        const selected = aiCommands[Math.floor(Math.random() * aiCommands.length)];

        const payload = {
            commandId: randomId,
            agentName: selected.agent,
            command: selected.cmd,
            riskScore: selected.risk,
            status: "PAUSED",
            feedbackPrompt: "Awaiting Supervisor Approval...",
            createdAt: Date.now()
        };

        try {
            await fetch(`${BASE_URL}/api/agent/intercept`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            // Local fallback addition for instant UX response
            setActions(prev => [payload, ...prev]);
        } catch (err) {
            console.error("Simulation Trigger Error:", err);
        } finally {
            setSimulating(false);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ margin: 0 }}>🛡️ Agent Lock - Live Supervisor Dashboard</h2>
                    <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>
                        Real-time AI Guardrail Interceptor (Auto-rejects unverified commands after 30s)
                    </p>
                </div>
                <button
                    onClick={triggerSimulation}
                    disabled={simulating}
                    style={{
                        padding: '10px 18px',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                >
                    {simulating ? "Generating AI Payload..." : "🤖 Simulate High-Risk AI Action"}
                </button>
            </div>

            <table border="1" cellPadding="12" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ background: '#f3f4f6' }}>
                        <th>Command ID</th>
                        <th>AI Agent Name</th>
                        <th>Intercepted Command</th>
                        <th>Risk Score</th>
                        <th>Status</th>
                        <th>Supervisor Feedback</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {actions.map((act) => {
                        const elapsedSeconds = act.status === 'PAUSED' 
                            ? Math.max(0, 30 - Math.floor((Date.now() - (act.createdAt || Date.now())) / 1000))
                            : 0;

                        return (
                            <tr key={act.commandId}>
                                <td><b>{act.commandId}</b></td>
                                <td>{act.agentName}</td>
                                <td><code>{act.command}</code></td>
                                <td style={{ color: act.riskScore > 70 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                                    {act.riskScore}
                                </td>
                                <td>
                                    <span style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: act.status === 'PAUSED' ? '#fef3c7' : act.status === 'APPROVED' ? '#dcfce7' : '#fee2e2',
                                        color: act.status === 'PAUSED' ? '#d97706' : act.status === 'APPROVED' ? '#15803d' : '#b91c1c',
                                        fontWeight: 'bold'
                                    }}>
                                        {act.status} {act.status === 'PAUSED' && `(${elapsedSeconds}s)`}
                                    </span>
                                </td>
                                <td style={{ fontStyle: 'italic', color: '#4b5563' }}>
                                    {act.feedbackPrompt || "—"}
                                </td>
                                <td>
                                    {act.status === 'PAUSED' ? (
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button 
                                                onClick={() => submitDecision(act.commandId, 'APPROVED')} 
                                                style={{ background: '#16a34a', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                                                Approve
                                            </button>
                                            <button 
                                                onClick={() => setSelectedCmdId(act.commandId)} 
                                                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                                                Reject...
                                            </button>
                                        </div>
                                    ) : (
                                        <span style={{ color: '#9ca3af' }}>Resolved</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Rejection Feedback Modal */}
            {selectedCmdId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '420px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ marginTop: 0 }}>🚫 Reject Action: {selectedCmdId}</h3>
                        <p style={{ color: '#4b5563', fontSize: '14px' }}>Provide feedback for the AI Agent to re-plan execution:</p>
                        <textarea 
                            rows="3" 
                            style={{ width: '95%', padding: '10px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #ccc' }}
                            placeholder="e.g., Do not drop production tables. Use soft delete or archived state."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setSelectedCmdId(null)} style={{ padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                            <button 
                                style={{ background: '#dc2626', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
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