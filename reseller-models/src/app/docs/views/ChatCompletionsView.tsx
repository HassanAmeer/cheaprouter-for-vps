import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import CodeBlock from '../components/CodeBlock';
import ApiPlayground from '../components/ApiPlayground';

interface ChatCompletionsViewProps {
  baseUrl: string;
}

export default function ChatCompletionsView({ baseUrl }: ChatCompletionsViewProps) {
  const curlCode = `curl -X POST "${baseUrl}/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": "Write a haiku about APIs."
      }
    ]
  }'`;

  const jsCode = `fetch('${baseUrl}/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [
      { role: 'user', content: 'Write a haiku about APIs.' }
    ]
  })
})`;

  const pyCode = `import requests

url = "${baseUrl}/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_API_KEY"
}
payload = {
    "model": "gpt-4o",
    "messages": [
        {"role": "user", "content": "Write a haiku about APIs."}
    ]
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())`;

  const snippets = [
    { language: 'cURL' as const, code: curlCode },
    { language: 'JavaScript' as const, code: jsCode },
    { language: 'Python' as const, code: pyCode },
  ];

  const defaultPlaygroundPayload = `{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Hello! How are you?"
    }
  ]
}`;

  const exampleResponse = `{
  "id": "chatcmpl-8f921ab0",
  "object": "chat.completion",
  "created": 1718292150,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "I'm doing well, thank you for asking! How can I assist you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 14,
    "completion_tokens": 16,
    "total_tokens": 30
  }
}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}
    >
      {/* Top Section */}
      <div>
        {/* Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '11px', fontFamily: 'monospace', marginBottom: '24px' }}>
          <span>API</span>
          <span>&gt;</span>
          <span style={{ color: 'var(--color-text-muted)' }}>Chat Completions</span>
        </div>

        {/* Endpoint Badge */}
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '12px', 
          backgroundColor: 'var(--color-bg-card)', 
          border: '1px solid var(--color-border)', 
          padding: '6px 16px 6px 6px', 
          borderRadius: 'var(--radius-xl)', 
          marginBottom: '24px',
          boxShadow: '0 0 20px rgba(204, 0, 0, 0.05)'
        }}>
          <span style={{ backgroundColor: 'rgba(204, 0, 0, 0.2)', color: 'var(--color-primary)', border: '1px solid rgba(204, 0, 0, 0.3)', padding: '4px 10px', borderRadius: 'var(--radius-lg)', fontWeight: 800, fontSize: '11px' }}>POST</span>
          <code style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)', fontFamily: 'monospace' }}>/v1/chat/completions</code>
        </div>

        <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.5px', color: 'var(--color-text-main)' }}>
          Chat Completions
        </h2>
        
        <p style={{ fontSize: '15px', color: 'var(--color-text-muted)', maxWidth: '800px', lineHeight: '1.6', marginBottom: '24px' }}>
          Create a model response for the given chat conversation. This endpoint supports standard OpenAI chat completions format, including streaming and function calling. Use this endpoint to build chat assistants.
        </p>

        {/* Info Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-card)' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Returns:</span>
            <span style={{ color: 'var(--color-text-main)', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace' }}>JSON Object</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-card)' }}>
            <ShieldAlert size={14} color="#64748b" />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Auth:</span>
            <span style={{ color: 'var(--color-text-main)', fontSize: '12px', fontWeight: 700 }}>Required</span>
          </div>
        </div>
      </div>

      {/* Grid Layout for Requests & Responses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '48px', alignItems: 'flex-start' }}>
        
        {/* Left Column (Requests) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <CodeBlock snippets={snippets} />
          {/* Headers table to keep existing documentation intact */}
          <div style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '12px' }}>Headers Required</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 0', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-main)' }}>Authorization</td>
                  <td style={{ padding: '8px 0', color: 'var(--color-text-muted)' }}>Bearer YOUR_API_KEY</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 0 4px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-text-main)' }}>Content-Type</td>
                  <td style={{ padding: '12px 0 4px', color: 'var(--color-text-muted)' }}>application/json</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (Responses) */}
        <div style={{ position: 'sticky', top: '48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            borderTop: '1px solid var(--color-primary)',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 15px rgba(204, 0, 0, 0.1)'
          }}>
            {/* Response Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--color-bg-card)',
              borderBottom: '1px solid var(--color-border)',
              padding: '12px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ color: 'var(--color-text-main)', fontSize: '13px', fontWeight: 600 }}>Response</span>
                <span style={{ backgroundColor: 'rgba(22, 163, 74, 0.2)', color: '#4ade80', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>200 OK</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontFamily: 'monospace' }}>application/json</span>
              </div>
            </div>
            
            {/* Response Body */}
            <div style={{ padding: '24px', overflowX: 'auto' }}>
              <pre style={{ margin: 0, color: 'var(--color-text-main)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '13px', lineHeight: '1.6' }}>
                <code>{exampleResponse.split('\n').map((line, idx) => {
                  let htmlLine = line
                    .replace(/(".*?")/g, '<span style="color:var(--color-primary)">$1</span>') // strings (red tint)
                    .replace(/(true|false|null)/g, '<span style="color:var(--color-success)">$1</span>'); // booleans
                  return (
                    <div key={idx} dangerouslySetInnerHTML={{ __html: htmlLine || ' ' }} />
                  );
                })}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Half Horizontal Divider */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '48px 0 24px 0' }}>
        <div style={{ 
          width: '50%', 
          height: '1px', 
          background: 'linear-gradient(90deg, transparent, var(--color-border), transparent)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--color-bg)',
            padding: '0 16px',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', boxShadow: 'var(--shadow-glow)' }}></div>
          </div>
        </div>
      </div>

      {/* Enhanced Test Section */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '8px', letterSpacing: '-0.5px' }}>Live API Tester</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Send real requests to the endpoint and watch the AI response stream in real-time.</p>
        </div>
        
        <ApiPlayground 
          endpoint={`${baseUrl}/v1/chat/completions`} 
          method="POST" 
          requiresAuth={true} 
          defaultPayload={defaultPlaygroundPayload}
        />
      </div>
    </motion.div>
  );
}
