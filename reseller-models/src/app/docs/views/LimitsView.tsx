import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import CodeBlock from '../components/CodeBlock';
import ApiPlayground from '../components/ApiPlayground';

interface LimitsViewProps {
  baseUrl: string;
}

export default function LimitsView({ baseUrl = 'https://api.cheaprouter.com' }: Partial<LimitsViewProps>) {
  const curlCode = `curl -X GET "${baseUrl}/v1/account" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`;

  const jsCode = `fetch('${baseUrl}/v1/account', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
})`;

  const pyCode = `import requests

url = "${baseUrl}/v1/account"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)
print(response.json())`;

  const snippets = [
    { language: 'cURL' as const, code: curlCode },
    { language: 'JavaScript' as const, code: jsCode },
    { language: 'Python' as const, code: pyCode },
  ];

  const exampleResponse = `{
  "object": "account",
  "id": "acc_123456789",
  "email": "user@example.com",
  "subscription": {
    "plan": "pro",
    "status": "active",
    "billing_period_end": 1718290920
  },
  "usage": {
    "api_hits_used": 1500,
    "api_hits_limit": 10000,
    "chat_messages_used": 340,
    "chat_messages_limit": 5000
  },
  "created_at": 1715000000
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-muted)', fontSize: '11px', fontFamily: 'monospace', marginBottom: '24px' }}>
          <span>API</span>
          <span>&gt;</span>
          <span style={{ color: 'var(--color-text-muted)' }}>Account Info</span>
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
          marginBottom: '24px'
        }}>
          <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '4px 10px', borderRadius: 'var(--radius-lg)', fontWeight: 800, fontSize: '11px' }}>GET</span>
          <code style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-main)', fontFamily: 'monospace' }}>/v1/account</code>
        </div>

        <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.5px', color: 'var(--color-text-main)' }}>
          Account Info
        </h2>
        
        <p style={{ fontSize: '15px', color: 'var(--color-text-muted)', maxWidth: '800px', lineHeight: '1.6', marginBottom: '24px' }}>
          Retrieve information about your account, including subscription details and current API usage limits. You must provide your API Key (generated from your Dashboard) in the Authorization header.
        </p>

        {/* Info Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-card)' }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Returns:</span>
            <span style={{ color: 'var(--color-text-main)', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace' }}>JSON Object</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--color-border)', padding: '6px 12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-bg-card)' }}>
            <ShieldAlert size={14} color="var(--color-primary)" />
            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Auth:</span>
            <span style={{ color: 'var(--color-primary)', fontSize: '12px', fontWeight: 700 }}>API Key Required</span>
          </div>
        </div>
      </div>

      {/* Grid Layout for Requests & Responses */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '48px', alignItems: 'flex-start' }}>
        
        {/* Left Column (Requests) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <CodeBlock snippets={snippets} />
          
          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>No request body required</span>
          </div>
          
          {/* Headers table */}
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
            borderTop: '1px solid #4ade80',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 15px rgba(34, 197, 94, 0.1)'
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
                    .replace(/(true|false|null)/g, '<span style="color:var(--color-success)">$1</span>') // booleans
                    .replace(/([0-9]+)/g, '<span style="color:#fde047">$1</span>'); // numbers
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
        <div style={{ width: '50%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(204,0,0,0.3), transparent)' }}></div>
      </div>

      {/* Enhanced Test Section */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '8px', letterSpacing: '-0.5px' }}>Live API Tester</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Send real requests to the endpoint and view the response instantly.</p>
        </div>
        
        <ApiPlayground 
          endpoint={`${baseUrl}/v1/account`} 
          method="GET" 
          requiresAuth={true} 
          buttonText="Get Info"
        />
      </div>
    </motion.div>
  );
}
