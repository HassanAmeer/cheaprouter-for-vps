# opencode-bypass-setup

OpenCode ke upstream free-tier gate ka **zero-dependency, zero-RAM** bypass.

## Kya hai yeh?

[dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) ne OpenCode ke session fingerprint validation ko reverse engineer kiya hua hai. Yeh folder usi logic ko `provider-opencode` ke andar rakhta hai — clean, alag, aur aasani se enable/disable karne ke liye.

Isse aap **bina OpenCode CLI install kiye**, **bina login kiye**, **bina API key ke** OpenCode ke free models use kar sakte hain.

---

## Enable / Disable

```bash
# .env ya server environment me:
OPENCODE_BYPASS_ENABLED=true   # enable
OPENCODE_BYPASS_ENABLED=false  # disable (default)
```

**Default: disabled** — jab tak explicitly enable na karo, koi extra RAM/processing nahi hogi.

---

## Files

```
opencode-bypass-setup/
├── index.ts        ← main entry point (yahan se import karo)
├── client.ts       ← bypassChat() + bypassChatStream() functions
├── session.ts      ← session ID generation (descending bitwise encoding)
├── fingerprint.ts  ← headers + tool fingerprint injection
└── README.md       ← yeh file
```

---

## Usage

```ts
import {
  OPENCODE_BYPASS_ENABLED,
  bypassChat,
  bypassChatStream,
} from "@t3tools/provider-opencode/opencode-bypass-setup";

// Check karo enabled hai ya nahi
if (OPENCODE_BYPASS_ENABLED) {
  // Non-streaming
  const res = await bypassChat({
    model: "deepseek-v4-1-flash-free",
    messages: [{ role: "user", content: "Hello!" }],
  });
  console.log(res.content);

  // Streaming
  await bypassChatStream(
    { model: "kimi-k3-free", messages: [{ role: "user", content: "Hello!" }] },
    (chunk) => process.stdout.write(chunk),
    (sessionId) => console.log("Done, session:", sessionId),
  );
}
```

---

## RAM / ROM

| State    | RAM Extra | ROM (Disk) |
|----------|-----------|------------|
| Disabled | 0 MB      | ~12 KB     |
| Enabled  | ~0 MB     | ~12 KB     |

*(Website ke existing Node.js process me chalega — koi naya process ya server nahi)*

---

## Available Free Models

| Model ID                  | Notes            |
|---------------------------|------------------|
| `deepseek-v4-1-flash-free` | DeepSeek V4.1 Flash |
| `kimi-k3-free`            | Kimi K3          |

---

## How it Works (Short)

1. **Session ID:** `ses_<12 hex descending timestamp><14 random base62>` — exact descending bitwise NOT encoding jo upstream gate check karta hai
2. **Headers:** `x-opencode-session`, `x-opencode-session-id`, `x-session-affinity` + exact `User-Agent: opencode/latest/2.0.26/cli`
3. **Tool Injection:** `read` + `shell` tools verbatim OpenCode v2.0.26 CLI se inject hote hain
4. **Endpoint:** `https://opencode.ai/inference/v1/chat/completions`

---

## Future Plans (RAM/ROM Boost)

- [ ] Session caching — ek hi session reuse karo, naye mint karne ki zaroorat nahi
- [ ] Request queue — concurrent requests throttle karo server load ke liye
- [ ] Response cache (Redis/memory) — same prompt ka cached jawab do
